// Edge Function: remove-bg
// Recebe uma imagem do painel admin, chama a API do remove.bg (key protegida
// aqui dentro, nunca no navegador) e devolve a imagem com fundo removido pro
// admin conferir antes de salvar. Nada é gravado no banco por essa function —
// isso só acontece quando o admin confirma via `admin-write`.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const REMOVE_BG_KEY = Deno.env.get("REMOVE_BG_KEY")!;
const VALID_PASSWORDS = [
  Deno.env.get("ADMIN_PASSWORD_BAGS"),
  Deno.env.get("ADMIN_PASSWORD_LOOKS"),
].filter(Boolean);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-admin-password",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  if (!VALID_PASSWORDS.includes(req.headers.get("x-admin-password"))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "missing image" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      });
    }

    const upstreamForm = new FormData();
    upstreamForm.append("image_file", file, file.name);
    upstreamForm.append("size", "auto");

    const rbRes = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": REMOVE_BG_KEY },
      body: upstreamForm,
    });

    if (!rbRes.ok) {
      const errText = await rbRes.text();
      return new Response(JSON.stringify({ error: "remove.bg failed", detail: errText }), {
        status: 502,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      });
    }

    const resultBytes = new Uint8Array(await rbRes.arrayBuffer());
    let binary = "";
    for (let i = 0; i < resultBytes.length; i++) binary += String.fromCharCode(resultBytes[i]);
    const base64 = btoa(binary);

    return new Response(JSON.stringify({ image: `data:image/png;base64,${base64}` }), {
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }
});
