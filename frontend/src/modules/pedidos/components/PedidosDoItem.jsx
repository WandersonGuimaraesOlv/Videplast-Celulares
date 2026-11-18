import { useState } from 'react'
import { STATUS_PEDIDO, TIPOS_PEDIDO, formatarData, rotulo } from '../../../shared/lib/textos.js'
import { criarPedido } from '../services/pedidos-api.js'

const ABERTOS = ['aberto', 'em_andamento']

/**
 * Na ficha: os pedidos para a TI deste item e o botão para fazer um novo
 * (devolver, reposição do chip, perda/roubo, celular com defeito, outro).
 * alvo = { chip } ou { aparelho }; temChip/temCelular limitam os tipos que fazem sentido.
 */
export default function PedidosDoItem({ alvo, pedidos, temChip, temCelular, onResultado }) {
  const [abrindo, setAbrindo] = useState(false)
  const [tipo, setTipo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [enviando, setEnviando] = useState(false)

  const possiveis = TIPOS_PEDIDO.filter(([t]) => (t !== 'reposicao' || temChip) && (t !== 'troca_aparelho' || temCelular))
  const abertos = new Set(pedidos.filter((p) => ABERTOS.includes(p.status)).map((p) => p.tipo))

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true)
    const r = await criarPedido({ ...alvo, tipo, descricao })
    setEnviando(false)
    if (r.sucesso) {
      setAbrindo(false)
      setTipo('')
      setDescricao('')
      onResultado({ sucesso: true, mensagem: 'Pedido enviado para a TI.' })
    } else {
      onResultado(r)
    }
  }

  return (
    <div className="pedidos-item">
      {pedidos.length > 0 && (
        <ul className="lista-pedidos">
          {pedidos.map((p) => (
            <li key={p.id} className={`pedido pedido-${p.status}`}>
              <div className="pedido-topo">
                <strong>{p.tipoRotulo || rotulo(TIPOS_PEDIDO, p.tipo)}</strong>
                <span className={`selo selo-pedido-${p.status}`}>{p.statusRotulo || rotulo(STATUS_PEDIDO, p.status)}</span>
              </div>
              <div className="pedido-linha">
                Pedido nº {p.id} por {p.pedido_por} em {formatarData(p.criado_em)}
              </div>
              {p.descricao && <div className="pedido-linha">"{p.descricao}"</div>}
              {p.resposta && <div className="pedido-resposta">Resposta da TI: {p.resposta}</div>}
            </li>
          ))}
        </ul>
      )}

      {!abrindo ? (
        <button type="button" className="botao" onClick={() => setAbrindo(true)}>
          Fazer pedido para a TI
        </button>
      ) : (
        <form className="formulario" onSubmit={enviar}>
          <div className="opcoes-pedido">
            {possiveis.map(([valor, texto, explicacao]) => (
              <label key={valor} className={`opcao-pedido${tipo === valor ? ' opcao-marcada' : ''}${abertos.has(valor) ? ' opcao-bloqueada' : ''}`}>
                <input type="radio" name="tipo-pedido" value={valor} checked={tipo === valor} disabled={abertos.has(valor)} onChange={() => setTipo(valor)} />
                <span>
                  <strong>{texto}</strong>
                  <small>{abertos.has(valor) ? 'Já tem um pedido deste tipo aberto.' : explicacao}</small>
                </span>
              </label>
            ))}
          </div>
          <label className="campo">
            <span>Detalhes {tipo === 'outro' ? '(obrigatório)' : '(opcional)'}</span>
            <textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: o motorista saiu da empresa e o chip ficou na gaveta do setor" maxLength={500} />
          </label>
          <div className="acoes">
            <button type="submit" className="botao botao-primario" disabled={enviando || !tipo || (tipo === 'outro' && !descricao.trim())}>
              {enviando ? 'Enviando...' : 'Enviar para a TI'}
            </button>
            <button type="button" className="botao botao-discreto" onClick={() => setAbrindo(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
