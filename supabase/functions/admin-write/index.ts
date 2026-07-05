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
    if (action !== "upload_image" && !ALLOWED_TABLES.includes(table)) {
      return new Response(JSON.stringify({ error: "invalid table" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Upload de imagem (já com fundo removido, vindo do remove-bg) pro
    // Storage. Devolve a URL pública, que é o que fica salvo em bags.img /
    // looks.img.
    if (action === "upload_image") {
      const { base64, filename } = payload;
      const commaIdx = base64.indexOf(",");
      const meta = base64.slice(0, commaIdx);
      const raw = base64.slice(commaIdx + 1);
      const contentType = /data:(.*?);base64/.exec(meta)?.[1] || "image/png";
      const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
      const path = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      const up = await supabase.storage.from("product-images").upload(path, bytes, {
        contentType,
        upsert: true,
      });
      if (up.error) {
        return new Response(JSON.stringify({ error: up.error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, "content-type": "application/json" },
        });
      }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      return new Response(JSON.stringify({ data: { url: pub.pub