import { useCallback, useEffect, useState } from 'react'
import Modal from '../../../shared/components/Modal.jsx'
import MensagemStatus from '../../../shared/components/MensagemStatus.jsx'
import FormChip from './FormChip.jsx'
import FormAparelho from './FormAparelho.jsx'
import FormNovoAparelho from './FormNovoAparelho.jsx'
import Fotos from './Fotos.jsx'
import Historico from './Historico.jsx'
import { abrirFicha, desvincular, excluirAparelho, excluirChip, vincular } from '../services/controle-api.js'

/**
 * Ficha de um chip (com o celular dele, se tiver) ou de um celular sem chip.
 * alvo = { chip } ou { aparelho }. celularesSemChip: para ligar um celular já cadastrado ao chip.
 */
export default function FichaItem({ alvo, usuario, centrosCusto, celularesSemChip, onFechar, onMudou }) {
  const [ficha, setFicha] = useState(null)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [alvoAtual] = useState(alvo)
  const [cadastrandoCelular, setCadastrandoCelular] = useState(false)
  const [celularParaLigar, setCelularParaLigar] = useState('')

  const carregar = useCallback(async () => {
    const r = await abrirFicha(alvoAtual)
    if (r.sucesso) {
      setFicha(r)
      setErro('')
    } else {
      setErro(r.erro)
    }
  }, [alvoAtual])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Resultado de qualquer ação: mostra a mensagem, recarrega a ficha e a lista. */
  async function depois(r, textoOk = 'Gravado.') {
    if (!r.sucesso) {
      setMensagem('')
      setErro(r.erro || 'Não deu certo.')
      return false
    }
    setErro('')
    setMensagem(r.mensagem || (Array.isArray(r.mudancas) && r.mudancas.length === 0 ? 'Nada mudou.' : textoOk))
    await carregar()
    onMudou()
    return true
  }

  const perguntarMotivo = (pergunta) => {
    const motivo = window.prompt(pergunta)
    return motivo === null ? null : motivo.trim()
  }

  async function separar() {
    const motivo = perguntarMotivo('O celular sai deste chip e fica no mesmo centro de custo, como celular sem chip. Motivo (opcional):')
    if (motivo !== null) await depois(await desvincular(ficha.chip.numero, motivo), 'Celular separado do chip.')
  }
  async function ligar() {
    if (!celularParaLigar) return
    if (await depois(await vincular(ficha.chip.numero, Number(celularParaLigar)), 'Celular ligado ao chip.')) setCelularParaLigar('')
  }
  async function apagarCelular() {
    const motivo = perguntarMotivo('Excluir o celular e as fotos dele? Isso não tem volta. Motivo:')
    if (motivo === null) return
    const r = await excluirAparelho(ficha.aparelho.id, motivo)
    if (!r.sucesso) return depois(r)
    onMudou()
    if (ficha.chip) await depois(r, 'Celular excluído.')
    else onFechar()
  }
  async function apagarChip() {
    const motivo = perguntarMotivo('Excluir este chip da plataforma (ex.: linha cancelada na TIM)? Motivo:')
    if (motivo === null) return
    const r = await excluirChip(ficha.chip.numero, motivo)
    if (!r.sucesso) return depois(r)
    onMudou()
    onFechar()
  }
  async function celularCriado(r) {
    if (await depois(r, 'Celular cadastrado. Agora tire as fotos.')) setCadastrandoCelular(false)
  }

  const titulo = ficha
    ? ficha.chip
      ? `Chip ${ficha.chip.numeroFormatado}`
      : `Celular sem chip nº ${ficha.aparelho.id}`
    : 'Carregando...'
  const ligaveis = celularesSemChip.filter((c) => !ficha || !ficha.chip || usuario.gestor || c.centro_custo === ficha.chip.centro_custo)

  return (
    <Modal titulo={titulo} onFechar={onFechar}>
      <MensagemStatus tipo="erro">{erro}</MensagemStatus>
      <MensagemStatus tipo="sucesso">{mensagem}</MensagemStatus>
      {!ficha && !erro && <p className="vazio">Carregando...</p>}
      {ficha && (
        <>
          {ficha.chip && (
            <section className="secao">
              <h3>Chip e quem usa</h3>
              <FormChip chip={ficha.chip} nomeCc={ficha.nome_cc} usuario={usuario} centrosCusto={centrosCusto} onResultado={(r) => depois(r)} />
            </section>
          )}

          <section className="secao">
            <h3>Celular</h3>
            {ficha.aparelho ? (
              <>
                <FormAparelho
                  aparelho={ficha.aparelho}
                  temChip={Boolean(ficha.chip)}
                  nomeCc={ficha.nome_cc}
                  usuario={usuario}
                  centrosCusto={centrosCusto}
                  onResultado={(r) => depois(r)}
                />
                <h4>Fotos do estado do celular</h4>
                <Fotos aparelhoId={ficha.aparelho.id} fotos={ficha.fotos} usuario={usuario} onResultado={(r) => depois(r, 'Foto apagada.')} />
                <div className="acoes acoes-rodape">
                  {ficha.chip && (
                    <button type="button" className="botao botao-discreto" onClick={separar}>
                      Separar o celular deste chip
                    </button>
                  )}
                  {usuario.gestor && (
                    <button type="button" className="botao botao-perigo" onClick={apagarCelular}>
                      Excluir celular
                    </button>
                  )}
                </div>
              </>
            ) : cadastrandoCelular ? (
              <FormNovoAparelho numeroChip={ficha.chip.numero} centrosCusto={centrosCusto} onResultado={celularCriado} onCancelar={() => setCadastrandoCelular(false)} />
            ) : (
              <>
                <p className="vazio">Este chip está sem celular (só chip).</p>
                <div className="acoes">
                  <button type="button" className="botao" onClick={() => setCadastrandoCelular(true)}>
                    Cadastrar o celular deste chip
                  </button>
                </div>
                {ligaveis.length > 0 && (
                  <div className="campos ligar-celular">
                    <label className="campo">
                      <span>Ou ligar um celular que já está cadastrado sem chip</span>
                      <select value={celularParaLigar} onChange={(e) => setCelularParaLigar(e.target.value)}>
                        <option value="">Escolha o celular</option>
                        {ligaveis.map((c) => (
                          <option key={c.id} value={c.id}>
                            nº {c.id} - {[c.marca, c.modelo].filter(Boolean).join(' ')} {c.imei ? `(IMEI ${c.imei})` : ''} - {c.centro_custo || 'sem CC'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className="botao" onClick={ligar} disabled={!celularParaLigar}>
                      Ligar ao chip
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="secao">
            <h3>Histórico</h3>
            <Historico itens={ficha.historico} />
          </section>

          {ficha.chip && usuario.gestor && (
            <div className="acoes acoes-rodape">
              <button type="button" className="botao botao-perigo" onClick={apagarChip}>
                Excluir chip
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
