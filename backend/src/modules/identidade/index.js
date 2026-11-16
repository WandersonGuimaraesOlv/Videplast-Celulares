// Quem está usando a tela. O Nginx do servidor só deixa entrar quem o Portal de Acesso liberou
// e repassa o crachá no cabeçalho X-Usuario (o Nginx sobrescreve o que vier do navegador).
// O papel de cada um fica nesta plataforma: gestor (TI) ou supervisor dos CCs da tabela cel_supervisores.
const { erro } = require('../shared/erros');

/**
 * @param {object} repo repositório (ehGestor, ccsDoSupervisor, buscarCracha)
 * @param {{ usuarioDev?: string, validadeMs?: number }} [opcoes] usuarioDev: só para npm run dev
 */
function criarIdentificacao(repo, { usuarioDev = '', validadeMs = 60 * 1000 } = {}) {
  const cache = new Map();

  async function carregar(cracha) {
    const guardado = cache.get(cracha);
    if (guardado && guardado.expira > Date.now()) return guardado.usuario;
    const [gestor, ccs, pessoa] = await Promise.all([
      repo.ehGestor(cracha),
      repo.ccsDoSupervisor(cracha),
      repo.buscarCracha(cracha).catch(() => null),
    ]);
    const usuario = { cracha, nome: pessoa ? pessoa.nome : '', gestor: Boolean(gestor), ccs: [...new Set(ccs)].sort() };
    cache.set(cracha, { usuario, expira: Date.now() + validadeMs });
    return usuario;
  }

  /** Middleware: põe req.usuario = { cracha, nome, gestor, ccs } ou responde 401. */
  async function identificar(req, res, next) {
    const cracha = String(req.get('x-usuario') || usuarioDev || '').trim();
    if (!/^[0-9A-Za-z@._-]{1,80}$/.test(cracha)) {
      next(erro(401, 'Não consegui identificar quem está usando. Entre pelo Portal de Acesso e abra a plataforma de novo.'));
      return;
    }
    try {
      req.usuario = await carregar(cracha);
      next();
    } catch (e) {
      next(e);
    }
  }

  /** Depois de mudar supervisores ou gestores: o papel novo vale na hora. */
  const esquecer = () => cache.clear();

  return { identificar, esquecer };
}

module.exports = { criarIdentificacao };
