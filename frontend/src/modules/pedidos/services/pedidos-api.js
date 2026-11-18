import { chamarApi, enviarJson } from '../../../shared/lib/api.js'

export const listarPedidos = (somenteAbertos = false) => chamarApi(`/pedidos${somenteAbertos ? '?abertos=sim' : ''}`)

/** dados = { tipo, descricao, chip } ou { tipo, descricao, aparelho } */
export const criarPedido = (dados) => enviarJson('/pedidos', 'POST', dados)

/** Só TI: status = aberto | em_andamento | concluido | recusado */
export const responderPedido = (id, status, resposta = '') => enviarJson(`/pedidos/${id}`, 'PUT', { status, resposta })
