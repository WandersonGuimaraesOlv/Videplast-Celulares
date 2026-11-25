import { useState } from 'react'
import FichaChip from './FichaChip.jsx'
import FichaCelular from './FichaCelular.jsx'

/**
 * Ficha de um chip (alvo = { chip }) ou de um celular (alvo = { aparelho }), cada uma separada.
 * Da ficha do chip dá para abrir a do celular ligado a ele (e vice-versa); a seta volta para a anterior.
 * chipsSemCelular / celularesSemChip: para ligar um ao outro.
 */
export default function FichaItem({ alvo, usuario, centrosCusto, chipsSemCelular = [], celularesSemChip = [], onFechar, onMudou }) {
  const [pilha, setPilha] = useState([alvo])
  const atual = pilha[pilha.length - 1]
  const comum = {
    usuario,
    centrosCusto,
    onFechar,
    onMudou,
    onAbrir: (novo) => setPilha((p) => [...p, novo]),
    onVoltar: pilha.length > 1 ? () => setPilha((p) => p.slice(0, -1)) : null,
  }
  return atual.chip ? (
    <FichaChip key={`chip-${atual.chip}`} numero={atual.chip} celularesSemChip={celularesSemChip} {...comum} />
  ) : (
    <FichaCelular key={`celular-${atual.aparelho}`} id={atual.aparelho} aviso={atual.aviso} chipsSemCelular={chipsSemCelular} {...comum} />
  )
}
