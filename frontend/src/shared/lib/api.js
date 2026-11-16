import { API_BASE } from '../../app/config.js'

/**
 * Chamada à API do backend. Sempre devolve { sucesso, ... } e nunca lança erro de rede,
 * para a tela mostrar a mensagem em vez de quebrar.
 */
export async function chamarApi(caminho, opcoes = {}) {
  try {
    const resposta = await fetch(`${API_BASE}${caminho}`, { credentials: 'same-origin', ...opcoes })
    const tipo = resposta.headers.get('content-type') || ''
    // Sessão do Portal vencida: o Nginx manda para a tela de login, que volta como HTML
    if (resposta.redirected || tipo.includes('text/html')) {
      return { sucesso: false, erro: 'Sua entrada no Portal de Acesso venceu. Recarregue a página (F5) para entrar de novo.' }
    }
    const corpo = await resposta.json().catch(() => null)
    if (!corpo) return { sucesso: false, erro: `Resposta inválida do servidor (HTTP ${resposta.status}).` }
    return corpo
  } catch {
    return { sucesso: false, erro: 'Não foi possível alcançar o servidor. Verifique a rede.' }
  }
}

export const enviarJson = (caminho, metodo, corpo) =>
  chamarApi(caminho, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo ?? {}) })

export const enviarFormulario = (caminho, formData) => chamarApi(caminho, { method: 'POST', body: formData })

export const apagar = (caminho) => chamarApi(caminho, { method: 'DELETE' })

/** Endereço completo de uma rota (para links de download). */
export const urlApi = (caminho) => `${API_BASE}${caminho}`
