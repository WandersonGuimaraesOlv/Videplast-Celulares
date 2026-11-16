import { useEffect, useState } from 'react'
import CamposPosse from './CamposPosse.jsx'
import SeletorCc from './SeletorCc.jsx'
import { SITUACOES_CHIP } from '../../../shared/lib/textos.js'
import { salvarChip } from '../services/controle-api.js'

const inicial = (chip) => ({
  responsavel_cracha: chip.responsavel_cracha || '',
  responsavel: chip.responsavel || '',
  setor: chip.setor || '',
  centro_custo: chip.centro_custo || '',
  plano: chip.plano || '',
  situacao: chip.situacao || 'ativo',
  operadora: chip.operadora || 'TIM',
  observacao: chip.observacao || '',
  motivo: '',
})

/** Quem usa o chip e, para a TI, CC, plano e situação. */
export default function FormChip({ chip, nomeCc, usuario, centrosCusto, onResultado }) {
  const [v, setV] = useState(() => inicial(chip))
  const [gravando, setGravando] = useState(false)
  useEffect(() => setV(inicial(chip)), [chip])
  const mudar = (campo, valor) => setV((atual) => ({ ...atual, [campo]: valor }))

  async function gravar(e) {
    e.preventDefault()
    const dados = { responsavel_cracha: v.responsavel_cracha, responsavel: v.responsavel, setor: v.setor, observacao: v.observacao, motivo: v.motivo }
    if (usuario.gestor) Object.assign(dados, { centro_custo: v.centro_custo, plano: v.plano, situacao: v.situacao, operadora: v.operadora })
    setGravando(true)
    onResultado(await salvarChip(chip.numero, dados))
    setGravando(false)
  }

  return (
    <form className="formulario" onSubmit={gravar}>
      <CamposPosse valores={v} onMudar={mudar} />
      <div className="campos">
        {usuario.gestor ? (
          <SeletorCc valor={v.centro_custo} onMudar={(cc) => mudar('centro_custo', cc)} centrosCusto={centrosCusto} vazio="Sem centro de custo" dica="Trocar o CC muda o rateio da fatura." />
        ) : (
          <div className="campo">
            <span>Centro de custo</span>
            <div className="valor-fixo">{chip.centro_custo ? `${chip.centro_custo} - ${nomeCc || ''}` : 'Sem centro de custo'}</div>
            <small>Só a TI troca o centro de custo (muda o rateio).</small>
          </div>
        )}
        {usuario.gestor ? (
          <>
            <label className="campo campo-curto">
              <span>Plano</span>
              <input value={v.plano} onChange={(e) => mudar('plano', e.target.value)} placeholder="Ex.: 10GB - R$ 30,90" />
            </label>
            <label className="campo campo-curto">
              <span>Situação do chip</span>
              <select value={v.situacao} onChange={(e) => mudar('situacao', e.target.value)}>
                {SITUACOES_CHIP.map(([valor, texto]) => (
                  <option key={valor} value={valor}>{texto}</option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <div className="campo campo-curto">
            <span>Plano</span>
            <div className="valor-fixo">{chip.plano || '—'}</div>
          </div>
        )}
      </div>
      <div className="campos">
        <label className="campo">
          <span>Observação</span>
          <input value={v.observacao} onChange={(e) => mudar('observacao', e.target.value)} placeholder="Ex.: fica no caminhão da placa ABC1D23" />
        </label>
        <label className="campo">
          <span>Motivo da mudança (opcional)</span>
          <input value={v.motivo} onChange={(e) => mudar('motivo', e.target.value)} placeholder="Ex.: troca de motorista" />
        </label>
      </div>
      <button type="submit" className="botao botao-primario" disabled={gravando}>
        {gravando ? 'Gravando...' : 'Gravar chip'}
      </button>
    </form>
  )
}
