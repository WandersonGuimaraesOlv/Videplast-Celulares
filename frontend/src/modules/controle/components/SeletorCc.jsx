/** Centro de custo: lista com código e nome. centrosCusto = [{ codigo, nome }]. */
export default function SeletorCc({ valor, onMudar, centrosCusto, rotulo = 'Centro de custo', vazio = 'Escolha o centro de custo', dica }) {
  const conhecido = !valor || centrosCusto.some((c) => c.codigo === valor)
  return (
    <label className="campo">
      <span>{rotulo}</span>
      <select value={valor || ''} onChange={(e) => onMudar(e.target.value)}>
        <option value="">{vazio}</option>
        {!conhecido && <option value={valor}>{valor} (fora do cadastro)</option>}
        {centrosCusto.map((c) => (
          <option key={c.codigo} value={c.codigo}>
            {c.codigo} - {c.nome}
          </option>
        ))}
      </select>
      {dica && <small>{dica}</small>}
    </label>
  )
}
