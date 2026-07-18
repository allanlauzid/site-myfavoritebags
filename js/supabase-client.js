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
    // Versões redimensionadas da imagem principal (geradas no upload via canvas),
    // já formatadas como valor pronto pro atributo srcset ("url 480w, url 800w, ...").
    // Produtos antigos, salvos antes dessa mudança, não têm essa coluna preenchida —
    // nesse caso o card usa só `img` normalmente (ver renderProducts/cardHtml).
    imgSrcset: row.img_srcset || '',
    tags: row.tags || [],
    occasion: row.occasion || null,
    order: row.sort_order,
    desc: row.desc || '',
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
    img_srcset: p.imgSrcset || null,
    tags: p.tags || [],
    occasion: p.occasion || null,
    sort_order: p.order ?? 0,
    desc: p.desc || '',
  };
}

// ── Gemini — gera uma descrição curta de bolsa a partir da FOTO real da
// peça (mais nome/categoria/preço como contexto). `image` é obrigatória:
// uma data URL (bolsa nova, ainda não publicada) ou a URL pública da foto já
// salva (bolsa existente). O texto volta pra revisão do admin, nada é salvo.
async function sbGenerateDescription(name, cat, price, image) {
  if (!image) throw new Error('Escolha a foto da bolsa antes de gerar a descrição.');
  const data = await sbAdminWrite(null, 'generate_description', { name, cat, price, image });
  return data?.description || '';
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
  const uploadFile = await prepareRemoveBgUpload(file);
  const form = new FormData();
  form.append('image', uploadFile);
  const res = await fetch(`${FN_URL}/remove-bg`, {
    method: 'POST',
    headers: { 'x-admin-password': getAdminPassword() },
    body: form,
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.detail || json.error || 'Falha ao remover o fundo');
  }
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Reduz arquivos muito grandes antes de enviá-los ao remove.bg. Isso evita
// timeout da Edge Function sem alterar a proporção da foto.
async function prepareRemoveBgUpload(file, maxSide = 1000) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = objectUrl;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(
      value => value ? resolve(value) : reject(new Error('Falha ao preparar a imagem.')),
      'image/webp', .88
    ));
    const name = (file.name || 'produto').replace(/\.[^.]+$/, '') + '-remove-bg.webp';
    return new File([blob], name, { type:'image/webp' });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Envia uma imagem (data URL base64, já aprovada pelo admin) pro Storage do
// Supabase e devolve a URL pública definitiva pra salvar em bags.img/looks.img.
async function sbUploadImage(base64DataUrl, filename) {
  const data = await sbAdminWrite('bags', 'upload_image', { base64: base64DataUrl, filename });
  return data.url;
}

// ── Imagens responsivas (srcset) ────────────────────────────────────────────
// Larguras de exibição real dos cards do catálogo (.pcard-img), conferidas no
// CSS de index.html/looks.html: grid de 1 coluna em telas bem pequenas (até
// ~92vw), 2 colunas até ~1100px (até ~46vw) e 3 colunas no desktop (até
// ~30vw, ~260-450px de largura de coluna). Os breakpoints abaixo cobrem essa
// faixa sem gerar tamanhos maiores que o necessário.
const RESPONSIVE_IMAGE_WIDTHS = [480, 800, 1200];

// Gera, via <canvas>, versões redimensionadas reais de uma imagem (data URL),
// respeitando a proporção original. Nunca "inventa" um tamanho maior que a
// imagem de origem — larguras >= largura original são simplesmente ignoradas.
// Se o navegador não suportar canvas/webp ou algo falhar, devolve [] (o
// chamador cai de volta pro upload de uma imagem única, comportamento atual).
async function generateResizedImageVariants(dataUrl, widths = RESPONSIVE_IMAGE_WIDTHS, quality = 0.85) {
  try {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return [];
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('Não foi possível carregar a imagem para redimensionar.'));
      im.src = dataUrl;
    });
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    if (!naturalWidth || !naturalHeight) return [];

    const out = [];
    for (const width of widths) {
      if (width >= naturalWidth) continue; // não faz sentido "upscalar" a imagem original
      const height = Math.round(naturalHeight * (width / naturalWidth));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(img, 0, 0, width, height);
      let resizedDataUrl;
      try {
        resizedDataUrl = canvas.toDataURL('image/webp', quality);
      } catch (err) {
        continue; // navegador sem suporte a toDataURL nesse formato — pula essa variante
      }
      // Alguns navegadores sem suporte real a webp devolvem silenciosamente um
      // PNG (ou um data URL vazio) em vez de lançar erro — descarta esse caso.
      if (!resizedDataUrl || !resizedDataUrl.startsWith('data:image/webp')) continue;
      out.push({ width, dataUrl: resizedDataUrl });
    }
    return out;
  } catch (err) {
    return [];
  }
}

// Faz upload da imagem original mais (melhor esforço) suas versões
// redimensionadas geradas no navegador. Cada entrada do srcset corresponde a
// um arquivo real, efetivamente enviado ao Storage — nada é fabricado.
// Devolve { url, srcset } onde `srcset` já vem pronta no formato do atributo
// HTML srcset ("url1 480w, url2 800w, ...") ou '' se nenhuma variante extra
// pôde ser gerada/enviada (fallback silencioso pro comportamento antigo).
async function sbUploadImageResponsive(base64DataUrl, filename) {
  const url = await sbUploadImage(base64DataUrl, filename);
  let srcset = '';
  try {
    const variants = await generateResizedImageVariants(base64DataUrl);
    if (variants.length) {
      const baseName = String(filename || 'imagem').replace(/\.[^.]+$/, '');
      const uploaded = [];
      for (const variant of variants) {
        // Sequencial (não Promise.all) pra não sobrecarregar a Edge Function
        // com uploads simultâneos demais numa única ação do admin.
        const variantUrl = await sbUploadImage(variant.dataUrl, `${baseName}-${variant.width}w.webp`);
        uploaded.push(`${variantUrl} ${variant.width}w`);
      }
      srcset = uploaded.join(', ');
    }
  } catch (err) {
    // Fallback silencioso: fica só com a imagem original.
    srcset = '';
  }
  return { url, srcset };
}

// ── Galeria de imagens (Storage) — upload com nome exato, listar, apagar ───
async function sbUploadGalleryImage(base64DataUrl, filename) {
  const data = await sbAdminWrite(null, 'upload_image', { base64: base64DataUrl, filename, exactName: true });
  return data; // { url, path }
}
async function sbListGalleryImages() {
  const data = await sbAdminWrite(null, 'list_images', {});
  return data || [];
}
async function sbDeleteGalleryImage(path) {
  return sbAdminWrite(null, 'delete_image', { path });
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
