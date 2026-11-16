import { useState } from 'react'
import { enviarRateioTelefonia } from '../services/telefonia-api.js'

export function useRateioTelefonia() {
  const [carregando, setCarregando] = useState(false)
  const [rateio, setRateio] = useState(null)
  const [erro, setErro] = useState('')

  async function processar(fatura, ccValorGeral = '') {
    setCarregando(true)
    setErro('')
    setRateio(null)
    const resposta = await enviarRateioTelefonia(fatura, ccValorGeral)
    if (resposta.sucesso) setRateio(resposta)
    else setErro(resposta.erro || 'Erro ao calcular o rateio de telefonia.')
    setCarregando(false)
  }

  // Trocou a fatura ou o campo: o rateio na tela deixa de valer
  function limpar() {
    setRateio(null)
    setErro('')
  }

  return { carregando, rateio, erro, processar, limpar }
}
