/**
 * Repositório em memória com os mesmos métodos do repositório do Supabase, para os testes
 * rodarem sem banco. Dados SINTÉTICOS (nenhum nome ou telefone real).
 */
function criarRepositorioMemoria({ crachas = [], centrosCusto = [], gestores = [], supervisores = [] } = {}) {
  const banco = {
    chips: new Map(),
    aparelhos: new Map(),
    fotos: new Map(),
    historico: [],
    supervisores: supervisores.map((s) => ({ nome: '', ...s })),
    gestores: gestores.map((g) => ({ nome: '', ...g })),
    arquivos: new Map(),
  };
  let proximoAparelho = 1;
  let proximaFoto = 1;
  const copia = (x) => (x ? JSON.parse(JSON.stringify(x)) : null);
  const filtrarCc = (lista, ccs) => (ccs ? lista.filter((i) => ccs.includes(i.centro_custo)) : lista);

  const repo = {
    banco,
    async listarChips(ccs = null) {
      return filtrarCc([...banco.chips.values()], ccs).sort((a, b) => a.numero.localeCompare(b.numero)).map(copia);
    },
    async buscarChip(numero) {
      return copia(banco.chips.get(numero));
    },
    async chipDoAparelho(id) {
      return copia([...banco.chips.values()].find((c) => c.aparelho_id === id));
    },
    async inserirChips(linhas) {
      return linhas.map((l) => {
        if (banco.chips.has(l.numero)) throw Object.assign(new Error('duplicado'), { status: 500 });
        const chip = { operadora: 'TIM', plano: '', situacao: 'ativo', filial: 1005, centro_custo: '', responsavel: '', responsavel_cracha: '', setor: '', aparelho_id: null, observacao: '', ...l };
        banco.chips.set(chip.numero, chip);
        return copia(chip);
      });
    },
    async atualizarChip(numero, campos) {
      const chip = banco.chips.get(numero);
      Object.assign(chip, campos);
      return copia(chip);
    },
    async excluirChip(numero) {
      banco.chips.delete(numero);
    },
    async listarAparelhos(ccs = null) {
      return filtrarCc([...banco.aparelhos.values()], ccs).map(copia);
    },
    async listarAparelhosPorIds(ids) {
      return ids.map((id) => banco.aparelhos.get(id)).filter(Boolean).map(copia);
    },
    async buscarAparelho(id) {
      return copia(banco.aparelhos.get(id));
    },
    async buscarAparelhoPorImei(imei) {
      return copia([...banco.aparelhos.values()].find((a) => a.imei === imei));
    },
    async inserirAparelho(dados) {
      const aparelho = { id: proximoAparelho++, marca: '', modelo: '', imei: '', patrimonio: '', estado: 'bom', situacao: 'em_uso', filial: 1005, centro_custo: '', responsavel: '', responsavel_cracha: '', setor: '', observacao: '', ...dados };
      banco.aparelhos.set(aparelho.id, aparelho);
      return copia(aparelho);
    },
    async atualizarAparelho(id, campos) {
      Object.assign(banco.aparelhos.get(id), campos);
      return copia(banco.aparelhos.get(id));
    },
    async excluirAparelho(id) {
      banco.aparelhos.delete(id);
      for (const c of banco.chips.values()) if (c.aparelho_id === id) c.aparelho_id = null;
      for (const [fid, f] of banco.fotos) if (f.aparelho_id === id) banco.fotos.delete(fid);
    },
    async registrarHistorico(entradas) {
      banco.historico.push(...entradas.map(copia));
    },
    async listarHistorico(itens) {
      return banco.historico.filter((h) => itens.some((i) => i.tipo === h.tipo && i.chave === h.chave)).reverse().map(copia);
    },
    async listarFotos(aparelhoId) {
      return [...banco.fotos.values()].filter((f) => f.aparelho_id === aparelhoId).map(copia);
    },
    async contarFotos(ids) {
      const contagem = new Map();
      for (const f of banco.fotos.values()) if (ids.includes(f.aparelho_id)) contagem.set(f.aparelho_id, (contagem.get(f.aparelho_id) || 0) + 1);
      return contagem;
    },
    async inserirFoto(dados) {
      const foto = { id: proximaFoto++, criado_em: new Date().toISOString(), ...dados };
      banco.fotos.set(foto.id, foto);
      return copia(foto);
    },
    async buscarFoto(id) {
      return copia(banco.fotos.get(id));
    },
    async excluirFoto(id) {
      banco.fotos.delete(id);
    },
    async enviarArquivo(caminho, buffer) {
      banco.arquivos.set(caminho, buffer.length);
    },
    async urlsAssinadas(caminhos) {
      return new Map(caminhos.map((c) => [c, `https://teste/${c}`]));
    },
    async apagarArquivos(caminhos) {
      for (const c of caminhos) banco.arquivos.delete(c);
    },
    async listarSupervisores() {
      return banco.supervisores.map(copia);
    },
    async ccsDoSupervisor(cracha) {
      return banco.supervisores.filter((s) => s.cracha === cracha).map((s) => s.centro_custo);
    },
    async adicionarSupervisores(linhas) {
      for (const l of linhas) {
        if (!banco.supervisores.some((s) => s.cracha === l.cracha && s.centro_custo === l.centro_custo)) banco.supervisores.push({ ...l });
      }
    },
    async removerSupervisor(cracha, cc) {
      banco.supervisores = banco.supervisores.filter((s) => !(s.cracha === cracha && s.centro_custo === cc));
    },
    async listarGestores() {
      return banco.gestores.map(copia);
    },
    async ehGestor(cracha) {
      return banco.gestores.some((g) => g.cracha === cracha);
    },
    async adicionarGestor(linha) {
      if (!banco.gestores.some((g) => g.cracha === linha.cracha)) banco.gestores.push({ ...linha });
    },
    async removerGestor(cracha) {
      banco.gestores = banco.gestores.filter((g) => g.cracha !== cracha);
    },
    async buscarCracha(cracha) {
      const p = crachas.find((c) => c.cracha === String(cracha));
      return p ? { ...p } : null;
    },
    async listarCentrosCusto(unidade) {
      return centrosCusto.filter((c) => Number(c.unidade) === Number(unidade));
    },
  };
  return repo;
}

module.exports = { criarRepositorioMemoria };
