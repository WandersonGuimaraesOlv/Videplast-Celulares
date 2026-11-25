// Chips e celulares a partir das linhas de /api/controle. Cada linha é um chip (com ou sem celular)
// ou um celular sem chip: a aba Chips usa as linhas que têm número, a aba Celulares as que têm aparelho.
import { paraBusca } from '../../../shared/lib/textos.js'

export const ESTADOS_RUINS = ['ruim', 'quebrado']

// Cores dos selos
export const CLASSE_ESTADO = { novo: 'selo-ok', bom: 'selo-ok', regular: 'selo-atencao', ruim: 'selo-ruim', quebrado: 'selo-ruim' }
export const CLASSE_SITUACAO_CHIP = { ativo: 'selo-ok', reserva: 'selo-atencao', cancelado: 'selo-ruim' }
export const CLASSE_SITUACAO_CELULAR = { em_uso: 'selo-ok', reserva: 'selo-atencao', manutencao: 'selo-atencao', descartado: 'selo-ruim' }

export const chipsDe = (linhas) => linhas.filter((l) => l.numero)
export const celularesDe = (linhas) => linhas.filter((l) => l.aparelho)

/** Chips que não estão em nenhum celular (para colocar num celular). */
export const chipsSemCelular = (linhas) =>
  linhas
    .filter((l) => l.tipo === 'so_chip')
    .map((l) => ({ numero: l.numero, numeroFormatado: l.numeroFormatado, responsavel: l.responsavel, centro_custo: l.centro_custo }))

/** Celulares sem chip (para ligar a um chip). */
export const celularesSemChip = (linhas) =>
  linhas.filter((l) => l.tipo === 'so_celular').map((l) => ({ ...l.aparelho, centro_custo: l.centro_custo, responsavel: l.responsavel }))

/** "Samsung Galaxy A15" (ou "Celular nº 12" quando não tem marca nem modelo). */
export const nomeCelular = (a) => (a ? [a.marca, a.modelo].filter(Boolean).join(' ') || `Celular nº ${a.id}` : '')

/** Pedidos à TI abertos, contados uma vez só (o mesmo pedido aparece no chip e no celular dele). */
export const pedidosAbertos = (linhas) => new Set(linhas.flatMap((l) => (l.pedidos || []).map((p) => p.id))).size

/** Busca por nome, setor, CC, marca e modelo; com 3 ou mais dígitos, também número do chip, IMEI e patrimônio. */
export function combinaBusca(l, busca) {
  const termo = paraBusca(String(busca || '').trim())
  if (!termo) return true
  const a = l.aparelho || {}
  if (paraBusca([l.responsavel, l.setor, l.centro_custo, l.nome_cc, a.marca, a.modelo, a.patrimonio].join(' ')).includes(termo)) return true
  const digitos = String(busca).replace(/\D/g, '')
  return digitos.length >= 3 && [l.numero, a.imei, a.patrimonio].some((v) => String(v || '').includes(digitos))
}

/** "Regular (marcas de uso)" → "Regular" */
export const curto = (texto) => String(texto || '').split(' (')[0]
