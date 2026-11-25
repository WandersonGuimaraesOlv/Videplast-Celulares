import { useState } from 'react'
import Modal from '../../../shared/components/Modal.jsx'
import MensagemStatus from '../../../shared/components/MensagemStatus.jsx'
import Dado from './Dado.jsx'
import FormAparelho from './FormAparelho.jsx'
import Fotos from './Fotos.jsx'
import Historico from './Historico.jsx'
import PedidosDoItem from '../../pedidos/components/PedidosDoItem.jsx'
import useFicha, { perguntarMotivo } from '../hooks/useFicha.js'
import { CLASSE_ESTADO, CLASSE_SITUACAO_CELULAR, CLASSE_SITUACAO_CHIP, nomeCelular } from '../lib/itens.js'
import { ESTADOS, SITUACOES_APARELHO, SITUACOES_CHIP, rotulo } from '../../../shared/lib/textos.js'
import { desvincular, excluirAparelho, vincular } from '../services/controle-api.js'

/** Ficha do celular: modelo, estado, fotos, o chip que está nele (se tiver), pedidos à TI e histórico do celular. */
export default function FichaCelular({ id, aviso, usuario, centrosCusto, chipsSemCelular, onAbrir, onVoltar, onFechar, onMudou }) {
  const { ficha, erro, mensagem, depois } = useFicha({ aparelho: id }, onMudou, aviso)
  const [chipParaLigar, setChipParaLigar] = useState('')

  const celular = ficha && ficha.aparelho
  const chip = ficha && ficha.chip
  // Com chip, quem usa e o CC são os do chip
  const dono = chip || celular

  async function separar() {
    const motivo = perguntarMotivo('O celular sai do chip e fica no mesmo centro de custo, como celular sem chip. Motivo (opcional):')
    if (motivo !== null) await depois(await desvincular(chip.numero, motivo), 'Celular separado do chip.')
  }
  async function ligar() {
    if (!chipParaLigar) return
    if (await depois(await vincular(chipParaLigar, celular.id), 'Chip ligado ao celular.')) setChipParaLigar('')
  }
  async function apagar() {
    const motivo = perguntarMotivo('Excluir o celular e as fotos dele? Isso não tem volta. Motivo:')
    if (motivo === null) return
    const r = await excluirAparelho(celular.id, motivo)
    if (!r.sucesso) return depois(r)
    onMudou()
    if (onVoltar) onVoltar()
    else onFechar()
  }

  return (
    <Modal
      titulo={celular ? nomeCelular(celular) : 'Celular'}
      subtitulo={dono ? dono.responsavel || 'Sem responsável' : ''}
      onFechar={onFechar}
      onVoltar={onVoltar}
    >
      <MensagemStatus tipo="erro">{erro}</MensagemStatus>
      <MensagemStatus tipo="sucesso">{mensagem}</MensagemStatus>
      {!ficha && !erro && <p className="vazio">Carregando...</p>}
      {celular && (
        <>
          <div className="ficha-resumo">
            <Dado rotulo="Estado" valor={<span className={`selo ${CLASSE_ESTADO[celular.estado] || ''}`}>{rotulo(ESTADOS, celular.estado)}</span>} />
            <Dado
              rotulo="Situação"
              valor={<span className={`selo ${CLASSE_SITUACAO_CELULAR[celular.situacao] || ''}`}>{rotulo(SITUACOES_APARELHO, celular.situacao)}</span>}
            />
            <Dado rotulo="Quem usa" valor={dono.responsavel || 'Sem responsável'} extra={dono.setor} />
            <Dado rotulo="Centro de custo" valor={dono.centro_custo || 'Sem CC'} extra={ficha.nome_cc} />
            <Dado rotulo="IMEI" valor={celular.imei ? <span className="codigo">{celular.imei}</span> : '—'} />
            {celular.patrimonio && <Dado rotulo="Patrimônio" valor={celular.patrimonio} />}
          </div>

          <section className="secao secao-vinculo">
            <h3>Chip deste celular</h3>
            {chip ? (
              <div className="vinculo">
                <div className="vinculo-info">
                  <strong>{chip.numeroFormatado}</strong>
                  <span>
                    {chip.plano || 'Plano não informado'}{' '}
                    {chip.situacao !== 'ativo' && (
                      <span className={`selo ${CLASSE_SITUACAO_CHIP[chip.situacao] || ''}`}>{rotulo(SITUACOES_CHIP, chip.situacao)}</span>
                    )}
                  </span>
                  <small>Quem usa e o centro de custo deste celular seguem o chip.</small>
                </div>
                <div className="acoes">
                  <button type="button" className="botao" onClick={() => onAbrir({ chip: chip.numero })}>
                    Abrir ficha do chip
                  </button>
                  <button type="button" className="botao botao-discreto" onClick={separar}>
                    Separar do chip
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="vazio">Este celular está sem chip da empresa.</p>
                {chipsSemCelular.length > 0 ? (
                  <div className="campos ligar">
                    <label className="campo">
                      <span>Colocar um chip que está sem celular</span>
                      <select value={chipParaLigar} onChange={(e) => setChipParaLigar(e.target.value)}>
                        <option value="">Escolha o chip</option>
                        {chipsSemCelular.map((c) => (
                          <option key={c.numero} value={c.numero}>
                            {c.numeroFormatado} - {c.responsavel || 'sem nome'} - {c.centro_custo || 'sem CC'}
                          </option>
                        ))}
                      </select>
                      <small>O celular passa a seguir quem usa e o centro de custo do chip.</small>
                    </label>
                    <button type="button" className="botao" onClick={ligar} disabled={!chipParaLigar}>
                      Ligar ao chip
                    </button>
                  </div>
                ) : (
                  <small className="dica">Nenhum chip sem celular {usuario.gestor ? 'na plataforma' : 'nos seus centros de custo'} para colocar nele.</small>
                )}
              </>
            )}
          </section>

          <section className="secao">
            <h3>Fotos do estado do celular</h3>
            <Fotos aparelhoId={celular.id} fotos={ficha.fotos} usuario={usuario} onResultado={(r) => depois(r, 'Foto apagada.')} />
          </section>

          <section className="secao secao-pedidos">
            <h3>Pedidos para a TI</h3>
            <PedidosDoItem
              alvo={{ aparelho: celular.id }}
              pedidos={ficha.pedidos || []}
              temChip={false}
              temCelular
              onResultado={(r) => depois(r, 'Pedido enviado para a TI.')}
            />
          </section>

          <section className="secao">
            <h3>{chip ? 'Dados do celular' : 'Dados do celular e quem usa'}</h3>
            <FormAparelho
              aparelho={celular}
              temChip={Boolean(chip)}
              nomeCc={ficha.nome_cc}
              usuario={usuario}
              centrosCusto={centrosCusto}
              onResultado={(r) => depois(r)}
            />
          </section>

          <details className="secao secao-recolhida">
            <summary>Histórico do celular</summary>
            <Historico itens={ficha.historico.filter((h) => h.tipo === 'aparelho')} />
          </details>

          {usuario.gestor && (
            <div className="acoes acoes-rodape">
              <button type="button" className="botao botao-perigo" onClick={apagar}>
                Excluir celular
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
