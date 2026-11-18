-- Celulares e Chips: pedidos dos supervisores para a TI (devolver, reposição de chip, perda, troca de celular).
-- COLE NO SQL EDITOR DO SUPABASE (no navegador), projeto "Videplast Rio Verde Project", e clique em Run.
-- Pode rodar de novo sem estragar nada.

create table if not exists public.cel_pedidos (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('devolver', 'reposicao', 'perda', 'troca_aparelho', 'outro')),
  numero_chip text not null default '',
  aparelho_id bigint references public.cel_aparelhos (id) on delete set null,
  centro_custo text not null default '',
  responsavel text not null default '',
  descricao text not null default '',
  status text not null default 'aberto' check (status in ('aberto', 'em_andamento', 'concluido', 'recusado')),
  resposta text not null default '',
  pedido_por text not null default '',
  pedido_por_cracha text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  resolvido_por text not null default '',
  resolvido_em timestamptz
);
create index if not exists cel_pedidos_status on public.cel_pedidos (status, criado_em desc);
create index if not exists cel_pedidos_chip on public.cel_pedidos (numero_chip);
create index if not exists cel_pedidos_aparelho on public.cel_pedidos (aparelho_id);

-- Só o backend acessa (chave secret); RLS ligado e sem políticas
alter table public.cel_pedidos enable row level security;

-- Conferência: deve mostrar pedidos = 0 (tabela criada e vazia)
select 'pedidos' as item, count(*)::text as valor from public.cel_pedidos;
