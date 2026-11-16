import { useEffect, useState } from 'react'
import CamposAparelho from './CamposAparelho.jsx'
import CamposPosse from './CamposPosse.jsx'
import SeletorCc from './SeletorCc.jsx'
import { salvarAparelho } from '../services/controle-api.js'

const inicial = (a) => ({
  marca: a.marca || '',
  modelo: a.modelo || '',
  imei: a.imei || '',
  patrimonio: a.patrimonio || '',
  estado: a.estado || 'bom',
  situacao: a.situacao || 'em_uso',
  observacao: a.observacao || '',
  responsavel_cracha: a.responsavel_cracha || '',
  responsavel: a.responsavel || '',
  setor: a.setor || '',
  centro_custo: a.centro_custo || '',
  motivo: '',
})

/**
 * Dados do celular. Sem chip, também quem usa e o CC (o CC só a TI troca).
 * Com chip, quem usa e o CC vêm do chip e ficam no formulário do chip.
 */
export default function FormAparelho({ aparelho, temChip, nomeCc, usuario, centrosCusto, onResultado }) {
  const [v, setV] = useState(() => inicial(aparelho))
  const [gravando, setGravando] = useState(false)
  useEffect(() => setV(inicial(aparelho)), [aparelho])
  const mudar = (campo, valor) => setV((atual) => ({ ...atual, [campo]: valor }))

  async function gravar(e) {
    e.preventDefault()
    const dados = {
      marca: v.marca, modelo: v.modelo, imei: v.imei, patrimonio: v.patrimonio,
      estado: v.estado, situacao: v.situacao, observacao: v.observacao, motivo: v.motivo,
    }
    if (!temChip) {
      Object.assign(dados, { responsavel_cracha: v.responsavel_cracha, responsavel: v.responsavel, setor: v.setor })
      if (usuario.gestor) dados.centro_custo = v.centro_custo
    }
    setGravando(true)
    onResultado(await salvarAparelho(aparelho.id, dados))
    setGravando(false)
  }

  return (
    <form className="formulario" onSubmit={gravar}>
      <CamposAparelho valores={v} onMudar={mudar} />
      {!temChip && (
        <>
          <CamposPosse valores={v} onMudar={mudar} />
          {usuario.gestor ? (
            <SeletorCc valor={v.centro_custo} onMudar={(cc) => mudar('centro_custo', cc)} centrosCusto={centrosCusto} vazio="Sem centro de custo (estoque da TI)" />
          ) : (
            <div className="campo">
              <span>Centro de custo</span>
              <div className="valor-fixo">{aparelho.centro_custo ? `${aparelho.centro_custo} - ${nomeCc || ''}` : 'Sem centro de custo'}</div>
            </div>
          )}
        </>
      )}
      <div className="campos">
        <label className="campo">
          <span>Observação</span>
          <input value={v.observacao} onChange={(e) => mudar('observacao', e.target.value)} placeholder="Ex.: tela trincada no canto, capinha preta" />
        </label>
        <label className="campo">
          <span>Motivo da mudança (opcional)</span>
          <input value={v.motivo} onChange={(e) => mudar('motivo', e.target.value)} />
        </label>
      </div>
      <button type="submit" className="botao botao-primario" disabled={gravando}>
        {gravando ? 'Gravando...' : 'Gravar celular'}
      </button>
    </form>
  )
}
