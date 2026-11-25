import { useState } from 'react'
import Modal from '../../../shared/components/Modal.jsx'
import MensagemStatus from '../../../shared/components/MensagemStatus.jsx'
import Dado from './Dado.jsx'
import FormChip from './FormChip.jsx'
import FormNovoAparelho from './FormNovoAparelho.jsx'
import Historico from './Historico.jsx'
import PedidosDoItem from '../../pedidos/components/PedidosDoItem.jsx'
import useFicha, { perguntarMotivo } from '../hooks/useFicha.js'
import { CLASSE_ESTADO, CLASSE_SITUACAO_CHIP, curto, nomeCelular } from '../lib/itens.js'
import { ESTADOS, SITUACOES_CHIP, rotulo } from '../../../shared/lib/textos.js'
import { desvincular, excluirChip, vincular } from '../services/controle-api.js'

/** Ficha do chip: quem usa, CC, plano, o celular em que ele está (se estiver), pedidos à TI e histórico do chip. */
export default function FichaChip({ numero, usuario, centrosCusto, celularesSemChip, onAbrir, onVoltar, onFechar, onMudou }) {
  const { ficha, erro, mensagem, depois } = useFicha({ chip: numero }, onMudou)
  const [cadastrando, setCadastrando] = useState(false)
  const [celularParaLigar, setCelularParaLigar] = useState('')

  const chip = ficha && ficha.chip
  const celular = ficha && ficha.aparelho

  async function separar() {
    const motivo = perguntarMotivo('O celular sai deste chip e fica no mesmo centro de custo, como celular sem chip. Motivo (opcional):')
    if (motivo !== null) await depois(await desvincular(chip.numero, motivo), 'Celular separado do chip.')
  }
  async function ligar() {
    if (!celularParaLigar) return
    if (await depois(await vincular(chip.numero, Number(celularParaLigar)), 'Celular ligado ao chip.')) setCelularParaLigar('')
  }
  async function celularCriado(r) {
    if (!r.sucesso) return depois(r)
    setCadastrando(false)
    onMudou()
    // Vai direto para a ficha do celular novo, onde ficam as fotos
    onAbrir({ aparelho: r.aparelho.id, aviso: 'Celular cadastrado e ligado ao chip. Agora tire as fotos do estado dele.' })
  }
  async function apagar() {
    const motivo = perguntarMotivo('Excluir este chip da plataforma (ex.: linha cancelada na TIM)? Motivo:')
    if (motivo === null) return
    const r = await excluirChip(chip.numero, motivo)
    if (!r.sucesso) return depois(r)
    onMudou()
    if (onVoltar) onVoltar()
    else onFechar()
  }

  return (
    <Modal
      titulo={chip ? `Chip ${chip.numeroFormatado}` : 'Chip'}
      subtitulo={chip ? chip.responsavel || 'Sem responsável' : ''}
      onFechar={onFechar}
      onVoltar={onVoltar}
    >
      <MensagemStatus tipo="erro">{erro}</MensagemStatus>
      <MensagemStatus tipo="sucesso">{mensagem}</MensagemStatus>
      {!ficha && !erro && <p className="vazio">Carregando...</p>}
      {chip && (
        <>
          <div className="ficha-resumo">
            <Dado rotulo="Quem usa" valor={chip.responsavel || 'Sem responsável'} extra={chip.responsavel_cracha ? `Crachá ${chip.responsavel_cracha}` : ''} />
            <Dado rotulo="Setor" valor={chip.setor || '—'} />
            <Dado rotulo="Centro de custo" valor={chip.centro_custo || 'Sem CC'} extra={ficha.nome_cc} />
            <Dado rotulo="Plano" valor={chip.plano || '—'} extra={chip.operadora} />
            <Dado
              rotulo="Situação"
              valor={<span className={`selo ${CLASSE_SITUACAO_CHIP[chip.situacao] || ''}`}>{rotulo(SITUACOES_CHIP, chip.situacao)}</span>}
            />
          </div>

          <section className="secao secao-vinculo">
            <h3>Celular deste chip</h3>
            {celular ? (
              <div className="vinculo">
                <div className="vinculo-info">
                  <strong>{nomeCelular(celular)}</strong>
                  <span>
                    <span className={`selo ${CLASSE_ESTADO[celular.estado] || ''}`}>{curto(rotulo(ESTADOS, celular.estado))}</span>
                    {celular.imei && <span className="codigo"> IMEI {celular.imei}</span>}
                  </span>
                </div>
                <div className="acoes">
                  <button type="button" className="botao" onClick={() => onAbrir({ aparelho: celular.id })}>
                    Abrir ficha do celular
                  </button>
                  <button type="button" className="botao botao-discreto" onClick={separar}>
                    Separar do chip
                  </button>
                </div>
              </div>
            ) : cadastrando ? (
              <FormNovoAparelho numeroChip={chip.numero} centrosCusto={centrosCusto} onResultado={celularCriado} onCancelar={() => setCadastrando(false)} />
            ) : (
              <>
                <p className="vazio">Este chip não está em nenhum celular da empresa.</p>
                <div className="acoes">
                  <button type="button" className="botao" onClick={() => setCadastrando(true)}>
                    Cadastrar o celular deste chip
                  </button>
                </div>
                {celularesSemChip.length > 0 && (
                  <div className="campos ligar">
                    <label className="campo">
                      <span>Ou ligar um celular já cadastrado que está sem chip</span>
                      <select value={celularParaLigar} onChange={(e) => setCelularParaLigar(e.target.value)}>
                        <option value="">Escolha o celular</option>
                        {celularesSemChip.map((c) => (
                          <option key={c.id} value={c.id}>
                            {nomeCelular(c)}
                            {c.imei ? ` (IMEI ${c.imei})` : ''} - {c.responsavel || 'sem nome'} - {c.centro_custo || 'sem CC'}
                          </option>
                        ))}
                      </select>
                      <small>O celular passa a seguir quem usa e o centro de custo deste chip.</small>
                    </label>
                    <button type="button" className="botao" onClick={ligar} disabled={!celularParaLigar}>
                      Ligar ao chip
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="secao secao-pedidos">
            <h3>Pedidos para a TI</h3>
            <PedidosDoItem
              alvo={{ chip: chip.numero }}
              pedidos={ficha.pedidos || []}
              temChip
              temCelular={false}
              onResultado={(r) => depois(r, 'Pedido enviado para a TI.')}
            />
          </section>

          <section className="secao">
            <h3>Quem usa e dados do chip</h3>
            <FormChip chip={chip} nomeCc={ficha.nome_cc} usuario={usuario} centrosCusto={centrosCusto} onResultado={(r) => depois(r)} />
          </section>

          <details className="secao secao-recolhida">
            <summary>Histórico do chip</summary>
            <Historico itens={ficha.historico.filter((h) => h.tipo === 'chip')} />
          </details>

          {usuario.gestor && (
            <div className="acoes acoes-rodape">
              <button type="button" className="botao botao-perigo" onClick={apagar}>
                Excluir chip
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
