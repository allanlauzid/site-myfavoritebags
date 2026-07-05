-- ─── Seed inicial — dados que já estavam no site em data/products-*.js ──────
-- Só roda uma vez (na primeira vez que você fizer `supabase db push`).

insert into public.bags (name, cat, price, promo, status, is_new, favorite, img, tags, occasion, sort_order) values
  ('Matelassê Noir Chain',        'shoulder', 'R$ 899', null,      'available',    true,  true,  'webp/bag-01.png', '{Couro,"Edição Limitada"}', 'ocasiao-especial', 1),
  ('Tote Caramelo Signature',     'tote',     'R$ 459', null,      'available',    false, false, 'webp/bag-02.png', '{Couro}',                   'dia-a-dia',        2),
  ('Satchel Vermelha Alça Curta', 'mini',     'R$ 649', null,      'sold_out',     false, false, 'webp/bag-03.png', '{}',                         'ocasiao-especial', 3),
  ('Bucket Camurça Areia',        'shoulder', 'R$ 529', null,      'available',    true,  false, 'webp/bag-04.png', '{Presente}',                 'presente',         4),
  ('Croco Esmeralda Chain',       'shoulder', 'R$ 799', null,      'coming_soon',  true,  false, 'webp/bag-05.png', '{"Edição Limitada"}',        'ocasiao-especial', 5),
  ('Flap Branca Estruturada',     'mini',     'R$ 569', null,      'available',    false, false, 'webp/bag-06.png', '{}',                         'dia-a-dia',        6),
  ('Aeterna Azul Marinho',        'mini',     'R$ 689', 'R$ 599',  'available',    false, false, 'webp/bag-07.png', '{Promoção}',                 'ocasiao-especial', 7),
  ('Hobo Rosé Suave',             'shoulder', 'R$ 419', null,      'sold_out',     false, false, 'webp/bag-08.png', '{}',                         'dia-a-dia',        8),
  ('Tote Aubrey Lona & Couro',    'tote',     'R$ 489', null,      'available',    false, false, 'webp/bag-09.png', '{Presente}',                 'presente',         9),
  ('Clutch Prata Cristais',       'clutch',   'R$ 379', null,      'coming_soon',  true,  false, 'webp/bag-10.png', '{"Edição Limitada"}',        'ocasiao-especial', 10)
on conflict do nothing;

insert into public.looks (name, cat, price, promo, status, is_new, img, tags, occasion, sort_order) values
  ('Pulseira Riviera Cristal', 'pulseira', 'R$ 459', null,     'available',   true,  'webp/look-01.png', '{"Edição Limitada"}', 'ocasiao-especial', 1),
  ('Anel Safira Halo',        'anel',     'R$ 389', null,     'available',   true,  'webp/look-02.png', '{Presente}',          'presente',         2),
  ('Colar Pérola Dourada',    'colar',    'R$ 269', null,     'sold_out',    false, 'webp/look-03.png', '{}',                  'dia-a-dia',        3),
  ('Brinco Esmeralda Gota',   'brinco',   'R$ 329', null,     'coming_soon', false, 'webp/look-04.png', '{"Edição Limitada"}', 'ocasiao-especial', 4),
  ('Colar Elos Dourado',      'colar',    'R$ 249', 'R$ 199', 'available',   false, 'webp/look-05.png', '{Promoção}',          'dia-a-dia',        5),
  ('Pulseira Bracelete Rosé', 'pulseira', 'R$ 299', null,     'sold_out',    false, 'webp/look-06.png', '{}',                  'ocasiao-especial', 6),
  ('Anel Rubi Vintage',       'anel',     'R$ 419', null,     'available',   false, 'webp/look-07.png', '{Presente}',          'presente',         7)
on conflict do nothing;

insert into public.site_settings (key, value) values
  ('match_visibility', '"hidden"'),
  ('admin_password_hash', 'null')
on conflict (key) do nothing;
