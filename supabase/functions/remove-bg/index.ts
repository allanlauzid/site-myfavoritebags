import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const REMOVE_BG_KEY = Deno.env.get("REMOVE_BG_KEY")!;
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-admin-password",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const JSON_HEADERS = { ...CORS_HEADERS, "content-type": "application/json" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  if (req.headers.get("x-admin-password") !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "missing image" }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const upstreamForm = new FormData();
    upstreamForm.append("image_file", file, file.name);
    upstreamForm.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": REMOVE_BG_KEY },
      body: upstreamForm,
    });

    if (!response.ok) {
      const detail = await response.text();
      return new Response(JSON.stringify({ error: "remove.bg failed", detail }), {
        status: 502,
        headers: JSON_HEADERS,
      });
    }

    return new Response(await response.arrayBuffer(), {
      headers: { ...CORS_HEADERS, "content-type": "image/png", "cache-control": "no-store" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
