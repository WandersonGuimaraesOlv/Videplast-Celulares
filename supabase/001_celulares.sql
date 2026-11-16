-- Celulares e Chips: tabelas da plataforma. Rodar UMA vez no SQL Editor do Supabase
-- (projeto "Videplast Rio Verde Project", o mesmo do Imobilizados). Pode rodar de novo sem estragar nada.
--
-- Só o backend da plataforma acessa estas tabelas, com a chave secret (que ignora o RLS).
-- RLS ligado e sem nenhuma política = ninguém de fora lê nem grava, nem com a chave pública.

-- Celulares (aparelhos). Quando o celular está ligado a um chip, quem usa / setor / CC vêm do chip.
create table if not exists public.cel_aparelhos (
  id bigint generated always as identity primary key,
  marca text not null default '',
  modelo text not null default '',
  imei text not null default '',
  patrimonio text not null default '',
  estado text not null default 'bom' check (estado in ('novo', 'bom', 'regular', 'ruim', 'quebrado')),
  situacao text not null default 'em_uso' check (situacao in ('em_uso', 'reserva', 'manutencao', 'descartado')),
  filial integer not null default 1005,
  centro_custo text not null default '',
  responsavel text not null default '',
  responsavel_cracha text not null default '',
  setor text not null default '',
  observacao text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por text not null default ''
);
create unique index if not exists cel_aparelhos_imei_unico on public.cel_aparelhos (imei) where imei <> '';

-- Chips (linhas da operadora). O CC do chip é o que vale no rateio da fatura.
create table if not exists public.cel_chips (
  numero text primary key check (numero ~ '^[0-9]{10,11}$'),
  operadora text not null default 'TIM',
  plano text not null default '',
  situacao text not null default 'ativo' check (situacao in ('ativo', 'reserva', 'cancelado')),
  filial integer not null default 1005,
  centro_custo text not null default '',
  responsavel text not null default '',
  responsavel_cracha text not null default '',
  setor text not null default '',
  aparelho_id bigint unique references public.cel_aparelhos (id) on delete set null,
  observacao text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por text not null default ''
);
create index if not exists cel_chips_centro_custo on public.cel_chips (centro_custo);
create index if not exists cel_aparelhos_centro_custo on public.cel_aparelhos (centro_custo);

-- Fotos do estado do celular (o arquivo fica no Storage, bucket celulares-fotos)
create table if not exists public.cel_fotos (
  id bigint generated always as identity primary key,
  aparelho_id bigint not null references public.cel_aparelhos (id) on delete cascade,
  caminho text not null,
  enviado_por text not null default '',
  criado_em timestamptz not null default now()
);
create index if not exists cel_fotos_aparelho on public.cel_fotos (aparelho_id, criado_em desc);

-- Histórico: quem mudou o quê e quando (chips, celulares, supervisores e gestores)
create table if not exists public.cel_historico (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('chip', 'aparelho', 'supervisor', 'gestor')),
  chave text not null,
  acao text not null,
  mudancas jsonb not null default '[]'::jsonb,
  motivo text not null default '',
  quem_cracha text not null default '',
  quem_nome text not null default '',
  quando timestamptz not null default now()
);
create index if not exists cel_historico_item on public.cel_historico (tipo, chave, quando desc);

-- Supervisor de cada centro de custo (um crachá pode cuidar de vários CCs)
create table if not exists public.cel_supervisores (
  cracha text not null,
  nome text not null default '',
  centro_custo text not null,
  criado_em timestamptz not null default now(),
  primary key (cracha, centro_custo)
);

-- Gestores (TI): veem tudo, trocam CC, cadastram e excluem, cuidam dos supervisores e fazem o rateio
create table if not exists public.cel_gestores (
  cracha text primary key,
  nome text not null default '',
  criado_em timestamptz not null default now()
);

alter table public.cel_aparelhos enable row level security;
alter table public.cel_chips enable row level security;
alter table public.cel_fotos enable row level security;
alter table public.cel_historico enable row level security;
alter table public.cel_supervisores enable row level security;
alter table public.cel_gestores enable row level security;

-- Bucket privado das fotos (até 5 MB por foto; a tela já reduz para menos de 1 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('celulares-fotos', 'celulares-fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Primeiro gestor: o crachá de quem instala (troque se não for o seu). Os outros entram pela tela "Supervisores".
insert into public.cel_gestores (cracha, nome) values ('16348', '') on conflict (cracha) do nothing;

-- Conferência: deve mostrar as 6 tabelas, o bucket e 1 gestor
select 'tabelas' as item, count(*)::text as valor from information_schema.tables
 where table_schema = 'public' and table_name like 'cel\_%'
union all select 'bucket', count(*)::text from storage.buckets where id = 'celulares-fotos'
union all select 'gestores', count(*)::text from public.cel_gestores;
