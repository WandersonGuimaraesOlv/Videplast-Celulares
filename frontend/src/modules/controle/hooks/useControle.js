import { useCallback, useEffect, useMemo, useState } from 'react'
import { listarControle } from '../services/controle-api.js'
import { celularesSemChip, chipsSemCelular } from '../lib/itens.js'

/**
 * Chips e celulares carregados uma vez para as abas Chips, Celulares e Pedidos.
 * ativo: só carrega depois de saber que a pessoa pode ver; versao: muda quando alguma aba grava algo.
 */
export default function useControle(ativo, versao) {
  const [estado, setEstado] = useState({ linhas: [], centrosCusto: [], carregando: true, erro: '' })

  const carregar = useCallback(async () => {
    const r = await listarControle()
    setEstado((atual) =>
      r.sucesso
        ? { linhas: r.linhas, centrosCusto: r.centrosCusto, carregando: false, erro: '' }
        : { ...atual, carregando: false, erro: r.erro }
    )
  }, [])

  useEffect(() => {
    if (ativo) carregar()
  }, [ativo, versao, carregar])

  const livres = useMemo(
    () => ({ chipsSemCelular: chipsSemCelular(estado.linhas), celularesSemChip: celularesSemChip(estado.linhas) }),
    [estado.linhas]
  )
  return { ...estado, ...livres, recarregar: carregar }
}
