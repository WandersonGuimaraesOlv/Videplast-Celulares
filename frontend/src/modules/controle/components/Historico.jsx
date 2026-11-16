import { ESTADOS, SITUACOES_APARELHO, SITUACOES_CHIP, formatarData, formatarTelefone, rotulo } from '../../../shared/lib/textos.js'

const ACOES = {
  criou: 'cadastrou',
  alterou: 'alterou',
  excluiu: 'excluiu',
  vinculou: 'ligou chip e celular',
  desvinculou: 'separou chip e celular',
  foto: 'enviou foto',
  'apagou foto': 'apagou uma foto',
}

/** Valor do histórico em texto de gente: "ruim" → "Ruim (trincado, falhando)". */
function legivel(campo, valor, tipo) {
  if (valor === '' || valor === null || valor === undefined) return '(vazio)'
  if (campo === 'estado') return rotulo(ESTADOS, valor)
  if (campo === 'situacao') return rotulo(tipo === 'chip' ? SITUACOES_CHIP : SITUACOES_APARELHO, valor)
  return String(valor)
}

/** Quem mudou o quê e quando, do mais recente para o mais antigo. */
export default function Historico({ itens }) {
  if (!itens.length) return <p className="vazio">Sem histórico ainda.</p>
  return (
    <ul className="historico">
      {itens.map((h) => (
        <li key={h.id || `${h.quando}-${h.tipo}-${h.acao}`}>
          <div className="historico-topo">
            <strong>{h.quem_nome || h.quem_cracha}</strong> {ACOES[h.acao] || h.acao}
            <span className="historico-item">
              {h.tipo === 'chip' ? `chip ${formatarTelefone(h.chave)}` : `celular nº ${h.chave}`}
            </span>
            <span className="historico-data">{formatarData(h.quando)}</span>
          </div>
          {Array.isArray(h.mudancas) && h.mudancas.length > 0 && (
            <ul className="historico-mudancas">
              {h.mudancas.map((m) => (
                <li key={m.campo}>
                  {m.rotulo || m.campo}: <span className="antes">{legivel(m.campo, m.antes, h.tipo)}</span> →{' '}
                  <span className="depois">{legivel(m.campo, m.depois, h.tipo)}</span>
                </li>
              ))}
            </ul>
          )}
          {h.motivo && <div className="historico-motivo">Motivo: {h.motivo}</div>}
        </li>
      ))}
    </ul>
  )
}
