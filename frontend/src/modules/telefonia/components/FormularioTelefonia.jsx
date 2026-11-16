import { useState } from 'react'

export default function FormularioTelefonia({ carregando, onProcessar, onTrocar }) {
  const [fatura, setFatura] = useState(null)
  const [ccValorGeral, setCcValorGeral] = useState('')

  function escolher(e) {
    setFatura(e.target.files[0] || null)
    onTrocar?.()
  }

  function trocarCcValorGeral(e) {
    setCcValorGeral(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))
    onTrocar?.()
  }

  function enviar(e) {
    e.preventDefault()
    if (fatura) onProcessar(fatura, ccValorGeral)
  }

  return (
    <section className="cartao">
      <h2>Rateio da fatura TIM</h2>
      <p className="explicacao">
        O centro de custo de cada linha vem do Controle de Chips desta plataforma. Confira se está tudo em dia
        antes de gerar.
      </p>
      <form onSubmit={enviar} className="formulario">
        <div className="campos">
          <label className="campo">
            <span>1. Fatura TIM (PDF)</span>
            <input type="file" name="fatura" accept=".pdf,application/pdf" onChange={escolher} />
            <small>A fatura completa, com o "Resumo do Detalhamento" por acesso.</small>
          </label>
          <label className="campo">
            <span>2. Valor fora das linhas (opcional)</span>
            <input
              type="text"
              name="ccValorGeral"
              value={ccValorGeral}
              onChange={trocarCcValorGeral}
              placeholder="Ex.: 1005PAUX50"
              maxLength={20}
              autoComplete="off"
            />
            <small>
              Multa ou cobrança da fatura que não é de nenhuma linha. Informe o centro de custo para lançar o valor
              inteiro nele; em branco, ele é dividido entre os setores.
            </small>
          </label>
        </div>
        <button type="submit" className="botao botao-primario" disabled={carregando || !fatura}>
          {carregando ? 'Calculando...' : 'Calcular rateio'}
        </button>
      </form>
    </section>
  )
}
