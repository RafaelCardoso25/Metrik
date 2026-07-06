-- ═══════════════════════════════════════════════════════════════
--  METRIK — MÓDULO GESTÃO DE CLIENTES & CONTAS
--  Execute este arquivo no Supabase (SQL Editor → New query → Run).
--  Pode rodar mais de uma vez sem problema (idempotente).
-- ═══════════════════════════════════════════════════════════════

-- ── Contas (PJ / PF) ──────────────────────────────────────────
create table if not exists contas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nome        text not null,
  tipo        text not null check (tipo in ('PJ','PF')),
  teto        numeric not null default 0,
  ordem       int not null default 0,
  criado_em   timestamptz not null default now()
);
create index if not exists idx_contas_empresa on contas(empresa_id);

-- ── Clientes (cadastro / regras permanentes) ──────────────────
create table if not exists clientes_gestao (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresas(id) on delete cascade,
  nome         text not null,
  nome_norm    text not null,                -- nome normalizado p/ matching da planilha
  tier         text not null default 'Classico' check (tier in ('Classico','Gold','Black')),
  tier_modo    text not null default 'auto'  check (tier_modo in ('auto','manual')),
  conta_id     uuid references contas(id) on delete set null,   -- conta fixa (se conta_modo = 'fixa')
  conta_modo   text not null default 'auto'  check (conta_modo in ('auto','fixa')),
  recorrencia  text not null default 'Mensal' check (recorrencia in ('Mensal','Avulso')),
  emite_nf     boolean not null default false,  -- emite nota fiscal → prioridade na PF até cobrir o custo mensal
  criado_em    timestamptz not null default now(),
  unique (empresa_id, nome_norm)
);
create index if not exists idx_cligestao_empresa on clientes_gestao(empresa_id);

-- ── Lançamentos mensais por cliente ───────────────────────────
create table if not exists clientes_lancamentos (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references empresas(id) on delete cascade,
  cliente_id       uuid not null references clientes_gestao(id) on delete cascade,
  chave            text not null,               -- 'AAAA-MM'
  mes              int  not null,
  ano              int  not null,
  faturamento      numeric not null default 0,
  custo            numeric not null default 0,  -- custo direto
  horas            numeric not null default 0,  -- horas de trabalho no mês
  conta_id         uuid references contas(id) on delete set null,  -- alocação do mês
  alocacao_manual  boolean not null default false, -- true = usuário arrastou; o motor não mexe
  criado_em        timestamptz not null default now(),
  unique (cliente_id, chave)
);
create index if not exists idx_clilanc_empresa on clientes_lancamentos(empresa_id);
create index if not exists idx_clilanc_chave on clientes_lancamentos(empresa_id, chave);

-- ── Despesas por conta ────────────────────────────────────────
create table if not exists despesas_contas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  conta_id    uuid not null references contas(id) on delete cascade,
  chave       text not null,                  -- 'AAAA-MM'
  descricao   text not null,
  tipo        text not null default 'variavel' check (tipo in ('fixo','variavel')),
  valor       numeric not null default 0,
  data        date,
  criado_em   timestamptz not null default now()
);
create index if not exists idx_despcontas_empresa on despesas_contas(empresa_id, chave);
-- origem da despesa: null = manual, 'metrik' = total vindo da planilha da página inicial,
-- 'planilha' = item importado da planilha de despesas na página de Custos
alter table despesas_contas add column if not exists origem text;

-- ── Configuração do módulo (por empresa) ──────────────────────
create table if not exists gestao_cfg (
  empresa_id      uuid primary key references empresas(id) on delete cascade,
  custo_hora      numeric not null default 90,
  pf_custo_padrao numeric not null default 0,  -- custo mensal padrão da PF (usado se o mês não tiver despesas lançadas)
  tier_regras     jsonb not null default '{"black":{"margem":75,"faturamento":7000,"recorrente":true},"gold":{"margem":70,"recorrente":true}}',
  imposto_faixas  jsonb not null default '[{"ate":60,"pct":6},{"ate":85,"pct":9},{"ate":100,"pct":13.5},{"ate":null,"pct":19}]',
  atualizado_em   timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════
--  RLS — cada usuário só acessa dados das próprias empresas
-- ═══════════════════════════════════════════════════════════════
alter table contas enable row level security;
alter table clientes_gestao enable row level security;
alter table clientes_lancamentos enable row level security;
alter table despesas_contas enable row level security;
alter table gestao_cfg enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['contas','clientes_gestao','clientes_lancamentos','despesas_contas','gestao_cfg'] loop
    execute format('drop policy if exists %I_own on %I', t, t);
    execute format($f$
      create policy %I_own on %I
      for all
      using (exists (select 1 from empresas e where e.id = %I.empresa_id and e.usuario_id = auth.uid()))
      with check (exists (select 1 from empresas e where e.id = %I.empresa_id and e.usuario_id = auth.uid()))
    $f$, t, t, t, t);
  end loop;
end $$;
