import { useEffect, useMemo, useState } from 'react'
import MensagemStatus from '../shared/components/MensagemStatus.jsx'
import ListaControle from '../modules/controle/components/ListaControle.jsx'
import useControle from '../modules/controle/hooks/useControle.js'
import { celularesDe, chipsDe, pedidosAbertos } from '../modules/controle/lib/itens.js'
import Equipe from '../modules/equipe/Equipe.jsx'
import ImportarExportar from '../modules/planilhas/ImportarExportar.jsx'
import Pedidos from '../modules/pedidos/Pedidos.jsx'
import { AbaRateio } from '../modules/telefonia/index.js'
import { chamarApi } from '../shared/lib/api.js'

// Supervisor vê as três primeiras; a TI vê todas
const ABAS = [
  { id: 'chips', rotulo: 'Chips' },
  { id: 'celulares', rotulo: 'Celulares' },
  { id: 'pedidos', rotulo: 'Pedidos para a TI' },
  { id: 'rateio', rotulo: 'Rateio TIM', gestor: true },
  { id: 'equipe', rotulo: 'Supervisores', gestor: true },
  { id: 'planilhas', rotulo: 'Importar / Exportar', gestor: true },
]

// A última aba aberta fica guardada só neste navegador (se o navegador bloquear, abre em Chips)
const CHAVE_ABA = 'celulares-e-chips:aba'
function abaGuardada() {
  try {
    return window.localStorage.getItem(CHAVE_ABA) || 'chips'
  } catch {
    return 'chips'
  }
}
function guardarAba(id) {
  try {
    window.localStorage.setItem(CHAVE_ABA, id)
  } catch {
    // sem problema: só não lembra a aba
  }
}

function IconeCelular() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  )
}

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState(abaGuardada)
  // Abas já abertas continuam montadas: trocar de aba não perde o que estava na tela
  const [visitadas, setVisitadas] = useState(() => new Set([abaGuardada()]))
  // Sobe a cada mudança gravada, para as listas recarregarem
  const [versao, setVersao] = useState(0)
  const mudou = () => setVersao((v) => v + 1)

  useEffect(() => {
    chamarApi('/eu').then((r) => (r.sucesso ? setUsuario(r.usuario) : setErro(r.erro)))
  }, [])

  const liberado = Boolean(usuario && (usuario.gestor || usuario.ccs.length > 0))
  const controle = useControle(liberado, versao)
  const contadores = useMemo(
    () => ({
      chips: chipsDe(controle.linhas).length,
      celulares: celularesDe(controle.linhas).length,
      pedidos: pedidosAbertos(controle.linhas),
    }),
    [controle.linhas]
  )

  const abas = ABAS.filter((a) => !a.gestor || (usuario && usuario.gestor))
  const abaAtual = abas.some((a) => a.id === aba) ? aba : 'chips'
  const montar = (id) => abaAtual === id || visitadas.has(id)

  function abrir(id) {
    setAba(id)
    setVisitadas((v) => new Set(v).add(id))
    guardarAba(id)
  }

  const papel = !usuario
    ? ''
    : usuario.gestor
      ? 'TI (gestor)'
      : usuario.ccs.length
        ? `Supervisor de ${usuario.ccs.length === 1 ? usuario.ccs[0] : `${usuario.ccs.length} centros de custo`}`
        : 'Sem centro de custo'

  return (
    <>
      <header className="topo">
        <div className="topo-conteudo">
          <a className="marca" href="/" title="Voltar ao Portal de Aplicações">
            <span className="marca-icone">
              <IconeCelular />
            </span>
            <span className="marca-texto">
              <strong>Celulares e Chips</strong>
              <small>Videplast · quem está com cada celular e chip</small>
            </span>
          </a>
          {usuario && (
            <div className="quem">
              <strong>{usuario.nome || usuario.cracha}</strong>
              <span>{papel}</span>
            </div>
          )}
        </div>
        {liberado && (
          <nav className="abas" role="tablist">
            <div className="abas-conteudo">
              {abas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={abaAtual === a.id}
                  className={`aba${abaAtual === a.id ? ' aba-ativa' : ''}`}
                  onClick={() => abrir(a.id)}
                >
                  {a.rotulo}
                  {contadores[a.id] > 0 && (
                    <span className={`aba-contador${a.id === 'pedidos' ? ' aba-contador-alerta' : ''}`}>{contadores[a.id]}</span>
                  )}
                </button>
              ))}
            </div>
          </nav>
        )}
      </header>

      <div className="pagina">
        <MensagemStatus tipo="erro">{erro}</MensagemStatus>
        {!usuario && !erro && <p className="vazio">Carregando...</p>}

        {usuario && !liberado && (
          <section className="cartao">
            <h2>Você ainda não cuida de nenhum centro de custo</h2>
            <p className="explicacao">
              Peça para a TI cadastrar você como supervisor do seu centro de custo na plataforma. Depois disso, é só abrir esta
              página de novo.
            </p>
          </section>
        )}

        {liberado && (
          <main className="conteudo">
            <div className="painel-aba" hidden={abaAtual !== 'chips'}>
              {montar('chips') && <ListaControle modo="chips" usuario={usuario} controle={controle} onMudou={mudou} />}
            </div>
            <div className="painel-aba" hidden={abaAtual !== 'celulares'}>
              {montar('celulares') && <ListaControle modo="celulares" usuario={usuario} controle={controle} onMudou={mudou} />}
            </div>
            <div className="painel-aba" hidden={abaAtual !== 'pedidos'}>
              {montar('pedidos') && <Pedidos usuario={usuario} controle={controle} versao={versao} onMudou={mudou} />}
            </div>
            {usuario.gestor && (
              <>
                <div className="painel-aba" hidden={abaAtual !== 'rateio'}>
                  {montar('rateio') && <AbaRateio />}
                </div>
                <div className="painel-aba" hidden={abaAtual !== 'equipe'}>
                  {montar('equipe') && <Equipe usuario={usuario} />}
                </div>
                <div className="painel-aba" hidden={abaAtual !== 'planilhas'}>
                  {montar('planilhas') && <ImportarExportar />}
                </div>
              </>
            )}
          </main>
        )}
      </div>
    </>
  )
}
