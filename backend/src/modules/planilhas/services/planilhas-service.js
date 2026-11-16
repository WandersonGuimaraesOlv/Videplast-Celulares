// Planilhas: importar o Controle de Chips (carga inicial ou atualização em massa), exportar o
// cadastro no mesmo formato e gerar o rateio da fatura TIM com os chips da plataforma.
const XLSX = require('xlsx');
const { erro } = require('../../shared/erros');
const { diferencas, texto } = require('../../shared/campos');
const { extrairTextoPdf } = require('../../shared');
const { lerControleChips, normalizarTelefone } = require('../../telefonia/services/controle-chips-service');
const { lerFaturaTim } = require('../../telefonia/services/fatura-tim-service');
const { calcularRateio, formatarTelefone } = require('../../telefonia/services/rateio-telefonia-service');
const { gerarPlanilhaRateio, nomeArquivoPlanilha } = require('../../telefonia/services/planilha-telefonia-service');

const CAMPOS_IMPORTADOS = ['responsavel', 'setor', 'centro_custo', 'plano'];
const ROTULO_ESTADO = { novo: 'Novo', bom: 'Bom', regular: 'Regular', ruim: 'Ruim', quebrado: 'Quebrado' };
const ROTULO_SITUACAO = { ativo: 'Ativo', reserva: 'Reserva', cancelado: 'Cancelado', em_uso: 'Em uso', manutencao: 'Manutenção', descartado: 'Descartado' };

/**
 * @param {{ repo: object, obterCadastro: () => Promise<object>, filial: number, agora?: () => string }} deps
 */
function criarPlanilhas({ repo, obterCadastro, filial, agora = () => new Date().toISOString() }) {
  const quem = (u) => (u.nome ? `${u.nome} (${u.cracha})` : u.cracha);
  function exigirGestor(u) {
    if (!u.gestor) throw erro(403, 'Só a TI (gestores da plataforma) pode fazer isso.');
  }

  /**
   * Compara a planilha com o cadastro. Com gravar=true, cadastra os chips novos e atualiza os
   * que mudaram (quem usa, setor, CC e plano), com histórico. Chip da plataforma que não está
   * na planilha não é apagado: só aparece na lista para a TI conferir.
   */
  async function importar(u, arquivo, { gravar = false } = {}) {
    exigirGestor(u);
    let lido;
    try {
      lido = lerControleChips(arquivo.buffer, arquivo.originalname);
    } catch (e) {
      throw erro(400, e.message);
    }
    const cadastro = await obterCadastro();
    const existentes = new Map((await repo.listarChips(null)).map((c) => [c.numero, c]));

    const novos = [];
    const alterados = [];
    const ccsAjustados = [];
    const ccsInexistentes = [];
    let iguais = 0;
    for (const chip of lido.chips.values()) {
      const cc = chip.centroCusto ? cadastro.ajustarUnidade(chip.centroCusto) : '';
      if (cc !== chip.centroCusto) ccsAjustados.push({ numero: formatarTelefone(chip.numero), de: chip.centroCusto, para: cc });
      if (cc && !cadastro.buscar(cc)) ccsInexistentes.push({ numero: formatarTelefone(chip.numero), centro_custo: cc });
      const dados = { responsavel: texto(chip.responsavel), setor: texto(chip.setor), centro_custo: cc, plano: texto(chip.plano) };
      const atual = existentes.get(chip.numero);
      if (!atual) {
        novos.push({ numero: chip.numero, ...dados });
        continue;
      }
      const mudancas = diferencas(atual, dados);
      if (mudancas.length) alterados.push({ numero: chip.numero, dados, mudancas });
      else iguais += 1;
    }
    const foraDaPlanilha = [...existentes.values()]
      .filter((c) => !lido.chips.has(c.numero))
      .map((c) => ({ numero: formatarTelefone(c.numero), responsavel: c.responsavel, centro_custo: c.centro_custo }));

    const resumo = {
      arquivo: arquivo.originalname,
      lidos: lido.chips.size,
      novos: novos.map((n) => ({ ...n, numeroFormatado: formatarTelefone(n.numero) })),
      alterados: alterados.map((a) => ({ numero: a.numero, numeroFormatado: formatarTelefone(a.numero), mudancas: a.mudancas })),
      iguais,
      ccsAjustados,
      ccsInexistentes,
      duplicados: lido.duplicados.map(formatarTelefone),
      foraDaPlanilha,
      gravado: false,
    };
    if (!gravar) return resumo;

    const carimbo = { atualizado_em: agora(), atualizado_por: quem(u) };
    const motivo = `Importado da planilha ${texto(arquivo.originalname, 150)}`;
    const historico = (numero, acao, mudancas) => ({
      tipo: 'chip', chave: numero, acao, mudancas, motivo, quem_cracha: u.cracha, quem_nome: u.nome || '', quando: agora(),
    });
    await repo.inserirChips(novos.map((n) => ({ ...n, filial, ...carimbo })));
    for (const a of alterados) {
      await repo.atualizarChip(a.numero, { ...a.dados, ...carimbo });
      const atual = existentes.get(a.numero);
      if (atual.aparelho_id) {
        const posse = { responsavel: a.dados.responsavel, setor: a.dados.setor, centro_custo: a.dados.centro_custo };
        await repo.atualizarAparelho(atual.aparelho_id, { ...posse, ...carimbo });
      }
    }
    await repo.registrarHistorico([
      ...novos.map((n) => historico(n.numero, 'criou', diferencas({}, { responsavel: n.responsavel, setor: n.setor, centro_custo: n.centro_custo, plano: n.plano }))),
      ...alterados.map((a) => historico(a.numero, 'alterou', a.mudancas)),
    ]);
    return { ...resumo, gravado: true };
  }

  /** Cadastro inteiro em Excel, com as colunas do Controle de Chips (dá para importar de volta). */
  async function exportar(u) {
    exigirGestor(u);
    const cadastro = await obterCadastro();
    const [chips, aparelhos] = await Promise.all([repo.listarChips(null), repo.listarAparelhos(null)]);
    const porId = new Map(aparelhos.map((a) => [a.id, a]));
    const ligados = new Set(chips.map((c) => c.aparelho_id).filter(Boolean));
    const nomeCc = (cc) => (cc && cadastro.buscar(cc) ? cadastro.buscar(cc).nome : '');
    const celular = (a) => (a ? [a.marca, a.modelo].filter(Boolean).join(' ') : '');

    const linhasChips = chips.map((c) => {
      const a = c.aparelho_id ? porId.get(c.aparelho_id) : null;
      return {
        'Número do Chip': formatarTelefone(c.numero),
        'Colaborador Responsavel ATUAL': c.responsavel,
        'Crachá': c.responsavel_cracha,
        'Setor ATUAL': c.setor,
        'Centro de Custo ATUALIZADO': c.centro_custo,
        'Nome do CC': nomeCc(c.centro_custo),
        Planos: c.plano,
        'Situação do chip': ROTULO_SITUACAO[c.situacao] || c.situacao,
        Celular: celular(a),
        IMEI: a ? a.imei : '',
        'Estado do celular': a ? ROTULO_ESTADO[a.estado] || a.estado : '',
        'Atualizado por': c.atualizado_por,
      };
    });
    const linhasSoltos = aparelhos.filter((a) => !ligados.has(a.id)).map((a) => ({
      Celular: celular(a),
      IMEI: a.imei,
      Patrimônio: a.patrimonio,
      Estado: ROTULO_ESTADO[a.estado] || a.estado,
      Situação: ROTULO_SITUACAO[a.situacao] || a.situacao,
      'Quem usa': a.responsavel,
      Setor: a.setor,
      'Centro de Custo': a.centro_custo,
      'Nome do CC': nomeCc(a.centro_custo),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhasChips), 'Inventario');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhasSoltos.length ? linhasSoltos : [{ Celular: '(nenhum celular sem chip)' }]), 'Celulares sem chip');
    const data = agora().slice(0, 10).split('-').reverse().join('-');
    return { buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), nome: `Controle_Chips - ${data}.xlsx` };
  }

  /** Rateio da fatura TIM (PDF) pelo centro de custo de cada chip cadastrado na plataforma. */
  async function rateio(u, arquivoFatura, { ccValorGeral = '' } = {}) {
    exigirGestor(u);
    const chipsDoBanco = await repo.listarChips(null);
    if (!chipsDoBanco.length) throw erro(400, 'Nenhum chip cadastrado ainda. Importe o Controle de Chips na aba "Importar / Exportar".');
    const chips = new Map(
      chipsDoBanco.map((c) => [
        c.numero,
        { numero: c.numero, responsavel: c.responsavel, setor: c.setor, centroCusto: c.centro_custo, centroCustoAntigo: '', plano: c.plano },
      ])
    );
    const cadastro = await obterCadastro();
    let resultado;
    try {
      const conteudo = await extrairTextoPdf(arquivoFatura.buffer);
      resultado = calcularRateio(lerFaturaTim(conteudo), { chips, duplicados: [] }, cadastro, { ccValorGeral });
    } catch (e) {
      throw erro(422, e.message);
    }
    return {
      ...resultado,
      planilha: gerarPlanilhaRateio(resultado).toString('base64'),
      nomePlanilha: nomeArquivoPlanilha(resultado.fatura.referencia),
    };
  }

  return { importar, exportar, rateio, normalizarTelefone };
}

module.exports = { criarPlanilhas };
