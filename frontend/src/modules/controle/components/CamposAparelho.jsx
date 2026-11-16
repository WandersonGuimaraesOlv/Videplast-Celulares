import { ESTADOS, SITUACOES_APARELHO } from '../../../shared/lib/textos.js'

/** Marca, modelo, IMEI, patrimônio, estado e situação do celular (controlado pelo pai). */
export default function CamposAparelho({ valores, onMudar }) {
  return (
    <>
      <div className="campos">
        <label className="campo">
          <span>Marca</span>
          <input value={valores.marca || ''} onChange={(e) => onMudar('marca', e.target.value)} placeholder="Ex.: Samsung" />
        </label>
        <label className="campo">
          <span>Modelo</span>
          <input value={valores.modelo || ''} onChange={(e) => onMudar('modelo', e.target.value)} placeholder="Ex.: Galaxy A15" />
        </label>
      </div>
      <div className="campos">
        <label className="campo">
          <span>IMEI</span>
          <input
            inputMode="numeric"
            value={valores.imei || ''}
            onChange={(e) => onMudar('imei', e.target.value.replace(/\D/g, ''))}
            placeholder="15 números"
            maxLength={16}
          />
          <small>Disque *#06# no celular para ver.</small>
        </label>
        <label className="campo campo-curto">
          <span>Patrimônio</span>
          <input value={valores.patrimonio || ''} onChange={(e) => onMudar('patrimonio', e.target.value)} placeholder="Nº da etiqueta, se tiver" />
        </label>
      </div>
      <div className="campos">
        <label className="campo">
          <span>Estado do celular</span>
          <select value={valores.estado || 'bom'} onChange={(e) => onMudar('estado', e.target.value)}>
            {ESTADOS.map(([valor, texto]) => (
              <option key={valor} value={valor}>{texto}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Situação</span>
          <select value={valores.situacao || 'em_uso'} onChange={(e) => onMudar('situacao', e.target.value)}>
            {SITUACOES_APARELHO.map(([valor, texto]) => (
              <option key={valor} value={valor}>{texto}</option>
            ))}
          </select>
        </label>
      </div>
    </>
  )
}
