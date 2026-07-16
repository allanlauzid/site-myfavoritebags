// ─── Cliente Supabase do site ────────────────────────────────────────────────
// Usa a publishable key (segura no navegador, só permite leitura via RLS).
// Toda escrita passa pelas Edge Functions (admin-write / remove-bg), que usam
// a senha do admin + a service_role key protegida no servidor.

const SUPABASE_URL = 'https://xlyqytdnfpzyxmifcthp.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kzOYP-tPrXQO_y5jlFRdFw_hGA-5tBa';

const FN_URL = `${SUPABASE_URL}/functions/v1`;

async function sbSelect(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=sort_order.asc`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Falha ao buscar ${table}: ${res.status}`);
  return res.json();
}

// Algumas linhas antigas do banco ficaram com a extensão errada depois da
// migração pra webp (ex: "webp/bag-01.png" apontando pra um arquivo que não
// existe mais, já que só existe "webp/bag-01.webp"). Corrige isso na leitura
// pra não depender de rodar uma migração de dados no banco.
function fixImgPath(img) {
  if (!img) return img;
  if (/^webp\//.test(img) && /\.(png|jpg|jpeg)$/i.test(img)) {
    return img.replace(/\.(png|jpg|jpeg)$/i, '.webp');
  }
  return img;
}

// Converte snake_case do banco (is_new, sort_order) para o formato camelCase
// que o restante do site já usa (isNew) — mantém o resto do código intacto.
function rowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    cat: row.cat,
    price: row.price,
    promo: row.promo || null,
    status: row.status,
    isNew: row.is_new,
    favorite: row.favorite ?? false,
    img: fixImgPath(row.img),
    tags: row.tags || [],
    occasion: row.occasion || null,
    order: row.sort_order,
  };
}

function productToRow(p) {
  return {
    id: typeof p.id === 'number' && p.id < 1e12 ? p.id : undefined, // ids novos vêm do banco
    name: p.name,
    cat: p.cat,
    price: p.price,
    promo: p.promo || null,
    status: p.status,
    is_new: !!p.isNew,
    favorite: !!p.favorite,
    img: p.img || null,
    tags: p.tags || [],
    occasion: p.occasion || null,
    sort_order: p.order ?? 0,
  };
}

async function sbFetchBags() {
  const rows = await sbSelect('bags');
  return rows.map(rowToProduct);
}

async function sbFetchLooks() {
  const rows = await sbSelect('looks');
  return rows.map(rowToProduct);
}

async function sbFetchSettings() {
  const rows = await sbSelect('site_settings');
  const out = {};
  rows.forEach(r => { out[r.key] = r.value; });
  return out;
}

// ── Escrita (admin) — sempre via Edge Function, nunca direto no banco ──────
function getAdminPassword() {
  // Reaproveita a senha já digitada no login do painel admin existente.
  return sessionStorage.getItem('mfbAdminPassword') || '';
}

async function sbAdminWrite(table, action, payload) {
  const res = await fetch(`${FN_URL}/admin-write`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: getAdminPassword(), table, action, payload }),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || `Falha ao gravar em ${table}`);
  return json.data;
}

async function sbUpsertBag(product) {
  return sbAdminWrite('bags', 'upsert', productToRow(product));
}
async function sbDeleteBag(id) {
  return sbAdminWrite('bags', 'delete', { id });
}
async function sbUpsertLook(product) {
  return sbAdminWrite('looks', 'upsert', productToRow(product));
}
async function sbDeleteLook(id) {
  return sbAdminWrite('looks', 'delete', { id });
}
async function sbSetSetting(key, value) {
  return sbAdminWrite('site_settings', 'set_setting', { key, value });
}

// ── remove.bg — upload + preview antes de salvar ────────────────────────────
// Retorna uma data URL (base64) com o fundo já removido. Nada é persistido
// aqui; o admin decide se salva o resultado ou tenta de novo.
async function sbRemoveBackground(file) {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`${FN_URL}/remove-bg`, {
    method: 'POST',
    headers: { 'x-admin-password': getAdminPassword() },
    body: form,
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || 'Falha ao remover o fundo');
  return json.image; // data:image/png;base64,...
}

// Envia uma imagem (data URL base64, já aprovada pelo admin) pro Storage do
// Supabase e devolve a URL pública definitiva pra salvar em bags.img/looks.img.
async function sbUploadImage(base64DataUrl, filename) {
  const data = await sbAdminWrite('bags', 'upload_image', { base64: base64DataUrl, filename });
  return data.url;
}

// ── Conversão para WebP — roda no navegador, sem precisar de servidor ──────
// Usada tanto no resultado do remove.bg quanto em fotos que ficam do jeito
// que foram enviadas (fundo não removido). Aceita PNG, JPG/JPEG (ou qualquer
// imagem que o navegador consiga decodificar) e devolve uma data URL .webp.
async function convertToWebp(source, quality = 0.9) {
  const dataUrl = (source instanceof File || source instanceof Blob)
    ? await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(source);
      })
    : source;

  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/webp', quality);
}
