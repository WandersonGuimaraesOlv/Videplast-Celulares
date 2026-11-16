// Controle de Chips: lista, ficha, cadastro, alterações, vínculo chip x celular e fotos.
// Regras de quem pode o quê (decididas pela TI em 16/11/2026):
// - Gestor (TI): vê tudo, cadastra e exclui chips, troca centro de custo, mexe em qualquer item.
// - Supervisor: vê e altera só os itens dos CCs dele (quem usa, setor, dados e estado do celular,
//   fotos, vincular/desvincular celular); cadastra celular nos CCs dele. Trocar CC é só a TI,
//   porque muda o rateio. Toda mudança fica no histórico com quem fez e quando.
// - Celular ligado a um chip: quem usa, setor e CC vêm do chip (mudou no chip, o celular acompanha).
const { erro } = require('../../shared/erros');
const { texto, limparCampos, diferencas, centroCustoValido } = require('../../shared/campos');
const { normalizarTelefone } = require('../../telefonia/services/controle-chips-service');
const { formatarTelefone } = require('../../telefonia/services/rateio-telefonia-service');

const CAMPOS_POSSE = ['responsavel', 'responsavel_cracha', 'setor'];
const CAMPOS_CHIP = {
  supervisor: [...CAMPOS_POSSE, 'observacao'],
  gestor: [...CAMPOS_POSSE, 'observacao', 'centro_custo', 'plano', 'situacao', 'operadora'],
};
const CAMPOS_APARELHO = {
  supervisor: [...CAMPOS_POSSE, 'marca', 'modelo', 'imei', 'patrimonio', 'estado', 'situacao', 'observacao'],
  gestor: [...CAMPOS_POSSE, 'marca', 'modelo', 'imei', 'patrimonio', 'estado', 'situacao', 'observacao', 'centro_custo'],
};
const TIPOS_FOTO = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const LIMITE_FOTO = 5 * 1024 * 1024;

const descreverAparelho = (a) => [a.marca, a.modelo].filter(Boolean).join(' ') + (a.imei ? ` (IMEI ${a.imei})` : '') || `celular nº ${a.id}`;
const maisRecente = (...datas) => datas.filter(Boolean).sort().pop() || null;
const sem = (lista, tirar) => lista.filter((c) => !tirar.includes(c));

/**
 * @param {{ repo: object, obterCadastro: () => Promise<object>, filial: number, agora?: () => string }} deps
 */
function criarControle({ repo, obterCadastro, filial, agora = () => new Date().toISOString() }) {
  const quem = (u) => (u.nome ? `${u.nome} (${u.cracha})` : u.cracha);
  const carimbo = (u) => ({ atualizado_em: agora(), atualizado_por: quem(u) });
  const historico = (u, tipo, chave, acao, mudancas = [], motivo = '') => ({
    tipo, chave: String(chave), acao, mudancas, motivo: texto(motivo, 300), quem_cracha: u.cracha, quem_nome: u.nome || '', quando: agora(),
  });

  function exigirGestor(u) {
    if (!u.gestor) throw erro(403, 'Só a TI (gestores da plataforma) pode fazer isso.');
  }
  function exigirCc(u, cc) {
    if (u.gestor) return;
    if (!cc) throw erro(403, 'Este item está sem centro de custo: só a TI pode mexer nele.');
    if (!u.ccs.includes(cc)) throw erro(403, `O centro de custo ${cc} não está sob sua supervisão.`);
  }
  /** Supervisor mandando outro CC: recusa com o motivo, em vez de ignorar calado. */
  function recusarTrocaDeCc(u, entrada, ccAtual) {
    if (u.gestor || !entrada || entrada.centro_custo === undefined) return;
    if (String(entrada.centro_custo).replace(/\s+/g, '').toUpperCase() !== String(ccAtual || '')) {
      throw erro(403, 'Só a TI troca o centro de custo, porque muda o rateio da fatura. Peça para a TI.');
    }
  }
  /** Crachá informado sem nome: busca o nome no cadastro de crachás. */
  async function completarNome(campos) {
    if (!campos.responsavel_cracha || campos.responsavel) return campos;
    const pessoa = await repo.buscarCracha(campos.responsavel_cracha).catch(() => null);
    return pessoa && pessoa.nome ? { ...campos, responsavel: texto(pessoa.nome) } : campos;
  }
  async function conferirImei(imei, idAtual = null) {
    if (!imei) return;
    const outro = await repo.buscarAparelhoPorImei(imei);
    if (outro && outro.id !== idAtual) throw erro(409, `Este IMEI já está cadastrado no celular nº ${outro.id} (${descreverAparelho(outro)}).`);
  }
  function numeroDoChip(valor) {
    const numero = normalizarTelefone(valor);
    if (!numero) throw erro(400, 'Número do chip inválido: use DDD + número (ex.: 64 99999-0000).');
    return numero;
  }
  async function chipExistente(valor) {
    const chip = await repo.buscarChip(numeroDoChip(valor));
    if (!chip) throw erro(404, `O chip ${formatarTelefone(normalizarTelefone(valor))} não está cadastrado.`);
    return chip;
  }
  async function aparelhoExistente(id) {
    const n = Number(id);
    const aparelho = Number.isInteger(n) && n > 0 ? await repo.buscarAparelho(n) : null;
    if (!aparelho) throw erro(404, 'Celular não encontrado.');
    return aparelho;
  }
  /** CC que manda no celular: o do chip, se estiver ligado a um; senão o dele. */
  async function donoDoAparelho(aparelho) {
    const chip = await repo.chipDoAparelho(aparelho.id);
    return { chip, cc: chip ? chip.centro_custo : aparelho.centro_custo };
  }
  async function fotosComEndereco(aparelhoId) {
    const fotos = await repo.listarFotos(aparelhoId);
    const urls = await repo.urlsAssinadas(fotos.map((f) => f.caminho));
    return fotos.map((f) => ({ id: f.id, url: urls.get(f.caminho) || '', criado_em: f.criado_em, enviado_por: f.enviado_por }));
  }

  // ---------- Leitura ----------

  /** Linhas da tela: celular + chip, só chip e só celular, de tudo (gestor) ou dos CCs do supervisor. */
  async function listar(u) {
    const cadastro = await obterCadastro();
    const ccs = u.gestor ? null : u.ccs;
    const [chips, aparelhos] = await Promise.all([repo.listarChips(ccs), repo.listarAparelhos(ccs)]);
    const porId = new Map(aparelhos.map((a) => [a.id, a]));
    const faltando = [...new Set(chips.map((c) => c.aparelho_id).filter((id) => id && !porId.has(id)))];
    for (const a of await repo.listarAparelhosPorIds(faltando)) porId.set(a.id, a);
    const fotos = await repo.contarFotos([...porId.keys()]);
    const nomeCc = (cc) => (cc && cadastro.buscar(cc) ? cadastro.buscar(cc).nome : '');
    const resumoAparelho = (a) => ({
      id: a.id, marca: a.marca, modelo: a.modelo, imei: a.imei, patrimonio: a.patrimonio,
      estado: a.estado, situacao: a.situacao, fotos: fotos.get(a.id) || 0,
    });

    const linhas = [];
    const ligados = new Set();
    for (const c of chips) {
      const a = c.aparelho_id ? porId.get(c.aparelho_id) : null;
      if (a) ligados.add(a.id);
      linhas.push({
        chave: `chip-${c.numero}`,
        tipo: a ? 'celular_chip' : 'so_chip',
        numero: c.numero,
        numeroFormatado: formatarTelefone(c.numero),
        chip: { numero: c.numero, plano: c.plano, situacao: c.situacao, operadora: c.operadora },
        aparelho: a ? resumoAparelho(a) : null,
        responsavel: c.responsavel,
        responsavel_cracha: c.responsavel_cracha,
        setor: c.setor,
        centro_custo: c.centro_custo,
        nome_cc: nomeCc(c.centro_custo),
        atualizado_em: maisRecente(c.atualizado_em, a && a.atualizado_em),
      });
    }
    // Celular que não apareceu junto de um chip da lista: confere se não está ligado a um chip de outro CC
    const soltos = [...porId.values()].filter((a) => !ligados.has(a.id));
    for (const a of soltos) {
      if (!u.gestor && (await repo.chipDoAparelho(a.id))) continue;
      linhas.push({
        chave: `aparelho-${a.id}`,
        tipo: 'so_celular',
        numero: '',
        numeroFormatado: '',
        chip: null,
        aparelho: resumoAparelho(a),
        responsavel: a.responsavel,
        responsavel_cracha: a.responsavel_cracha,
        setor: a.setor,
        centro_custo: a.centro_custo,
        nome_cc: nomeCc(a.centro_custo),
        atualizado_em: a.atualizado_em,
      });
    }
    linhas.sort((x, y) => x.centro_custo.localeCompare(y.centro_custo) || x.responsavel.localeCompare(y.responsavel, 'pt-BR') || x.chave.localeCompare(y.chave));

    const centrosCusto = u.gestor ? cadastro.lista : u.ccs.map((codigo) => ({ codigo, nome: nomeCc(codigo) }));
    return { linhas, centrosCusto };
  }

  /** Ficha de um chip (com o celular dele) ou de um celular sem chip, com fotos e histórico. */
  async function ficha(u, { chip, aparelho }) {
    let c = null;
    let a = null;
    if (chip) {
      c = await chipExistente(chip);
      if (c.aparelho_id) a = await repo.buscarAparelho(c.aparelho_id);
    } else if (aparelho) {
      a = await aparelhoExistente(aparelho);
      c = await repo.chipDoAparelho(a.id);
    } else {
      throw erro(400, 'Informe o chip ou o celular.');
    }
    const cc = c ? c.centro_custo : a.centro_custo;
    exigirCc(u, cc);
    const cadastro = await obterCadastro();
    const itens = [c && { tipo: 'chip', chave: c.numero }, a && { tipo: 'aparelho', chave: String(a.id) }].filter(Boolean);
    const [fotos, hist] = await Promise.all([a ? fotosComEndereco(a.id) : [], repo.listarHistorico(itens)]);
    return {
      chip: c ? { ...c, numeroFormatado: formatarTelefone(c.numero) } : null,
      aparelho: a,
      nome_cc: cc && cadastro.buscar(cc) ? cadastro.buscar(cc).nome : '',
      fotos,
      historico: hist,
      permissoes: { gestor: u.gestor, trocarCc: u.gestor, excluir: u.gestor },
    };
  }

  // ---------- Chips ----------

  async function criarChip(u, entrada) {
    exigirGestor(u);
    const numero = numeroDoChip(entrada.numero);
    if (await repo.buscarChip(numero)) throw erro(409, `O chip ${formatarTelefone(numero)} já está cadastrado.`);
    const cadastro = await obterCadastro();
    const campos = await completarNome(limparCampos(entrada, CAMPOS_CHIP.gestor, { tipo: 'chip', cadastro }));
    const [novo] = await repo.inserirChips([{ numero, filial, ...campos, ...carimbo(u) }]);
    await repo.registrarHistorico([historico(u, 'chip', numero, 'criou', diferencas({}, campos), entrada.motivo)]);
    return novo;
  }

  async function salvarChip(u, numeroInformado, entrada) {
    const chip = await chipExistente(numeroInformado);
    exigirCc(u, chip.centro_custo);
    recusarTrocaDeCc(u, entrada, chip.centro_custo);
    const cadastro = await obterCadastro();
    const campos = await completarNome(limparCampos(entrada, u.gestor ? CAMPOS_CHIP.gestor : CAMPOS_CHIP.supervisor, { tipo: 'chip', cadastro }));
    const mudancas = diferencas(chip, campos);
    if (!mudancas.length) return { chip, mudancas };
    const atualizado = await repo.atualizarChip(chip.numero, { ...campos, ...carimbo(u) });
    const entradas = [historico(u, 'chip', chip.numero, 'alterou', mudancas, entrada.motivo)];

    if (chip.aparelho_id) {
      const posse = Object.fromEntries(['responsavel', 'responsavel_cracha', 'setor', 'centro_custo'].filter((c) => c in campos).map((c) => [c, campos[c]]));
      const aparelho = await repo.buscarAparelho(chip.aparelho_id);
      const mudouPosse = aparelho ? diferencas(aparelho, posse) : [];
      if (mudouPosse.length) {
        await repo.atualizarAparelho(aparelho.id, { ...posse, ...carimbo(u) });
        entradas.push(historico(u, 'aparelho', aparelho.id, 'alterou', mudouPosse, `Acompanhou o chip ${formatarTelefone(chip.numero)}`));
      }
    }
    await repo.registrarHistorico(entradas);
    return { chip: atualizado, mudancas };
  }

  async function excluirChip(u, numeroInformado, motivo = '') {
    exigirGestor(u);
    const chip = await chipExistente(numeroInformado);
    await repo.excluirChip(chip.numero);
    const resumo = diferencas({}, { responsavel: chip.responsavel, centro_custo: chip.centro_custo, plano: chip.plano })
      .map((m) => ({ ...m, antes: m.depois, depois: '' }));
    await repo.registrarHistorico([historico(u, 'chip', chip.numero, 'excluiu', resumo, motivo)]);
  }

  // ---------- Celulares ----------

  /** Novo celular: ligado a um chip (entrada.chip) ou solto num CC (entrada.centro_custo). */
  async function criarAparelho(u, entrada) {
    const cadastro = await obterCadastro();
    let chip = null;
    if (entrada.chip) {
      chip = await chipExistente(entrada.chip);
      exigirCc(u, chip.centro_custo);
      if (chip.aparelho_id) throw erro(409, 'Este chip já tem um celular. Desvincule o atual antes de cadastrar outro.');
    } else {
      exigirCc(u, centroCustoValido(entrada.centro_custo, cadastro));
    }
    const permitidos = chip ? sem(CAMPOS_APARELHO.gestor, [...CAMPOS_POSSE, 'centro_custo']) : CAMPOS_APARELHO.gestor;
    const campos = await completarNome(limparCampos(entrada, permitidos, { tipo: 'aparelho', cadastro }));
    if (!campos.marca && !campos.modelo) throw erro(400, 'Informe pelo menos a marca ou o modelo do celular.');
    await conferirImei(campos.imei);
    const posse = chip
      ? { responsavel: chip.responsavel, responsavel_cracha: chip.responsavel_cracha, setor: chip.setor, centro_custo: chip.centro_custo, filial: chip.filial }
      : { filial };
    const novo = await repo.inserirAparelho({ ...campos, ...posse, ...carimbo(u) });
    const entradas = [historico(u, 'aparelho', novo.id, 'criou', diferencas({}, campos), entrada.motivo)];
    if (chip) {
      await repo.atualizarChip(chip.numero, { aparelho_id: novo.id, ...carimbo(u) });
      entradas.push(historico(u, 'chip', chip.numero, 'vinculou', [{ campo: 'aparelho', rotulo: 'Celular', antes: '', depois: descreverAparelho(novo) }]));
    }
    await repo.registrarHistorico(entradas);
    return { aparelho: novo, chip: chip ? chip.numero : null };
  }

  async function salvarAparelho(u, id, entrada) {
    const aparelho = await aparelhoExistente(id);
    const { chip, cc } = await donoDoAparelho(aparelho);
    exigirCc(u, cc);
    if (!chip) recusarTrocaDeCc(u, entrada, aparelho.centro_custo);
    const cadastro = await obterCadastro();
    let permitidos = u.gestor ? CAMPOS_APARELHO.gestor : CAMPOS_APARELHO.supervisor;
    if (chip) permitidos = sem(permitidos, [...CAMPOS_POSSE, 'centro_custo']);
    const campos = await completarNome(limparCampos(entrada, permitidos, { tipo: 'aparelho', cadastro }));
    if ('marca' in campos || 'modelo' in campos) {
      const marca = 'marca' in campos ? campos.marca : aparelho.marca;
      const modelo = 'modelo' in campos ? campos.modelo : aparelho.modelo;
      if (!marca && !modelo) throw erro(400, 'Informe pelo menos a marca ou o modelo do celular.');
    }
    if (campos.imei && campos.imei !== aparelho.imei) await conferirImei(campos.imei, aparelho.id);
    const mudancas = diferencas(aparelho, campos);
    if (!mudancas.length) return { aparelho, mudancas };
    const atualizado = await repo.atualizarAparelho(aparelho.id, { ...campos, ...carimbo(u) });
    await repo.registrarHistorico([historico(u, 'aparelho', aparelho.id, 'alterou', mudancas, entrada.motivo)]);
    return { aparelho: atualizado, mudancas };
  }

  async function excluirAparelho(u, id, motivo = '') {
    exigirGestor(u);
    const aparelho = await aparelhoExistente(id);
    const chip = await repo.chipDoAparelho(aparelho.id);
    const entradas = [];
    if (chip) {
      await repo.atualizarChip(chip.numero, { aparelho_id: null, ...carimbo(u) });
      entradas.push(historico(u, 'chip', chip.numero, 'desvinculou', [{ campo: 'aparelho', rotulo: 'Celular', antes: descreverAparelho(aparelho), depois: '' }], 'Celular excluído'));
    }
    const fotos = await repo.listarFotos(aparelho.id);
    await repo.excluirAparelho(aparelho.id);
    await repo.apagarArquivos(fotos.map((f) => f.caminho));
    entradas.push(historico(u, 'aparelho', aparelho.id, 'excluiu', [{ campo: 'aparelho', rotulo: 'Celular', antes: descreverAparelho(aparelho), depois: '' }], motivo));
    await repo.registrarHistorico(entradas);
  }

  // ---------- Chip x celular ----------

  async function vincular(u, numeroInformado, aparelhoId) {
    const chip = await chipExistente(numeroInformado);
    const aparelho = await aparelhoExistente(aparelhoId);
    exigirCc(u, chip.centro_custo);
    const outro = await repo.chipDoAparelho(aparelho.id);
    if (outro) throw erro(409, `Este celular já está com o chip ${formatarTelefone(outro.numero)}. Desvincule lá antes.`);
    exigirCc(u, aparelho.centro_custo);
    if (chip.aparelho_id) throw erro(409, 'Este chip já tem um celular. Desvincule o atual antes.');
    const posse = { responsavel: chip.responsavel, responsavel_cracha: chip.responsavel_cracha, setor: chip.setor, centro_custo: chip.centro_custo, filial: chip.filial };
    await repo.atualizarChip(chip.numero, { aparelho_id: aparelho.id, ...carimbo(u) });
    await repo.atualizarAparelho(aparelho.id, { ...posse, situacao: aparelho.situacao === 'reserva' ? 'em_uso' : aparelho.situacao, ...carimbo(u) });
    await repo.registrarHistorico([
      historico(u, 'chip', chip.numero, 'vinculou', [{ campo: 'aparelho', rotulo: 'Celular', antes: '', depois: descreverAparelho(aparelho) }]),
      historico(u, 'aparelho', aparelho.id, 'vinculou', [{ campo: 'numero', rotulo: 'Chip', antes: '', depois: formatarTelefone(chip.numero) }]),
    ]);
  }

  /** O celular sai do chip e fica no mesmo CC, como celular sem chip (ex.: guardado na TI). */
  async function desvincular(u, numeroInformado, motivo = '') {
    const chip = await chipExistente(numeroInformado);
    exigirCc(u, chip.centro_custo);
    if (!chip.aparelho_id) throw erro(400, 'Este chip não tem celular ligado.');
    const aparelho = await repo.buscarAparelho(chip.aparelho_id);
    await repo.atualizarChip(chip.numero, { aparelho_id: null, ...carimbo(u) });
    const entradas = [historico(u, 'chip', chip.numero, 'desvinculou', [{ campo: 'aparelho', rotulo: 'Celular', antes: aparelho ? descreverAparelho(aparelho) : '', depois: '' }], motivo)];
    if (aparelho) {
      entradas.push(historico(u, 'aparelho', aparelho.id, 'desvinculou', [{ campo: 'numero', rotulo: 'Chip', antes: formatarTelefone(chip.numero), depois: '' }], motivo));
    }
    await repo.registrarHistorico(entradas);
  }

  // ---------- Fotos ----------

  async function enviarFoto(u, aparelhoId, arquivo) {
    const aparelho = await aparelhoExistente(aparelhoId);
    const { cc } = await donoDoAparelho(aparelho);
    exigirCc(u, cc);
    if (!arquivo || !arquivo.buffer || !arquivo.buffer.length) throw erro(400, 'Escolha ou tire a foto do celular.');
    const extensao = TIPOS_FOTO[arquivo.mimetype];
    if (!extensao) throw erro(400, 'A foto deve ser JPG, PNG ou WEBP.');
    if (arquivo.buffer.length > LIMITE_FOTO) throw erro(400, 'A foto passou de 5 MB. Tire de novo ou reduza antes de enviar.');
    const caminho = `aparelhos/${aparelho.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;
    await repo.enviarArquivo(caminho, arquivo.buffer, arquivo.mimetype);
    const foto = await repo.inserirFoto({ aparelho_id: aparelho.id, caminho, enviado_por: quem(u) });
    await repo.registrarHistorico([historico(u, 'aparelho', aparelho.id, 'foto')]);
    return foto;
  }

  async function excluirFoto(u, fotoId) {
    const n = Number(fotoId);
    const foto = Number.isInteger(n) && n > 0 ? await repo.buscarFoto(n) : null;
    if (!foto) throw erro(404, 'Foto não encontrada.');
    if (!u.gestor && !String(foto.enviado_por).endsWith(`(${u.cracha})`) && foto.enviado_por !== u.cracha) {
      throw erro(403, 'Só quem enviou a foto ou a TI pode apagá-la.');
    }
    await repo.excluirFoto(foto.id);
    await repo.apagarArquivos([foto.caminho]);
    await repo.registrarHistorico([historico(u, 'aparelho', foto.aparelho_id, 'apagou foto')]);
  }

  return {
    listar, ficha,
    criarChip, salvarChip, excluirChip,
    criarAparelho, salvarAparelho, excluirAparelho,
    vincular, desvincular,
    enviarFoto, excluirFoto,
  };
}

module.exports = { criarControle, CAMPOS_CHIP, CAMPOS_APARELHO, descreverAparelho };
