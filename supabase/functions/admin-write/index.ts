// Edge Function: admin-write
// Único ponto de escrita no banco. Recebe { password, table, action, payload }
// verifica a senha do admin e usa o service_role (nunca exposto no navegador)
// pra gravar. O publishable key do front só tem permissão de leitura (RLS).

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Duas senhas de admin (My Favorite Bags e My Favorite Looks têm logins
// separados no site). Aceita qualquer uma das duas configuradas via secrets.
const VALID_PASSWORDS = [
  Deno.env.get("ADMIN_PASSWORD_BAGS"),
  Deno.env.get("ADMIN_PASSWORD_LOOKS"),
].filter(Boolean);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_TABLES = ["bags", "looks", "site_settings"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const body = await req.json();
    const { password, table, action, payload } = body;

    if (!VALID_PASSWORDS.includes(password)) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      });
    }
    if (!ALLOWED_TABLES.includes(table)) {
      return new Response(JSON.stringify({ error: "invalid table" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    let result;

    if (action === "upsert") {
      result = await supabase.from(table).upsert(payload).select();
    } else if (action === "delete") {
      result = await supabase.from(table).delete().eq("id", payload.id);
    } else if (action === "set_setting") {
      result = await supabase
        .from("site_settings")
        .upsert({ key: payload.key, value: payload.value })
        .select();
    } else {
      return new Response(JSON.stringify({ error: "invalid action" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      });
    }

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: result.data }), {
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }
});
