import { enviarFormulario } from '../../../shared/lib/api.js'

/**
 * Fatura TIM (PDF) → rateio por centro de custo com os chips cadastrados na plataforma,
 * com a planilha em base64. ccValorGeral (opcional): CC que recebe inteiro o valor da fatura
 * que não é de nenhuma linha (ex.: multa).
 */
export function enviarRateioTelefonia(fatura, ccValorGeral = '') {
  const formData = new FormData()
  formData.append('fatura', fatura)
  if (ccValorGeral) formData.append('ccValorGeral', ccValorGeral)
  return enviarFormulario('/rateio', formData)
}
