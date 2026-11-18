// Rótulos e formatos usados em várias telas.

export const TIPOS = {
  celular_chip: 'Celular + chip',
  so_chip: 'Só chip',
  so_celular: 'Só celular',
}

export const ESTADOS = [
  ['novo', 'Novo'],
  ['bom', 'Bom'],
  ['regular', 'Regular (marcas de uso)'],
  ['ruim', 'Ruim (trincado, falhando)'],
  ['quebrado', 'Quebrado'],
]

export const SITUACOES_APARELHO = [
  ['em_uso', 'Em uso'],
  ['reserva', 'Reserva (guardado)'],
  ['manutencao', 'Em manutenção'],
  ['descartado', 'Descartado'],
]

export const SITUACOES_CHIP = [
  ['ativo', 'Ativo'],
  ['reserva', 'Reserva'],
  ['cancelado', 'Cancelado'],
]

/** Pedidos para a TI: [tipo, rótulo, explicação]. */
export const TIPOS_PEDIDO = [
  ['devolver', 'Devolver para a TI', 'O setor não precisa mais ou ninguém está usando.'],
  ['reposicao', 'Reposição do chip', 'Chip com defeito, quebrado ou perdido: precisa de um chip novo no mesmo número.'],
  ['perda', 'Perda ou roubo', 'O chip ou o celular sumiu. A TI bloqueia a linha e o aparelho.'],
  ['troca_aparelho', 'Celular com defeito', 'Precisa trocar ou consertar o celular.'],
  ['outro', 'Outro pedido', 'Qualquer outra coisa que a TI precise resolver.'],
]

export const STATUS_PEDIDO = [
  ['aberto', 'Aberto'],
  ['em_andamento', 'Em andamento'],
  ['concluido', 'Concluído'],
  ['recusado', 'Recusado'],
]

/** Rótulo de um valor numa lista [valor, rótulo]. */
export const rotulo = (lista, valor) => (lista.find(([v]) => v === valor) || [valor, valor || '—'])[1]

/** ISO → "16/11/2026 09:32" no horário de Brasília. */
export const formatarData = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : ''

/** Minúsculas, sem acento: para a busca. */
export const paraBusca = (texto) =>
  String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** "64999990001" → "(64) 99999-0001" */
export const formatarTelefone = (numero) => {
  const m = /^(\d{2})(\d{4,5})(\d{4})$/.exec(String(numero || ''))
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : numero || ''
}
