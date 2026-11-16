import FormularioTelefonia from './FormularioTelefonia.jsx'
import RelatorioTelefonia from './RelatorioTelefonia.jsx'
import MensagemStatus from '../../../shared/components/MensagemStatus.jsx'
import { useRateioTelefonia } from '../hooks/useRateioTelefonia.js'

/** Aba "Rateio TIM" (só gestores). */
export default function AbaRateio() {
  const telefonia = useRateioTelefonia()
  return (
    <>
      <FormularioTelefonia carregando={telefonia.carregando} onProcessar={telefonia.processar} onTrocar={telefonia.limpar} />
      <MensagemStatus tipo="erro">{telefonia.erro}</MensagemStatus>
      {telefonia.rateio && <RelatorioTelefonia rateio={telefonia.rateio} />}
    </>
  )
}
