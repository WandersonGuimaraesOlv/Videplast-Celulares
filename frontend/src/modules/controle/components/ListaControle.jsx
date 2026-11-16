import { useCallback, useEffect, useMemo, useState } from 'react'
import MensagemStatus from '../../../shared/components/MensagemStatus.jsx'
import Modal from '../../../shared/components/Modal.jsx'
import FichaItem from './FichaItem.jsx'
import FormNovoChip from './FormNovoChip.jsx'
import FormNovoAparelho from './FormNovoAparelho.jsx'
import { ESTADOS, TIPOS, formatarData, paraBusca, rotulo } from '../../../shared/lib/textos.js'
import { listarControle } from '../services/controle-api.js'

const CLASSE_ESTADO = { novo: 'selo-ok', bom: 'selo-ok', regular: 'selo-atencao', ruim: 'selo-ruim', quebrado: 'selo-ruim' }

/** Aba "Controle de Chips": quem está com cada chip e celular, por centro de custo. */
export default function ListaControle({ usuario }) {
  const [dados, setDados] = useState({ linhas: [], centrosCusto: [] })
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [filtro, setFiltro] = useState({ cc: '', tipo: '', busca: '' })
  const [aberto, setAberto] = useState(null) // { chip } | { aparelho }
  const [novo, setNovo] = useState('') // '' | 'chip' | 'celular'

  const carregar = useCallback(async () => {
    const r = await listarControle()
    if (r.sucesso) {
      setDados({ linhas: r.linhas, centrosCusto: r.centrosCusto })
      setErro('')
    } else {
      setErro(r.erro)
    }
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const doCc = useMemo(() => dados.linhas.filter((l) => !filtro.cc || l.centro_custo === filtro.cc), [dados.linhas, filtro.cc])
  const contagem = useMemo(() => {
    const c = { celular_chip: 0, so_chip: 0, so_celular: 0 }
    for (const l of doCc) c[l.tipo] += 1
    return c
  }, [doCc])
  const visiveis = useMemo(() => {
    const termo = paraBusca(filtro.busca.trim())
    const digitos = filtro.busca.replace(/\D/g, '')
    return doCc.filter((l) => {
      if (filtro.tipo && l.tipo !== filtro.tipo) return false
      if (!termo) return true
      const texto = paraBusca([l.responsavel, l.setor, l.centro_custo, l.nome_cc, l.aparelho && l.aparelho.marca, l.aparelho && l.aparelho.modelo].join(' '))
      return texto.includes(termo) || (digitos.length >= 3 && (l.numero.includes(digitos) || (l.aparelho && l.aparelho.imei.includes(digitos))))
    })
  }, [doCc, filtro.tipo, filtro.busca])
  const celularesSemChip = useMemo(
    () => dados.linhas.filter((l) => l.tipo === 'so_celular').map((l) => ({ ...l.aparelho, centro_custo: l.centro_custo })),
    [dados.linhas]
  )
  // CCs que aparecem no filtro: os que têm itens (e, para o supervisor, todos os dele)
  const ccsDoFiltro = useMemo(() => {
    const comItens = new Set(dados.linhas.map((l) => l.centro_custo))
    return dados.centrosCusto.filter((c) => !usuario.gestor || comItens.has(c.codigo))
  }, [dados, usuario.gestor])

  async function criado(r, alvo) {
    if (!r.sucesso) return setAviso(r.erro)
    setAviso('')
    setNovo('')
    await carregar()
    setAberto(alvo(r))
  }

  return (
    <section className="cartao">
      <div className="cabecalho-cartao">
        <h2>Controle de Chips</h2>
        <div className="acoes">
          {usuario.gestor && (
            <button type="button" className="botao" onClick={() => setNovo('chip')}>
              Novo chip
            </button>
          )}
          <button type="button" className="botao botao-discreto" onClick={() => setNovo('celular')}>
            Novo celular sem chip
          </button>
        </div>
      </div>

      <div className="resumo-fatura">
        {Object.entries(TIPOS).map(([tipo, texto]) => (
          <button
            key={tipo}
            type="button"
            className={`resumo-item resumo-botao${filtro.tipo === tipo ? ' resumo-info' : ''}`}
            onClick={() => setFiltro((f) => ({ ...f, tipo: f.tipo === tipo ? '' : tipo }))}
          >
            <span>{texto}</span>
            <strong>{contagem[tipo]}</strong>
          </button>
        ))}
      </div>

      <div className="filtros">
        <label className="campo">
          <span>Centro de custo</span>
          <select value={filtro.cc} onChange={(e) => setFiltro((f) => ({ ...f, cc: e.target.value }))}>
            <option value="">{usuario.gestor ? 'Todos' : 'Todos os meus'}</option>
            {ccsDoFiltro.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.codigo} - {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Buscar</span>
          <input
            type="search"
            value={filtro.busca}
            onChange={(e) => setFiltro((f) => ({ ...f, busca: e.target.value }))}
            placeholder="Nome, setor, número, modelo ou IMEI"
          />
        </label>
      </div>

      <MensagemStatus tipo="erro">{erro}</MensagemStatus>
      {carregando && <p className="vazio">Carregando...</p>}
      {!carregando && !erro && visiveis.length === 0 && (
        <p className="vazio">
          {dados.linhas.length === 0
            ? usuario.gestor
              ? 'Nenhum chip cadastrado ainda. Comece importando o Controle de Chips na aba "Importar / Exportar".'
              : 'Nenhum chip ou celular nos seus centros de custo ainda.'
            : 'Nada encontrado com esses filtros.'}
        </p>
      )}

      <div className="lista-itens">
        {visiveis.map((l) => (
          <button
            key={l.chave}
            type="button"
            className={`item item-${l.tipo}`}
            onClick={() => setAberto(l.numero ? { chip: l.numero } : { aparelho: l.aparelho.id })}
          >
            <div className="item-topo">
              <strong>{l.responsavel || 'Sem responsável'}</strong>
              <span className={`selo selo-${l.tipo}`}>{TIPOS[l.tipo]}</span>
            </div>
            <div className="item-linha">
              {l.setor || 'Setor não informado'} · <span className="codigo">{l.centro_custo || 'sem CC'}</span>
              {l.nome_cc && ` ${l.nome_cc}`}
            </div>
            {l.numero && <div className="item-linha">Chip {l.numeroFormatado}{l.chip.situacao !== 'ativo' && ` (${l.chip.situacao})`}</div>}
            {l.aparelho && (
              <div className="item-linha">
                {[l.aparelho.marca, l.aparelho.modelo].filter(Boolean).join(' ') || 'Celular'}{' '}
                <span className={`selo ${CLASSE_ESTADO[l.aparelho.estado] || ''}`}>{rotulo(ESTADOS, l.aparelho.estado).split(' (')[0]}</span>
                {l.aparelho.fotos > 0 ? ` · ${l.aparelho.fotos} foto(s)` : ' · sem foto'}
              </div>
            )}
            {l.atualizado_em && <div className="item-rodape">Atualizado em {formatarData(l.atualizado_em)}</div>}
          </button>
        ))}
      </div>

      {aberto && (
        <FichaItem
          alvo={aberto}
          usuario={usuario}
          centrosCusto={dados.centrosCusto}
          celularesSemChip={celularesSemChip}
          onFechar={() => setAberto(null)}
          onMudou={carregar}
        />
      )}
      {novo && (
        <Modal titulo={novo === 'chip' ? 'Novo chip' : 'Novo celular sem chip'} onFechar={() => { setNovo(''); setAviso('') }}>
          <MensagemStatus tipo="erro">{aviso}</MensagemStatus>
          {novo === 'chip' ? (
            <FormNovoChip centrosCusto={dados.centrosCusto} onResultado={(r) => criado(r, (x) => ({ chip: x.chip.numero }))} onCancelar={() => setNovo('')} />
          ) : (
            <FormNovoAparelho centrosCusto={dados.centrosCusto} onResultado={(r) => criado(r, (x) => ({ aparelho: x.aparelho.id }))} onCancelar={() => setNovo('')} />
          )}
        </Modal>
      )}
    </section>
  )
}
