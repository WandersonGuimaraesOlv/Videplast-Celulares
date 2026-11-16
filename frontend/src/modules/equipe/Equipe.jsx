import { useCallback, useEffect, useState } from 'react'
import MensagemStatus from '../../shared/components/MensagemStatus.jsx'
import SeletorCc from '../controle/components/SeletorCc.jsx'
import { apagar, chamarApi, enviarJson } from '../../shared/lib/api.js'

/** Aba "Supervisores" (só TI): quem cuida de cada centro de custo, e quem é gestor. */
export default function Equipe({ usuario }) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [novo, setNovo] = useState({ cracha: '', cc: '', ccs: [] })
  const [novoGestor, setNovoGestor] = useState('')

  const carregar = useCallback(async () => {
    const r = await chamarApi('/equipe')
    if (r.sucesso) setDados(r)
    else setErro(r.erro)
  }, [])
  useEffect(() => {
    carregar()
  }, [carregar])

  async function depois(r, texto) {
    if (!r.sucesso) {
      setMensagem('')
      setErro(r.erro)
      return false
    }
    setErro('')
    setMensagem(texto)
    await carregar()
    return true
  }

  function incluirCc() {
    if (novo.cc && !novo.ccs.includes(novo.cc)) setNovo((n) => ({ ...n, ccs: [...n.ccs, n.cc], cc: '' }))
  }
  async function adicionar(e) {
    e.preventDefault()
    const ccs = novo.cc && !novo.ccs.includes(novo.cc) ? [...novo.ccs, novo.cc] : novo.ccs
    const r = await enviarJson('/supervisores', 'POST', { cracha: novo.cracha, ccs })
    if (await depois(r, r.sucesso ? `${r.supervisor.nome} agora cuida de ${r.supervisor.ccs.join(', ')}.` : '')) setNovo({ cracha: '', cc: '', ccs: [] })
  }
  async function remover(s, cc) {
    if (window.confirm(`Tirar ${cc} de ${s.nome}?`)) await depois(await apagar(`/supervisores/${s.cracha}/${cc}`), `${cc} saiu de ${s.nome}.`)
  }
  async function adicionarGestor(e) {
    e.preventDefault()
    const r = await enviarJson('/gestores', 'POST', { cracha: novoGestor })
    if (await depois(r, r.sucesso ? `${r.gestor.nome} agora é gestor.` : '')) setNovoGestor('')
  }
  async function removerGestor(g) {
    if (window.confirm(`Tirar o acesso de gestor de ${g.nome || g.cracha}?`)) await depois(await apagar(`/gestores/${g.cracha}`), 'Gestor removido.')
  }

  if (!dados) return <section className="cartao"><MensagemStatus tipo="erro">{erro}</MensagemStatus>{!erro && <p className="vazio">Carregando...</p>}</section>

  return (
    <>
      <section className="cartao">
        <h2>Supervisores por centro de custo</h2>
        <p className="explicacao">
          O supervisor vê e atualiza os chips e celulares dos CCs dele (quem usa, estado, fotos). Trocar o centro de custo
          continua só com a TI. Ele também precisa de acesso a "Celulares e Chips" no Portal de Acesso.
        </p>
        <MensagemStatus tipo="erro">{erro}</MensagemStatus>
        <MensagemStatus tipo="sucesso">{mensagem}</MensagemStatus>
        {dados.supervisores.length === 0 ? (
          <p className="vazio">Nenhum supervisor cadastrado ainda.</p>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Supervisor</th>
                  <th>Centros de custo</th>
                </tr>
              </thead>
              <tbody>
                {dados.supervisores.map((s) => (
                  <tr key={s.cracha}>
                    <td>
                      {s.nome || '—'} <span className="codigo">({s.cracha})</span>
                    </td>
                    <td>
                      <div className="etiquetas">
                        {s.ccs.map((c) => (
                          <span key={c.codigo} className="etiqueta" title={c.nome}>
                            {c.codigo} {c.nome && `- ${c.nome}`}
                            <button type="button" onClick={() => remover(s, c.codigo)} aria-label={`Tirar ${c.codigo}`}>
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form className="formulario bloco-novo" onSubmit={adicionar}>
          <h3>Adicionar supervisor (ou mais CCs para um supervisor)</h3>
          <div className="campos">
            <label className="campo campo-curto">
              <span>Crachá</span>
              <input inputMode="numeric" value={novo.cracha} onChange={(e) => setNovo((n) => ({ ...n, cracha: e.target.value.replace(/\D/g, '') }))} required />
            </label>
            <SeletorCc valor={novo.cc} onMudar={(cc) => setNovo((n) => ({ ...n, cc }))} centrosCusto={dados.centrosCusto} />
          </div>
          <div className="acoes">
            <button type="button" className="botao botao-discreto" onClick={incluirCc} disabled={!novo.cc}>
              + outro CC
            </button>
            {novo.ccs.map((cc) => (
              <span key={cc} className="etiqueta">
                {cc}
                <button type="button" onClick={() => setNovo((n) => ({ ...n, ccs: n.ccs.filter((x) => x !== cc) }))}>×</button>
              </span>
            ))}
          </div>
          <button type="submit" className="botao botao-primario" disabled={!novo.cracha || (!novo.cc && !novo.ccs.length)}>
            Gravar supervisor
          </button>
        </form>
      </section>

      <section className="cartao">
        <h2>Gestores (TI)</h2>
        <p className="explicacao">Gestor vê tudo, cadastra e exclui chips, troca centro de custo, importa a planilha e gera o rateio.</p>
        <ul className="lista-simples">
          {dados.gestores.map((g) => (
            <li key={g.cracha}>
              {g.nome || '—'} <span className="codigo">({g.cracha})</span>
              {g.cracha !== usuario.cracha && (
                <button type="button" className="link-perigo" onClick={() => removerGestor(g)}>
                  remover
                </button>
              )}
            </li>
          ))}
        </ul>
        <form className="campos bloco-novo" onSubmit={adicionarGestor}>
          <label className="campo campo-curto">
            <span>Crachá do novo gestor</span>
            <input inputMode="numeric" value={novoGestor} onChange={(e) => setNovoGestor(e.target.value.replace(/\D/g, ''))} />
          </label>
          <button type="submit" className="botao" disabled={!novoGestor}>
            Adicionar gestor
          </button>
        </form>
      </section>
    </>
  )
}
