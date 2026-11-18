import { useCallback, useEffect, useMemo, useState } from 'react'
import MensagemStatus from '../../shared/components/MensagemStatus.jsx'
import FichaItem from '../controle/components/FichaItem.jsx'
import { STATUS_PEDIDO, TIPOS_PEDIDO, formatarData, rotulo } from '../../shared/lib/textos.js'
import { listarPedidos, responderPedido } from './services/pedidos-api.js'
import { listarControle } from '../controle/services/controle-api.js'

const ABERTOS = ['aberto', 'em_andamento']

/**
 * Aba "Pedidos": a TI vê todos e responde (em andamento, concluído, recusado);
 * o supervisor acompanha os pedidos dos CCs dele.
 */
export default function Pedidos({ usuario, versao = 0, onMudou }) {
  const [pedidos, setPedidos] = useState([])
  // Para a ficha aberta daqui: CCs que a pessoa pode escolher e celulares sem chip
  const [controle, setControle] = useState({ centrosCusto: [], celularesSemChip: [] })
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [verFechados, setVerFechados] = useState(false)
  const [aberto, setAberto] = useState(null)

  const carregar = useCallback(async () => {
    const [r, c] = await Promise.all([listarPedidos(false), listarControle()])
    if (r.sucesso) {
      setPedidos(r.pedidos)
      setErro('')
    } else {
      setErro(r.erro)
    }
    if (c.sucesso) {
      setControle({
        centrosCusto: c.centrosCusto,
        celularesSemChip: c.linhas.filter((l) => l.tipo === 'so_celular').map((l) => ({ ...l.aparelho, centro_custo: l.centro_custo })),
      })
    }
    setCarregando(false)
  }, [])
  useEffect(() => {
    carregar()
  }, [carregar, versao])

  const visiveis = useMemo(() => pedidos.filter((p) => verFechados || ABERTOS.includes(p.status)), [pedidos, verFechados])
  const qtdAbertos = pedidos.filter((p) => ABERTOS.includes(p.status)).length

  async function responder(p, status) {
    let resposta = ''
    if (status === 'concluido' || status === 'recusado') {
      const texto = window.prompt(
        status === 'concluido' ? 'O que a TI fez? (ex.: chip recolhido, linha bloqueada na TIM)' : 'Por que o pedido foi recusado?'
      )
      if (texto === null) return
      resposta = texto.trim()
    }
    const r = await responderPedido(p.id, status, resposta)
    if (r.sucesso) {
      setErro('')
      setMensagem(`Pedido nº ${p.id}: ${rotulo(STATUS_PEDIDO, status).toLowerCase()}.`)
      onMudou?.()
    } else {
      setMensagem('')
      setErro(r.erro)
    }
  }

  return (
    <section className="cartao">
      <div className="cabecalho-cartao">
        <h2>Pedidos para a TI {qtdAbertos > 0 && <span className="selo selo-pedido-aberto">{qtdAbertos} aberto(s)</span>}</h2>
        <label className="sem-quebra">
          <input type="checkbox" checked={verFechados} onChange={(e) => setVerFechados(e.target.checked)} /> Mostrar os já resolvidos
        </label>
      </div>
      <p className="explicacao">
        {usuario.gestor
          ? 'Pedidos dos supervisores. O pedido não muda o cadastro sozinho: resolva na ficha (e na TIM) e depois marque como concluído, dizendo o que foi feito.'
          : 'Pedidos dos seus centros de custo. Para fazer um pedido, abra o chip ou o celular no Controle de Chips e clique em "Fazer pedido para a TI".'}
      </p>
      <MensagemStatus tipo="erro">{erro}</MensagemStatus>
      <MensagemStatus tipo="sucesso">{mensagem}</MensagemStatus>
      {carregando && <p className="vazio">Carregando...</p>}
      {!carregando && !erro && visiveis.length === 0 && <p className="vazio">{verFechados ? 'Nenhum pedido ainda.' : 'Nenhum pedido aberto.'}</p>}

      <ul className="lista-pedidos">
        {visiveis.map((p) => (
          <li key={p.id} className={`pedido pedido-${p.status}`}>
            <div className="pedido-topo">
              <strong>
                nº {p.id} · {p.tipoRotulo || rotulo(TIPOS_PEDIDO, p.tipo)}
              </strong>
              <span className={`selo selo-pedido-${p.status}`}>{p.statusRotulo || rotulo(STATUS_PEDIDO, p.status)}</span>
            </div>
            <div className="pedido-linha">
              {p.numeroFormatado ? `Chip ${p.numeroFormatado}` : `Celular nº ${p.aparelho_id}`}
              {p.responsavel && ` · ${p.responsavel}`} · <span className="codigo">{p.centro_custo || 'sem CC'}</span>
            </div>
            <div className="pedido-linha">
              Pedido por {p.pedido_por} em {formatarData(p.criado_em)}
            </div>
            {p.descricao && <div className="pedido-linha">"{p.descricao}"</div>}
            {p.resposta && (
              <div className="pedido-resposta">
                Resposta da TI{p.resolvido_por ? ` (${p.resolvido_por}, ${formatarData(p.resolvido_em)})` : ''}: {p.resposta}
              </div>
            )}
            <div className="acoes">
              <button type="button" className="botao botao-discreto" onClick={() => setAberto(p.numero_chip ? { chip: p.numero_chip } : { aparelho: p.aparelho_id })}>
                Abrir ficha
              </button>
              {usuario.gestor && ABERTOS.includes(p.status) && (
                <>
                  {p.status === 'aberto' && (
                    <button type="button" className="botao botao-discreto" onClick={() => responder(p, 'em_andamento')}>
                      Em andamento
                    </button>
                  )}
                  <button type="button" className="botao" onClick={() => responder(p, 'concluido')}>
                    Concluir
                  </button>
                  <button type="button" className="botao botao-perigo" onClick={() => responder(p, 'recusado')}>
                    Recusar
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {aberto && (
        <FichaItem
          alvo={aberto}
          usuario={usuario}
          centrosCusto={controle.centrosCusto}
          celularesSemChip={controle.celularesSemChip}
          onFechar={() => setAberto(null)}
          onMudou={() => onMudou?.()}
        />
      )}
    </section>
  )
}
