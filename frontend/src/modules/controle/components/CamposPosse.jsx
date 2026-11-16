import { useState } from 'react'
import { buscarPessoa } from '../services/controle-api.js'

/**
 * "Quem usa": crachá (preenche o nome sozinho), nome e setor. Controlado pelo formulário pai:
 * valores = { responsavel_cracha, responsavel, setor }, onMudar(campo, valor).
 */
export default function CamposPosse({ valores, onMudar }) {
  const [aviso, setAviso] = useState('')

  async function procurarCracha() {
    const cracha = String(valores.responsavel_cracha || '').trim()
    setAviso('')
    if (!cracha) return
    const r = await buscarPessoa(cracha)
    if (r.sucesso) {
      onMudar('responsavel', r.pessoa.nome)
      if (!valores.setor && r.pessoa.setor) onMudar('setor', r.pessoa.setor)
    } else {
      setAviso(r.erro)
    }
  }

  return (
    <div className="campos">
      <label className="campo campo-curto">
        <span>Crachá de quem usa</span>
        <input
          inputMode="numeric"
          value={valores.responsavel_cracha || ''}
          onChange={(e) => onMudar('responsavel_cracha', e.target.value.replace(/\D/g, ''))}
          onBlur={procurarCracha}
          placeholder="Ex.: 12345"
        />
        <small>{aviso || 'O nome vem sozinho do cadastro de crachás.'}</small>
      </label>
      <label className="campo">
        <span>Quem usa</span>
        <input value={valores.responsavel || ''} onChange={(e) => onMudar('responsavel', e.target.value)} placeholder="Nome completo" />
      </label>
      <label className="campo">
        <span>Setor</span>
        <input value={valores.setor || ''} onChange={(e) => onMudar('setor', e.target.value)} placeholder="Ex.: Transporte" />
      </label>
    </div>
  )
}
