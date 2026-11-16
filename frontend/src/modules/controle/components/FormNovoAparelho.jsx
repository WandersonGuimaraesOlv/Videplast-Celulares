import { useState } from 'react'
import CamposAparelho from './CamposAparelho.jsx'
import CamposPosse from './CamposPosse.jsx'
import SeletorCc from './SeletorCc.jsx'
import { criarAparelho } from '../services/controle-api.js'

/**
 * Cadastro de celular: para um chip (numeroChip) ou solto num centro de custo.
 * centrosCusto: os que a pessoa pode usar (supervisor: só os dele).
 */
export default function FormNovoAparelho({ numeroChip = '', centrosCusto, onResultado, onCancelar }) {
  const [v, setV] = useState({
    marca: '', modelo: '', imei: '', patrimonio: '', estado: 'bom', situacao: 'em_uso', observacao: '',
    responsavel_cracha: '', responsavel: '', setor: '', centro_custo: centrosCusto.length === 1 ? centrosCusto[0].codigo : '',
  })
  const [gravando, setGravando] = useState(false)
  const mudar = (campo, valor) => setV((atual) => ({ ...atual, [campo]: valor }))

  async function gravar(e) {
    e.preventDefault()
    const dados = { marca: v.marca, modelo: v.modelo, imei: v.imei, patrimonio: v.patrimonio, estado: v.estado, situacao: v.situacao, observacao: v.observacao }
    if (numeroChip) dados.chip = numeroChip
    else Object.assign(dados, { responsavel_cracha: v.responsavel_cracha, responsavel: v.responsavel, setor: v.setor, centro_custo: v.centro_custo })
    setGravando(true)
    onResultado(await criarAparelho(dados))
    setGravando(false)
  }

  return (
    <form className="formulario" onSubmit={gravar}>
      <CamposAparelho valores={v} onMudar={mudar} />
      {!numeroChip && (
        <>
          <SeletorCc valor={v.centro_custo} onMudar={(cc) => mudar('centro_custo', cc)} centrosCusto={centrosCusto} />
          <CamposPosse valores={v} onMudar={mudar} />
        </>
      )}
      <label className="campo">
        <span>Observação</span>
        <input value={v.observacao} onChange={(e) => mudar('observacao', e.target.value)} />
      </label>
      <div className="acoes">
        <button type="submit" className="botao botao-primario" disabled={gravando}>
          {gravando ? 'Gravando...' : 'Cadastrar celular'}
        </button>
        {onCancelar && (
          <button type="button" className="botao botao-discreto" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
      <small className="dica">Depois de cadastrar, tire as fotos do estado do celular na ficha.</small>
    </form>
  )
}
