import { useEffect, useState } from 'react'
import MensagemStatus from '../shared/components/MensagemStatus.jsx'
import ListaControle from '../modules/controle/components/ListaControle.jsx'
import Equipe from '../modules/equipe/Equipe.jsx'
import ImportarExportar from '../modules/planilhas/ImportarExportar.jsx'
import Pedidos from '../modules/pedidos/Pedidos.jsx'
import { AbaRateio } from '../modules/telefonia/index.js'
import { chamarApi } from '../shared/lib/api.js'

// Supervisor vê só as duas primeiras; a TI vê todas
const ABAS = [
  { id: 'controle', rotulo: 'Controle de Chips' },
  { id: 'pedidos', rotulo: 'Pedidos para a TI' },
  { id: 'rateio', rotulo: 'Rateio TIM', gestor: true },
  { id: 'equipe', rotulo: 'Supervisores', gestor: true },
  { id: 'planilhas', rotulo: 'Importar / Exportar', gestor: true },
]

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('controle')
  // Abas já abertas continuam montadas: trocar de aba não perde o que estava na tela
  const [visitadas, setVisitadas] = useState(() => new Set(['controle']))
  // Sobe a cada mudança feita numa aba, para as outras recarregarem (ex.: pedido respondido)
  const [versao, setVersao] = useState(0)
  const mudou = () => setVersao((v) => v + 1)

  useEffect(() => {
    chamarApi('/eu').then((r) => (r.sucesso ? setUsuario(r.usuario) : setErro(r.erro)))
  }, [])

  function abrir(id) {
    setAba(id)
    setVisitadas((v) => new Set(v).add(id))
  }

  const papel = !usuario
    ? ''
    : usuario.gestor
      ? 'TI (gestor)'
      : usuario.ccs.length
        ? `Supervisor de ${usuario.ccs.length === 1 ? usuario.ccs[0] : `${usuario.ccs.length} centros de custo`}`
        : 'Sem centro de custo'
  const abas = ABAS.filter((a) => !a.gestor || (usuario && usuario.gestor))

  return (
    <div className="pagina">
      <header className="topo">
        <div>
          <h1>Celulares e Chips</h1>
          <p>Quem está com cada celular e chip da Videplast, por centro de custo</p>
        </div>
        {usuario && (
          <div className="quem">
            <strong>{usuario.nome || usuario.cracha}</strong>
            <span>{papel}</span>
          </div>
        )}
      </header>

      <MensagemStatus tipo="erro">{erro}</MensagemStatus>
      {!usuario && !erro && <p className="vazio">Carregando...</p>}

      {usuario && !usuario.gestor && usuario.ccs.length === 0 && (
        <section className="cartao">
          <h2>Você ainda não cuida de nenhum centro de custo</h2>
          <p className="explicacao">
            Peça para a TI cadastrar você como supervisor do seu centro de custo na plataforma. Depois disso, é só abrir
            esta página de novo.
          </p>
        </section>
      )}

      {usuario && (usuario.gestor || usuario.ccs.length > 0) && (
        <>
          <nav className="abas" role="tablist">
            {abas.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={aba === a.id}
                className={`aba${aba === a.id ? ' aba-ativa' : ''}`}
                onClick={() => abrir(a.id)}
              >
                {a.rotulo}
              </button>
            ))}
          </nav>
          <main className="conteudo">
            <div className="painel-aba" hidden={aba !== 'controle'}>
              <ListaControle usuario={usuario} versao={versao} onMudou={mudou} />
            </div>
            <div className="painel-aba" hidden={aba !== 'pedidos'}>
              {visitadas.has('pedidos') && <Pedidos usuario={usuario} versao={versao} onMudou={mudou} />}
            </div>
            {usuario.gestor && (
              <>
                <div className="painel-aba" hidden={aba !== 'rateio'}>
                  {visitadas.has('rateio') && <AbaRateio />}
                </div>
                <div className="painel-aba" hidden={aba !== 'equipe'}>
                  {visitadas.has('equipe') && <Equipe usuario={usuario} />}
                </div>
                <div className="painel-aba" hidden={aba !== 'planilhas'}>
                  {visitadas.has('planilhas') && <ImportarExportar />}
                </div>
              </>
            )}
          </main>
        </>
      )}
    </div>
  )
}
