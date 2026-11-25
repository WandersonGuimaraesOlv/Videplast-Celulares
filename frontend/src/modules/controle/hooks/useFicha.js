import { useCallback, useEffect, useState } from 'react'
import { abrirFicha } from '../services/controle-api.js'

/** window.prompt que devolve null se a pessoa cancelar, ou o texto sem espaços nas pontas. */
export function perguntarMotivo(pergunta) {
  const motivo = window.prompt(pergunta)
  return motivo === null ? null : motivo.trim()
}

/**
 * Ficha de um chip ({ chip }) ou de um celular ({ aparelho }).
 * depois(r) trata o resultado de qualquer ação: mostra a mensagem, recarrega a ficha e avisa as listas (onMudou).
 */
export default function useFicha({ chip, aparelho }, onMudou, avisoInicial = '') {
  const [ficha, setFicha] = useState(null)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState(avisoInicial)

  const carregar = useCallback(async () => {
    const r = await abrirFicha({ chip, aparelho })
    if (r.sucesso) {
      setFicha(r)
      setErro('')
    } else {
      setErro(r.erro)
    }
  }, [chip, aparelho])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function depois(r, textoOk = 'Gravado.') {
    if (!r.sucesso) {
      setMensagem('')
      setErro(r.erro || 'Não deu certo.')
      return false
    }
    setErro('')
    setMensagem(r.mensagem || (Array.isArray(r.mudancas) && r.mudancas.length === 0 ? 'Nada mudou.' : textoOk))
    await carregar()
    onMudou()
    return true
  }

  return { ficha, erro, mensagem, depois }
}
