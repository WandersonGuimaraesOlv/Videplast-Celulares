import { useState } from 'react'
import CamposPosse from './CamposPosse.jsx'
import SeletorCc from './SeletorCc.jsx'
import { criarChip } from '../services/controle-api.js'

/** Chip novo (só TI): número, quem usa, CC e plano. */
export default function FormNovoChip({ centrosCusto, onResultado, onCancelar }) {
  const [v, setV] = useState({ numero: '', responsavel_cracha: '', responsavel: '', setor: '', centro_custo: '', plano: '', observacao: '' })
  const [gravando, setGravando] = useState(false)
  const mudar = (campo, valor) => setV((atual) => ({ ...atual, [campo]: valor }))

  async function gravar(e) {
    e.preventDefault()
    setGravando(true)
    onResultado(await criarChip(v))
    setGravando(false)
  }

  return (
    <form className="formulario" onSubmit={gravar}>
      <div className="campos">
        <label className="campo">
          <span>Número do chip (com DDD)</span>
          <input inputMode="tel" value={v.numero} onChange={(e) => mudar('numero', e.target.value)} placeholder="Ex.: 64 99999-0000" required />
        </label>
        <label className="campo">
          <span>Plano</span>
          <input value={v.plano} onChange={(e) => mudar('plano', e.target.value)} placeholder="Ex.: 10GB - R$ 30,90" />
        </label>
      </div>
      <SeletorCc valor={v.centro_custo} onMudar={(cc) => mudar('centro_custo', cc)} centrosCusto={centrosCusto} dica="É o CC que paga a linha no rateio da fatura." />
      <CamposPosse valores={v} onMudar={mudar} />
      <label className="campo">
        <span>Observação</span>
        <input value={v.observacao} onChange={(e) => mudar('observacao', e.target.value)} />
      </label>
      <div className="acoes">
        <button type="submit" className="botao botao-primario" disabled={gravando}>
          {gravando ? 'Gravando...' : 'Cadastrar chip'}
        </button>
        <button type="button" className="botao botao-discreto" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
