import { useEffect } from 'react'

/**
 * Janela por cima da página (no celular ocupa a tela toda). Esc ou o X fecham.
 * onVoltar (opcional) mostra a seta para voltar à janela anterior.
 */
export default function Modal({ titulo, subtitulo, onFechar, onVoltar, children }) {
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', tecla)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = ''
    }
  }, [onFechar])

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-topo">
          {onVoltar && (
            <button type="button" className="botao-voltar" onClick={onVoltar} aria-label="Voltar" title="Voltar">
              ‹
            </button>
          )}
          <div className="modal-titulo">
            <h2>{titulo}</h2>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          <button type="button" className="botao-fechar" onClick={onFechar} aria-label="Fechar" title="Fechar">
            ×
          </button>
        </div>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  )
}
