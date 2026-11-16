import { chamarApi, enviarJson, enviarFormulario, apagar } from '../../../shared/lib/api.js'

const motivoNaUrl = (motivo) => (motivo ? `?motivo=${encodeURIComponent(motivo)}` : '')

export const listarControle = () => chamarApi('/controle')

export const abrirFicha = ({ chip, aparelho }) =>
  chamarApi(chip ? `/ficha?chip=${encodeURIComponent(chip)}` : `/ficha?aparelho=${encodeURIComponent(aparelho)}`)

export const criarChip = (dados) => enviarJson('/chips', 'POST', dados)
export const salvarChip = (numero, dados) => enviarJson(`/chips/${numero}`, 'PUT', dados)
export const excluirChip = (numero, motivo) => apagar(`/chips/${numero}${motivoNaUrl(motivo)}`)

export const criarAparelho = (dados) => enviarJson('/aparelhos', 'POST', dados)
export const salvarAparelho = (id, dados) => enviarJson(`/aparelhos/${id}`, 'PUT', dados)
export const excluirAparelho = (id, motivo) => apagar(`/aparelhos/${id}${motivoNaUrl(motivo)}`)

export const vincular = (numero, aparelhoId) => enviarJson(`/chips/${numero}/aparelho`, 'POST', { aparelho_id: aparelhoId })
export const desvincular = (numero, motivo) => apagar(`/chips/${numero}/aparelho${motivoNaUrl(motivo)}`)

export function enviarFoto(aparelhoId, blob) {
  const formData = new FormData()
  formData.append('foto', blob, 'foto.jpg')
  return enviarFormulario(`/aparelhos/${aparelhoId}/fotos`, formData)
}
export const excluirFoto = (id) => apagar(`/fotos/${id}`)

export const buscarPessoa = (cracha) => chamarApi(`/pessoas/${encodeURIComponent(cracha)}`)
