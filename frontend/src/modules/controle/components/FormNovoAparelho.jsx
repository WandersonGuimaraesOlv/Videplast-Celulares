import { useState } from 'react'
import CamposAparelho from './CamposAparelho.jsx'
import CamposPosse from './CamposPosse.jsx'
import SeletorCc from './SeletorCc.jsx'
import { criarAparelho } from '../services/controle-api.js'

/**
 * Cadastro de celular. numeroChip: cadastrado direto na ficha do chip (já fica ligado a ele).
 * Sem numeroChip, a pessoa escolhe se o celular está com um chip da empresa (chipsSemCelular)
 * ou fica sem chip num centro de custo (centrosCusto: os que ela pode usar; supervisor, só os dele).
 */
export default function FormNovoAparelho({ numeroChip = '', centrosCusto, chipsSemCelular = [], onResultado, onCancelar }) {
  const [v, setV] = useState({
    marca: '', modelo: '', imei: '', patrimonio: '', estado: 'bom', situacao: 'em_uso', observacao: '',
    chip: numeroChip,
    responsavel_cracha: '', responsavel: '', setor: '', centro_custo: centrosCusto.length === 1 ? centrosCusto[0].codigo : '',
  })
  const [gravando, setGravando] = useState(false)
  const mudar = (campo, valor) => setV((atual) => ({ ...atual, [campo]: valor }))
  const comChip = Boolean(v.chip)

  async function gravar(e) {
    e.preventDefault()
    const dados = { marca: v.marca, modelo: v.modelo, imei: v.imei, patrimonio: v.patrimonio, estado: v.estado, situacao: v.situacao, observacao: v.observacao }
    if (comChip) dados.chip = v.chip
    else Object.assign(dados, { responsavel_cracha: v.responsavel_cracha, responsavel: v.responsavel, setor: v.setor, centro_custo: v.centro_custo })
    setGravando(true)
    onResultado(await criarAparelho(dados))
    setGravando(false)
  }

  return (
    <form className="formulario" onSubmit={gravar}>
      <CamposAparelho valores={v} onMudar={mudar} />
      {!numeroChip && chipsSemCelular.length > 0 && (
        <label className="campo">
          <span>Chip da empresa neste celular</span>
          <select value={v.chip} onChange={(e) => mudar('chip', e.target.value)}>
            <option value="">Sem chip da empresa (ou chip particular)</option>
            {chipsSemCelular.map((c) => (
              <option key={c.numero} value={c.numero}>
                {c.numeroFormatado} - {c.responsavel || 'sem nome'} - {c.centro_custo || 'sem CC'}
              </option>
            ))}
          </select>
          <small>
            {comChip ? 'Quem usa e o centro de custo vêm do chip.' : 'Escolha o chip se o celular já estiver com uma linha da empresa.'}
          </small>
        </label>
      )}
      {!comChip && (
        <>
          <SeletorCc valor={v.centro_custo} onMudar={(cc) => mudar('centro_custo', cc)} centrosCusto={centrosCusto} />
          <CamposPosse valores={v} onMudar={mudar} />
        </>
      )}
      <label className="campo">
        <span>Observação</span>
        <input value={v.observacao} onChange={(e) => mudar('observacao', e.target.value)} placeholder="Ex.: capinha preta, película nova" />
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
      <small className="dica">Depois de cadastrar, a ficha do celular abre para você tirar as fotos.</small>
    </form>
  )
}
