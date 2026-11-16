import { useState } from 'react'
import MensagemStatus from '../../shared/components/MensagemStatus.jsx'
import { enviarFormulario, urlApi } from '../../shared/lib/api.js'

function Lista({ titulo, itens, render, aberto = false }) {
  if (!itens.length) return null
  return (
    <details className="aviso aviso-info" open={aberto}>
      <summary>
        {titulo} ({itens.length})
      </summary>
      <ul>
        {itens.map((item, i) => (
          <li key={i}>{render(item)}</li>
        ))}
      </ul>
    </details>
  )
}

/** Aba "Importar / Exportar" (só TI). */
export default function ImportarExportar() {
  const [arquivo, setArquivo] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function enviar(gravar) {
    if (!arquivo) return
    if (gravar && !window.confirm('Gravar a planilha na plataforma? Os chips novos são cadastrados e os que mudaram são atualizados (fica no histórico).')) return
    setOcupado(true)
    setErro('')
    const formData = new FormData()
    formData.append('planilha', arquivo)
    if (gravar) formData.append('gravar', 'sim')
    const r = await enviarFormulario('/importar', formData)
    setOcupado(false)
    if (r.sucesso) setResultado(r.importacao)
    else setErro(r.erro)
  }

  const imp = resultado
  return (
    <>
      <section className="cartao">
        <h2>Exportar</h2>
        <p className="explicacao">
          Baixa o Controle de Chips da plataforma em Excel, com as mesmas colunas da planilha antiga (dá para importar de
          volta) e uma aba com os celulares sem chip.
        </p>
        <a className="botao" href={urlApi('/exportar')}>
          Baixar o Controle de Chips (Excel)
        </a>
      </section>

      <section className="cartao">
        <h2>Importar o Controle de Chips</h2>
        <p className="explicacao">
          Use para a carga inicial ou para atualizar muitos chips de uma vez. Primeiro o sistema só confere e mostra o que
          mudaria; nada é gravado até você clicar em "Gravar na plataforma". Chips da plataforma que não estão na planilha
          não são apagados.
        </p>
        <div className="formulario">
          <label className="campo">
            <span>Planilha (Excel)</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                setArquivo(e.target.files[0] || null)
                setResultado(null)
              }}
            />
            <small>Colunas usadas: "Número do Chip", "Colaborador Responsavel ATUAL", "Setor ATUAL", "Centro de Custo ATUALIZADO" e "Planos".</small>
          </label>
          <div className="acoes">
            <button type="button" className="botao" disabled={!arquivo || ocupado} onClick={() => enviar(false)}>
              {ocupado ? 'Conferindo...' : 'Conferir planilha'}
            </button>
            {imp && !imp.gravado && (imp.novos.length > 0 || imp.alterados.length > 0) && (
              <button type="button" className="botao botao-primario" disabled={ocupado} onClick={() => enviar(true)}>
                Gravar na plataforma
              </button>
            )}
          </div>
        </div>
        <MensagemStatus tipo="erro">{erro}</MensagemStatus>

        {imp && (
          <div className="resultado-importacao">
            {imp.gravado && <MensagemStatus tipo="sucesso">Gravado: {imp.novos.length} chip(s) novo(s) e {imp.alterados.length} atualizado(s).</MensagemStatus>}
            <div className="resumo-fatura">
              <div className="resumo-item"><span>Chips na planilha</span><strong>{imp.lidos}</strong></div>
              <div className="resumo-item resumo-info"><span>Novos</span><strong>{imp.novos.length}</strong></div>
              <div className="resumo-item resumo-info"><span>Com mudança</span><strong>{imp.alterados.length}</strong></div>
              <div className="resumo-item resumo-ok"><span>Iguais</span><strong>{imp.iguais}</strong></div>
            </div>
            {!imp.gravado && imp.novos.length === 0 && imp.alterados.length === 0 && (
              <MensagemStatus tipo="info">A plataforma já está igual à planilha. Nada para gravar.</MensagemStatus>
            )}
            <div className="avisos">
              <Lista titulo="Chips novos" itens={imp.novos} aberto render={(n) => `${n.numeroFormatado} - ${n.responsavel || 'sem nome'} - ${n.centro_custo || 'sem CC'}`} />
              <Lista
                titulo="Chips com mudança"
                itens={imp.alterados}
                aberto
                render={(a) => `${a.numeroFormatado}: ${a.mudancas.map((m) => `${m.rotulo} "${m.antes || '(vazio)'}" → "${m.depois || '(vazio)'}"`).join('; ')}`}
              />
              <Lista titulo="CCs corrigidos para a filial (1007 → 1005)" itens={imp.ccsAjustados} render={(a) => `${a.numero}: ${a.de} → ${a.para}`} />
              <Lista titulo="CCs que não existem no cadastro (corrija depois na ficha)" itens={imp.ccsInexistentes} aberto render={(a) => `${a.numero}: ${a.centro_custo}`} />
              <Lista titulo="Números repetidos na planilha (vale a última linha)" itens={imp.duplicados} render={(n) => n} />
              <Lista titulo="Chips da plataforma que não estão na planilha (não serão apagados)" itens={imp.foraDaPlanilha} render={(c) => `${c.numero} - ${c.responsavel || 'sem nome'} - ${c.centro_custo || 'sem CC'}`} />
            </div>
          </div>
        )}
      </section>
    </>
  )
}
