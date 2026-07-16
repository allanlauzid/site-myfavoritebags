-- ─── Remove todos os produtos (bolsas e looks) ──────────────────────────────
-- Esvazia as tabelas de catálogo a pedido — o site passa a mostrar 0 itens
-- até que novos produtos sejam cadastrados pelo painel admin.
-- Não mexe em site_settings nem no bucket de imagens do Storage.

delete from public.bags;
delete from public.looks;
