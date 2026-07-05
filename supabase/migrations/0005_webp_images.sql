-- Troca as fotos de bags/looks de .png pra .webp (mesmos arquivos, já
-- publicados em webp/bag-XX.webp e webp/look-XX.webp).
update public.bags  set img = replace(img, '.png', '.webp')  where img like '%.png';
update public.looks set img = replace(img, '.png', '.webp') where img like '%.png';
