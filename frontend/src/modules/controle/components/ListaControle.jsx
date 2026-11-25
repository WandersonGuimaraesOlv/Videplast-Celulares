import { useMemo, useState } from 'react'
import MensagemStatus from '../../../shared/components/MensagemStatus.jsx'
import Modal from '../../../shared/components/Modal.jsx'
import FichaItem from './FichaItem.jsx'
import FormNovoChip from './FormNovoChip.jsx'
import FormNovoAparelho from './FormNovoAparelho.jsx'
import { ESTADOS, SITUACOES_APARELHO, SITUACOES_CHIP, rotulo } from '../../../shared/lib/textos.js'
import {
  CLASSE_ESTADO, CLASSE_SITUACAO_CELULAR, CLASSE_SITUACAO_CHIP, ESTADOS_RUINS,
  celularesDe, chipsDe, combinaBusca, curto, nomeCelular,
} from '../lib/itens.js'

/**
 * As duas listas da plataforma: "chips" (cada linha da TIM) e "celulares" (cada aparelho).
 * Nem todo chip está num celular e nem todo celular tem chip, por isso cada um tem o seu controle.
 * resumos: [id, rótulo, teste] — os números do topo, que também filtram a lista.
 */
const MODOS = {
  chips: {
    titulo: 'Chips',
    explicacao: 'Cada linha da TIM: quem usa, o centro de custo que paga e em qual celular está (se estiver em um).',
    itens: chipsDe,
    alvo: (l) => ({ chip: l.numero }),
    busca: 'Nome, setor, número ou CC',
    novo: 'Novo chip',
    resumos: [
      ['todos', 'Chips', () => true],
      ['com', 'Em um celular', (l) => Boolean(l.aparelho)],
      ['sem', 'Sem celular', (l) => !l.aparelho],
      ['fora', 'Reserva ou cancelado', (l) => l.chip.situacao !== 'ativo'],
      ['pedido', 'Com pedido à TI', (l) => (l.pedidos || []).length > 0],
    ],
    vazio: {
      gestor: 'Nenhum chip cadastrado ainda. Comece importando o Controle de Chips na aba "Importar / Exportar".',
      supervisor: 'Nenhum chip nos seus centros de custo.',
    },
  },
  celulares: {
    titulo: 'Celulares',
    explicacao: 'Cada aparelho da empresa: modelo, estado, fotos e quem usa. Celular com chip segue quem usa e o centro de custo do chip.',
    itens: celularesDe,
    alvo: (l) => ({ aparelho: l.aparelho.id }),
    busca: 'Nome, modelo, IMEI ou patrimônio',
    novo: 'Novo celular',
    resumos: [
      ['todos', 'Celulares', () => true],
      ['com', 'Com chip', (l) => Boolean(l.numero)],
      ['sem', 'Sem chip', (l) => !l.numero],
      ['ruins', 'Ruim ou quebrado', (l) => ESTADOS_RUINS.includes(l.aparelho.estado)],
      ['sem_foto', 'Sem foto', (l) => !l.aparelho.fotos],
    ],
    vazio: {
      gestor: 'Nenhum celular cadastrado ainda. Clique em "Novo celular" ou cadastre pela ficha de um chip.',
      supervisor: 'Nenhum celular nos seus centros de custo ainda. Clique em "Novo celular" para cadastrar os do seu setor.',
    },
  },
}

const FILTRO_INICIAL = { cc: '', resumo: 'todos', busca: '' }

/** Aba Chips ou Celulares. controle: dados de useControle (carregados uma vez para as duas abas). */
export default function ListaControle({ modo, usuario, controle, onMudou }) {
  const config = MODOS[modo]
  const { linhas, centrosCusto, carregando, erro, chipsSemCelular, celularesSemChip } = controle
  const [filtro, setFiltro] = useState(FILTRO_INICIAL)
  const [aberto, setAberto] = useState(null) // { chip } | { aparelho }
  const [novo, setNovo] = useState(false)
  const [aviso, setAviso] = useState('')

  const itens = useMemo(() => config.itens(linhas), [config, linhas])
  const doCc = useMemo(() => itens.filter((l) => !filtro.cc || l.centro_custo === filtro.cc), [itens, filtro.cc])
  const contagem = useMemo(() => Object.fromEntries(config.resumos.map(([id, , teste]) => [id, doCc.filter(teste).length])), [config, doCc])
  const visiveis = useMemo(() => {
    const [, , teste] = config.resumos.find(([id]) => id === filtro.resumo) || config.resumos[0]
    return doCc.filter((l) => teste(l) && combinaBusca(l, filtro.busca))
  }, [config, doCc, filtro.resumo, filtro.busca])
  // CCs do filtro: para a TI, só os que têm itens; para o supervisor, todos os dele
  const ccsDoFiltro = useMemo(() => {
    const comItens = new Set(itens.map((l) => l.centro_custo))
    return centrosCusto.filter((c) => !usuario.gestor || comItens.has(c.codigo))
  }, [itens, centrosCusto, usuario.gestor])
  const filtrando = Boolean(filtro.cc || filtro.busca || filtro.resumo !== 'todos')
  const podeCadastrar = modo === 'celulares' || usuario.gestor
  const mudar = (campo, valor) => setFiltro((f) => ({ ...f, [campo]: valor }))

  async function criado(r) {
    if (!r.sucesso) return setAviso(r.erro)
    setAviso('')
    setNovo(false)
    onMudou()
    setAberto(
      modo === 'chips'
        ? { chip: r.chip.numero }
        : { aparelho: r.aparelho.id, aviso: 'Celular cadastrado. Agora tire as fotos do estado dele.' }
    )
  }

  return (
    <section className="cartao">
      <div className="cabecalho-cartao">
        <div>
          <h2>{config.titulo}</h2>
          <p className="explicacao">{config.explicacao}</p>
        </div>
        {podeCadastrar && (
          <button type="button" className="botao botao-primario botao-novo" onClick={() => setNovo(true)}>
            + {config.novo}
          </button>
        )}
      </div>

      <div className="resumos" role="group" aria-label="Filtro rápido">
        {config.resumos.map(([id, texto]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filtro.resumo === id}
            className={`resumo-chip${filtro.resumo === id ? ' resumo-chip-ativo' : ''}`}
            onClick={() => mudar('resumo', filtro.resumo === id ? 'todos' : id)}
          >
            <strong>{carregando ? '…' : contagem[id]}</strong>
            <span>{texto}</span>
          </button>
        ))}
      </div>

      <div className="filtros">
        <label className="campo campo-busca">
          <span>Buscar</span>
          <input type="search" value={filtro.busca} onChange={(e) => mudar('busca', e.target.value)} placeholder={config.busca} />
        </label>
        <label className="campo">
          <span>Centro de custo</span>
          <select value={filtro.cc} onChange={(e) => mudar('cc', e.target.value)}>
            <option value="">{usuario.gestor ? 'Todos' : 'Todos os meus'}</option>
            {ccsDoFiltro.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.codigo} - {c.nome}
              </option>
            ))}
          </select>
        </label>
        {filtrando && (
          <button type="button" className="botao botao-discreto" onClick={() => setFiltro(FILTRO_INICIAL)}>
            Limpar filtros
          </button>
        )}
      </div>

      <MensagemStatus tipo="erro">{erro}</MensagemStatus>
      {carregando && <p className="vazio">Carregando...</p>}
      {!carregando && !erro && visiveis.length === 0 && (
        <p className="vazio">{itens.length === 0 ? config.vazio[usuario.gestor ? 'gestor' : 'supervisor'] : 'Nada encontrado com esses filtros.'}</p>
      )}
      {visiveis.length > 0 && (
        <>
          <p className="contagem">
            {visiveis.length === itens.length ? `${itens.length} ${config.titulo.toLowerCase()}` : `Mostrando ${visiveis.length} de ${itens.length}`}
          </p>
          {modo === 'chips' ? (
            <TabelaChips linhas={visiveis} onAbrir={(l) => setAberto(config.alvo(l))} />
          ) : (
            <TabelaCelulares linhas={visiveis} onAbrir={(l) => setAberto(config.alvo(l))} />
          )}
        </>
      )}

      {aberto && (
        <FichaItem
          alvo={aberto}
          usuario={usuario}
          centrosCusto={centrosCusto}
          chipsSemCelular={chipsSemCelular}
          celularesSemChip={celularesSemChip}
          onFechar={() => setAberto(null)}
          onMudou={onMudou}
        />
      )}
      {novo && (
        <Modal
          titulo={config.novo}
          onFechar={() => {
            setNovo(false)
            setAviso('')
          }}
        >
          <MensagemStatus tipo="erro">{aviso}</MensagemStatus>
          {modo === 'chips' ? (
            <FormNovoChip centrosCusto={centrosCusto} onResultado={criado} onCancelar={() => setNovo(false)} />
          ) : (
            <FormNovoAparelho centrosCusto={centrosCusto} chipsSemCelular={chipsSemCelular} onResultado={criado} onCancelar={() => setNovo(false)} />
          )}
        </Modal>
      )}
    </section>
  )
}

// ---------- Tabelas (no computador uma tabela; no celular cada linha vira um cartão, pelo CSS) ----------

function Pessoa({ l }) {
  return (
    <div className="duas-linhas">
      <strong>{l.responsavel || <span className="apagado">Sem responsável</span>}</strong>
      {l.setor && <small>{l.setor}</small>}
    </div>
  )
}

function CentroCusto({ l }) {
  return (
    <div className="duas-linhas">
      <span className="codigo">{l.centro_custo || 'sem CC'}</span>
      {l.nome_cc && <small>{l.nome_cc}</small>}
    </div>
  )
}

function SelosPedido({ l }) {
  if (!l.pedidos || l.pedidos.length === 0) return null
  return (
    <div className="item-pedidos">
      {l.pedidos.map((p) => (
        <span key={p.id} className="selo selo-pedido-aberto">
          Pedido à TI: {curto(p.tipoRotulo)}
        </span>
      ))}
    </div>
  )
}

function SeloEstado({ estado }) {
  return <span className={`selo ${CLASSE_ESTADO[estado] || ''}`}>{curto(rotulo(ESTADOS, estado))}</span>
}

function TabelaChips({ linhas, onAbrir }) {
  return (
    <table className="tabela-itens">
      <thead>
        <tr>
          <th>Número</th>
          <th>Quem usa</th>
          <th>Centro de custo</th>
          <th>Plano</th>
          <th>Celular</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.chave} className={l.aparelho ? '' : 'linha-sem-vinculo'} onClick={() => onAbrir(l)}>
            <td className="celula-titulo">
              <div className="titulo-item">
                <button type="button" className="link-item">
                  {l.numeroFormatado}
                </button>
                {l.chip.situacao !== 'ativo' && (
                  <span className={`selo ${CLASSE_SITUACAO_CHIP[l.chip.situacao] || ''}`}>{rotulo(SITUACOES_CHIP, l.chip.situacao)}</span>
                )}
              </div>
              <SelosPedido l={l} />
            </td>
            <td data-rotulo="Quem usa">
              <Pessoa l={l} />
            </td>
            <td data-rotulo="Centro de custo">
              <CentroCusto l={l} />
            </td>
            <td data-rotulo="Plano">{l.chip.plano || <span className="apagado">—</span>}</td>
            <td data-rotulo="Celular">
              {l.aparelho ? (
                <div className="duas-linhas">
                  <span>{nomeCelular(l.aparelho)}</span>
                  <span>
                    <SeloEstado estado={l.aparelho.estado} />
                  </span>
                </div>
              ) : (
                <span className="apagado">Sem celular</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TabelaCelulares({ linhas, onAbrir }) {
  return (
    <table className="tabela-itens">
      <thead>
        <tr>
          <th>Celular</th>
          <th>Quem usa</th>
          <th>Centro de custo</th>
          <th>Chip</th>
          <th>Estado</th>
          <th>Fotos</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => {
          const a = l.aparelho
          return (
            <tr key={l.chave} className={l.numero ? '' : 'linha-sem-vinculo'} onClick={() => onAbrir(l)}>
              <td className="celula-titulo">
                <div className="titulo-item">
                  <button type="button" className="link-item">
                    {nomeCelular(a)}
                  </button>
                  {a.situacao !== 'em_uso' && (
                    <span className={`selo ${CLASSE_SITUACAO_CELULAR[a.situacao] || ''}`}>{curto(rotulo(SITUACOES_APARELHO, a.situacao))}</span>
                  )}
                </div>
                {(a.patrimonio || a.imei) && <small className="codigo">{a.patrimonio ? `Patrimônio ${a.patrimonio}` : `IMEI ${a.imei}`}</small>}
                <SelosPedido l={l} />
              </td>
              <td data-rotulo="Quem usa">
                <Pessoa l={l} />
              </td>
              <td data-rotulo="Centro de custo">
                <CentroCusto l={l} />
              </td>
              <td data-rotulo="Chip">{l.numero ? <span className="sem-quebra">{l.numeroFormatado}</span> : <span className="apagado">Sem chip</span>}</td>
              <td data-rotulo="Estado">
                <span>
                  <SeloEstado estado={a.estado} />
                </span>
              </td>
              <td data-rotulo="Fotos">{a.fotos ? a.fotos : <span className="selo selo-atencao">Sem foto</span>}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
