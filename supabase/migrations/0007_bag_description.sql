-- Adiciona a coluna de descrição da bolsa (usada pelo CRUD e pelo botão
-- "Gerar descrição", que preenche esse campo via Gemini). Também aplicada em
-- looks, pra manter as duas tabelas com o mesmo formato.
alter table public.bags  add column if not exists "desc" text;
alter table public.looks add column if not exists "desc" text;
