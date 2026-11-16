// Supervisores (quem cuida de cada centro de custo) e gestores (TI). Só gestor mexe aqui.
const { erro } = require('../../shared/erros');
const { centroCustoValido } = require('../../shared/campos');

/**
 * @param {{ repo: object, obterCadastro: () => Promise<object>, aoMudar?: () => void, agora?: () => string }} deps
 *   aoMudar: chamado depois de cada mudança (limpa o cache de papéis da identificação)
 */
function criarEquipe({ repo, obterCadastro, aoMudar = () => {}, agora = () => new Date().toISOString() }) {
  const historico = (u, tipo, chave, acao, mudancas) => ({
    tipo, chave: String(chave), acao, mudancas, motivo: '', quem_cracha: u.cracha, quem_nome: u.nome || '', quando: agora(),
  });
  function exigirGestor(u) {
    if (!u.gestor) throw erro(403, 'Só a TI (gestores da plataforma) pode cuidar dos supervisores.');
  }
  function crachaValido(valor) {
    const c = String(valor ?? '').trim();
    if (!/^\d{1,10}$/.test(c)) throw erro(400, 'Crachá: só números.');
    return c;
  }
  async function pessoa(cracha) {
    const achada = await repo.buscarCracha(cracha);
    if (!achada) throw erro(404, `O crachá ${cracha} não está no cadastro de crachás.`);
    return achada;
  }

  async function listar(u) {
    exigirGestor(u);
    const [linhas, gestores, cadastro] = await Promise.all([repo.listarSupervisores(), repo.listarGestores(), obterCadastro()]);
    const porCracha = new Map();
    for (const l of linhas) {
      if (!porCracha.has(l.cracha)) porCracha.set(l.cracha, { cracha: l.cracha, nome: l.nome, ccs: [] });
      const item = cadastro.buscar(l.centro_custo);
      porCracha.get(l.cracha).ccs.push({ codigo: l.centro_custo, nome: item ? item.nome : '' });
    }
    const supervisores = [...porCracha.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return { supervisores, gestores, centrosCusto: cadastro.lista };
  }

  /** Um ou mais CCs para um crachá. */
  async function adicionarSupervisor(u, { cracha, ccs }) {
    exigirGestor(u);
    const c = crachaValido(cracha);
    const lista = Array.isArray(ccs) ? ccs : [ccs];
    const cadastro = await obterCadastro();
    const codigos = [...new Set(lista.map((cc) => centroCustoValido(cc, cadastro)).filter(Boolean))];
    if (!codigos.length) throw erro(400, 'Escolha pelo menos um centro de custo.');
    const { nome } = await pessoa(c);
    await repo.adicionarSupervisores(codigos.map((centro_custo) => ({ cracha: c, nome, centro_custo })));
    await repo.registrarHistorico(codigos.map((cc) => historico(u, 'supervisor', c, 'adicionou', [{ campo: 'centro_custo', rotulo: 'Centro de custo', antes: '', depois: cc }])));
    aoMudar();
    return { cracha: c, nome, ccs: codigos };
  }

  async function removerSupervisor(u, cracha, centroCusto) {
    exigirGestor(u);
    const c = crachaValido(cracha);
    const cc = String(centroCusto || '').toUpperCase();
    await repo.removerSupervisor(c, cc);
    await repo.registrarHistorico([historico(u, 'supervisor', c, 'removeu', [{ campo: 'centro_custo', rotulo: 'Centro de custo', antes: cc, depois: '' }])]);
    aoMudar();
  }

  async function adicionarGestor(u, { cracha }) {
    exigirGestor(u);
    const c = crachaValido(cracha);
    const { nome } = await pessoa(c);
    await repo.adicionarGestor({ cracha: c, nome });
    await repo.registrarHistorico([historico(u, 'gestor', c, 'adicionou', [])]);
    aoMudar();
    return { cracha: c, nome };
  }

  async function removerGestor(u, cracha) {
    exigirGestor(u);
    const c = crachaValido(cracha);
    if (c === u.cracha) throw erro(400, 'Você não pode tirar o seu próprio acesso de gestor. Peça para outro gestor.');
    await repo.removerGestor(c);
    await repo.registrarHistorico([historico(u, 'gestor', c, 'removeu', [])]);
    aoMudar();
  }

  /** Nome de um crachá (para preencher "quem usa" na tela). Gestor ou supervisor. */
  async function buscarPessoa(u, cracha) {
    if (!u.gestor && !u.ccs.length) throw erro(403, 'Você ainda não é supervisor de nenhum centro de custo.');
    return pessoa(crachaValido(cracha));
  }

  return { listar, adicionarSupervisor, removerSupervisor, adicionarGestor, removerGestor, buscarPessoa };
}

module.exports = { criarEquipe };
