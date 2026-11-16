import { useState } from 'react'
import { reduzirFoto } from '../../../shared/lib/reduzir-foto.js'
import { formatarData } from '../../../shared/lib/textos.js'
import { enviarFoto, excluirFoto } from '../services/controle-api.js'

/** Fotos do estado do celular: tirar na hora (câmera do celular) ou escolher da galeria. */
export default function Fotos({ aparelhoId, fotos, usuario, onResultado }) {
  const [enviando, setEnviando] = useState(false)
  const [ampliada, setAmpliada] = useState(null)

  async function escolher(e) {
    const arquivos = [...e.target.files]
    e.target.value = ''
    if (!arquivos.length) return
    setEnviando(true)
    let ultimo = { sucesso: true }
    for (const arquivo of arquivos.slice(0, 6)) {
      try {
        ultimo = await enviarFoto(aparelhoId, await reduzirFoto(arquivo))
      } catch (erro) {
        ultimo = { sucesso: false, erro: erro.message }
      }
      if (!ultimo.sucesso) break
    }
    setEnviando(false)
    onResultado(ultimo.sucesso ? { sucesso: true, mensagem: 'Foto enviada.' } : ultimo)
  }

  async function apagar(foto) {
    if (!window.confirm('Apagar esta foto?')) return
    onResultado(await excluirFoto(foto.id))
  }

  const podeApagar = (foto) => usuario.gestor || String(foto.enviado_por || '').endsWith(`(${usuario.cracha})`)

  return (
    <div className="fotos">
      <div className="acoes">
        <label className={`botao${enviando ? ' botao-ocupado' : ''}`}>
          {enviando ? 'Enviando...' : 'Tirar foto'}
          <input type="file" accept="image/*" capture="environment" onChange={escolher} disabled={enviando} hidden />
        </label>
        <label className={`botao botao-discreto${enviando ? ' botao-ocupado' : ''}`}>
          Escolher da galeria
          <input type="file" accept="image/*" multiple onChange={escolher} disabled={enviando} hidden />
        </label>
      </div>
      {fotos.length === 0 ? (
        <p className="vazio">Nenhuma foto ainda. Fotografe a frente, o verso e a tela ligada.</p>
      ) : (
        <div className="galeria">
          {fotos.map((f) => (
            <figure key={f.id}>
              <button type="button" className="miniatura" onClick={() => setAmpliada(f)} title="Ampliar">
                <img src={f.url} alt={`Foto de ${formatarData(f.criado_em)}`} loading="lazy" />
              </button>
              <figcaption>
                {formatarData(f.criado_em)}
                {podeApagar(f) && (
                  <button type="button" className="link-perigo" onClick={() => apagar(f)}>
                    apagar
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {ampliada && (
        <div className="foto-ampliada" onClick={() => setAmpliada(null)} role="presentation">
          <img src={ampliada.url} alt="Foto ampliada" />
          <p>
            {formatarData(ampliada.criado_em)} · {ampliada.enviado_por} · toque para fechar
          </p>
        </div>
      )}
    </div>
  )
}
