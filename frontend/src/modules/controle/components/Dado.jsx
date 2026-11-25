/** Um dado do resumo da ficha: rótulo pequeno em cima, valor embaixo e um complemento opcional. */
export default function Dado({ rotulo, valor, extra }) {
  return (
    <div className="dado">
      <span className="dado-rotulo">{rotulo}</span>
      <span className="dado-valor">{valor}</span>
      {extra && <span className="dado-extra">{extra}</span>}
    </div>
  )
}
