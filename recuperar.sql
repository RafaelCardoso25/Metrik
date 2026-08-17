-- ═══════════════════════════════════════════════════════════════
--  METRIK — EXCLUÍDOS DA ABA RECUPERAR
--  Execute no Supabase (SQL Editor → New query → Run).
--  Seguro rodar mais de uma vez. Não altera nem apaga nada existente.
-- ═══════════════════════════════════════════════════════════════

create table if not exists recuperar_excluidos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nome_norm   text not null,          -- nome normalizado (sem acento/maiúsculas) p/ casar com planilhas futuras
  nome        text not null,          -- nome como aparece na planilha, para exibir na tela
  criado_em   timestamptz not null default now(),
  unique (empresa_id, nome_norm)
);

create index if not exists idx_recexcl_empresa on recuperar_excluidos(empresa_id);

-- RLS: cada usuário só acessa os dados das próprias empresas
alter table recuperar_excluidos enable row level security;

drop policy if exists recuperar_excluidos_own on recuperar_excluidos;
create policy recuperar_excluidos_own on recuperar_excluidos
  for all
  using (exists (select 1 from empresas e where e.id = recuperar_excluidos.empresa_id and e.usuario_id = auth.uid()))
  with check (exists (select 1 from empresas e where e.id = recuperar_excluidos.empresa_id and e.usuario_id = auth.uid()));
