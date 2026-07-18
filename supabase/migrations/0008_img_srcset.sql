-- ─── Imagens responsivas (srcset) ───────────────────────────────────────────
-- Adiciona a coluna que guarda as URLs das versões redimensionadas da imagem
-- principal (geradas no navegador via canvas, no momento do upload), já
-- formatadas como valor pronto pro atributo HTML srcset:
--   "https://.../produto-480w.webp 480w, https://.../produto-800w.webp 800w, ..."
-- Produtos cadastrados antes desta migração ficam com a coluna vazia/null e
-- continuam funcionando normalmente — o front usa `img` como fallback único
-- nesse caso (ver rowToProduct/cardHtml).

alter table public.bags  add column if not exists img_srcset text;
alter table public.looks add column if not exists img_srcset text;
