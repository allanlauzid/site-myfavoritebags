// Edge Function: admin-write
// Único ponto de escrita no banco. Recebe { password, totp, table, action, payload }
// verifica a senha do admin + o código do autenticador (só no login) e usa o
// service_role (nunca exposto no navegador) pra gravar. O publishable key do
// front só tem permissão de leitura (RLS).

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Senha única do painel (antes eram duas, uma por seção do site).
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD")!;
// Segredo TOTP (base32) usado pelo app autenticador (Google Authenticator,
// Authy, etc.) — configurado uma única vez via secret no Supabase.
const TOTP_SECRET = Deno.env.get("ADMIN_TOTP_SECRET")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const JSON_HEADERS = { ...CORS_HEADERS, "content-type": "application/json" };

const ALLOWED_TABLES = ["bags", "looks", "site_settings"];

// ── TOTP (RFC 6238) — implementação mínima usando Web Crypto (HMAC-SHA1) ───
function base32Decode(b32: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = b32.replace(/=+$/, "").toUpperCase();
  let bits = "";
  for (const char of clean) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

async function totpAt(secretB32: string, counter: number): Promise<string> {
  const keyBytes = base32Decode(secretB32);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const counterBytes = new ArrayBuffer(8);
  const view = new DataView(counterBytes);
  view.setUint32(0, 0);
  view.setUint32(4, counter);
  const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binCode % 1_000_000).padStart(6, "0");
}

// Aceita o código atual e uma janela de ±1 passo (30s) de tolerância de
// relógio entre o celular e o servidor.
async function verifyTotp(code: string): Promise<boolean> {
  if (!TOTP_SECRET || !code) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (const delta of [0, -1, 1]) {
    if ((await totpAt(TOTP_SECRET, step + delta)) === String(code).trim()) return true;
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const body = await req.json();
    const { password, totp, table, action, payload } = body;

    // Login aceita senha OU autenticador — são dois caminhos independentes,
    // não uma segunda camada em cima da outra. O painel só manda um dos dois
    // por vez (o campo que não está em uso nem aparece na tela).
    if (action === "login") {
      const passwordOk = !!password && password === ADMIN_PASSWORD;
      const totpOk = !!totp && (await verifyTotp(totp));
      if (!passwordOk && !totpOk) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: JSON_HEADERS,
        });
      }
      return new Response(JSON.stringify({ data: { ok: true } }), {
        headers: JSON_HEADERS,
      });
    }

    // Todas as outras ações (gravar, apagar, listar imagens...) continuam
    // exigindo a senha — é o único "token" que o painel guarda depois do
    // login, mesmo quando o login em si foi feito pelo autenticador.
    if (password !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: JSON_HEADERS,
      });
    }

    const NO_TABLE_ACTIONS = ["upload_image", "list_images", "delete_image"];
    if (!NO_TABLE_ACTIONS.includes(action) && !ALLOWED_TABLES.includes(table)) {
      return new Response(JSON.stringify({ error: "invalid table" }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Upload de imagem (já com fundo removido, vindo do remove-bg, ou uma
    // foto crua enviada pela aba Upload/Galeria) pro Storage. Devolve a URL
    // pública, que é o que fica salvo em bags.img/looks.img, ou usada pela
    // galeria. Se `payload.exactName` vier true, usa o nome exatamente como
    // veio (já formatado com timestamp pelo front) em vez de prefixar com
    // Date.now() — necessário pra galeria conseguir listar por nome.
    if (action === "upload_image") {
      const { base64, filename, exactName } = payload;
      const commaIdx = base64.indexOf(",");
      const meta = base64.slice(0, commaIdx);
      const raw = base64.slice(commaIdx + 1);
      const contentType = /data:(.*?);base64/.exec(meta)?.[1] || "image/png";
      const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
      const safeName = filename.replace(/[^a-zA-Z0-9._\- ()]/g, "_");
      const path = exactName ? safeName : `${Date.now()}-${safeName}`;

      const up = await supabase.storage.from("product-images").upload(path, bytes, {
        contentType,
        upsert: true,
      });
      if (up.error) {
        return new Response(JSON.stringify({ error: up.error.message }), {
          status: 500,
          headers: JSON_HEADERS,
        });
      }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      return new Response(JSON.stringify({ data: { url: pub.publicUrl, path } }), {
        headers: JSON_HEADERS,
      });
    }

    // Lista todas as imagens já enviadas pra galeria (bucket product-images).
    if (action === "list_images") {
      const { data, error } = await supabase.storage.from("product-images").list("", {
        limit: 1000,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: JSON_HEADERS,
        });
      }
      const files = (data || []).filter((f) => f.id); // ignora "pastas" fantasma
      const images = files.map((f) => {
        const { data: pub } = supabase.storage.from("product-images").getPublicUrl(f.name);
        return {
          name: f.name,
          url: pub.publicUrl,
          created_at: f.created_at,
          size: f.metadata?.size ?? null,
        };
      });
      return new Response(JSON.stringify({ data: images }), {
        headers: JSON_HEADERS,
      });
    }

    // Apaga uma imagem da galeria (Storage).
    if (action === "delete_image") {
      const { path } = payload;
      const { error } = await supabase.storage.from("product-images").remove([path]);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: JSON_HEADERS,
        });
      }
      return new Response(JSON.stringify({ data: { path } }), {
        headers: JSON_HEADERS,
      });
    }

    // Grava/atualiza uma linha em bags ou looks (payload já vem no formato
    // snake_case da tabela — ver productToRow no front).
    if (action === "upsert") {
      const { data, error } = await supabase
        .from(table)
        .upsert(payload)
        .select()
        .single();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: JSON_HEADERS,
        });
      }
      return new Response(JSON.stringify({ data }), {
        headers: JSON_HEADERS,
      });
    }

    // Remove uma linha em bags ou looks a partir do id.
    if (action === "delete") {
      const { id } = payload;
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: JSON_HEADERS,
        });
      }
      return new Response(JSON.stringify({ data: { id } }), {
        headers: JSON_HEADERS,
      });
    }

    // Grava/atualiza uma configuração chave-valor em site_settings.
    if (action === "set_setting") {
      const { key, value } = payload;
      const { data, error } = await supabase
        .from("site_settings")
        .upsert({ key, value })
        .select()
        .single();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: JSON_HEADERS,
        });
      }
      return new Response(JSON.stringify({ data }), {
        headers: JSON_HEADERS,
      });
    }

    return new Response(JSON.stringify({ error: "invalid action" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
