-- ─── Storage: bucket público pras fotos de produto (bolsas e looks) ─────────
-- Upload só acontece via Edge Function (admin-write, com service_role) —
-- o bucket é público só pra LEITURA, então as imagens aparecem no site normal.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');

-- Nenhuma policy de insert/update/delete: só o service_role (dentro da Edge
-- Function admin-write) consegue gravar nesse bucket.
