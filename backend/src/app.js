// API da plataforma Celulares e Chips. Tudo em /api passa pela identificação (crachá vindo do
// Portal de Acesso pelo Nginx), menos o /api/health do Docker e do publicador.
const express = require('express');
const multer = require('multer');
const { criarIdentificacao } = require('./modules/identidade');
const { criarFonteDeCadastro } = require('./modules/centros-custo');
const { criarControle } = require('./modules/controle/services/controle-service');
const { criarEquipe } = require('./modules/equipe/services/equipe-service');
const { criarPlanilhas } = require('./modules/planilhas/services/planilhas-service');
const { opcoesTelefoniaSchema } = require('./modules/telefonia/schemas');
const { getZodErrorMessage } = require('./modules/shared');
const { erro } = require('./modules/shared/erros');

/**
 * @param {{ repo: object, filial?: number, usuarioDev?: string, limiteUploadMb?: number, agora?: () => string }} opcoes
 *   repo: repositório do Supabase (produção) ou em memória (testes)
 */
function criarApp({ repo, filial = 1005, usuarioDev = '', limiteUploadMb = 20, agora } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  const obterCadastro = criarFonteDeCadastro(repo, filial);
  const identificacao = criarIdentificacao(repo, { usuarioDev });
  const controle = criarControle({ repo, obterCadastro, filial, agora });
  const equipe = criarEquipe({ repo, obterCadastro, aoMudar: identificacao.esquecer, agora });
  const planilhas = criarPlanilhas({ repo, obterCadastro, filial, agora });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: limiteUploadMb * 1024 * 1024, files: 1 } });
  const umArquivo = (campo) => (req, res, next) =>
    upload.single(campo)(req, res, (e) => {
      if (!e) return next();
      if (e.code === 'LIMIT_FILE_SIZE') return next(erro(400, `Arquivo maior que ${limiteUploadMb} MB.`));
      if (e.code === 'LIMIT_UNEXPECTED_FILE' || e.code === 'LIMIT_FILE_COUNT') return next(erro(400, 'Envie um arquivo por vez.'));
      return next(erro(400, `Falha no envio do arquivo: ${e.message}`));
    });
  /** Handler assíncrono: devolve { sucesso: true, ...resultado } ou passa o erro adiante. */
  const rota = (fn) => async (req, res, next) => {
    try {
      const resultado = await fn(req, res);
      if (!res.headersSent) res.json({ sucesso: true, ...(resultado || {}) });
    } catch (e) {
      next(e);
    }
  };
  const corpo = (req) => req.body || {};

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  const api = express.Router();
  api.use(identificacao.identificar);

  api.get('/eu', rota((req) => ({ usuario: req.usuario })));

  // Controle de Chips (lista, ficha, chips, celulares, vínculo e fotos)
  api.get('/controle', rota((req) => controle.listar(req.usuario)));
  api.get('/ficha', rota((req) => controle.ficha(req.usuario, { chip: req.query.chip, aparelho: req.query.aparelho })));
  api.post('/chips', rota(async (req) => ({ chip: await controle.criarChip(req.usuario, corpo(req)) })));
  api.put('/chips/:numero', rota((req) => controle.salvarChip(req.usuario, req.params.numero, corpo(req))));
  api.delete('/chips/:numero', rota((req) => controle.excluirChip(req.usuario, req.params.numero, req.query.motivo)));
  api.post('/chips/:numero/aparelho', rota((req) => controle.vincular(req.usuario, req.params.numero, corpo(req).aparelho_id)));
  api.delete('/chips/:numero/aparelho', rota((req) => controle.desvincular(req.usuario, req.params.numero, req.query.motivo)));
  api.post('/aparelhos', rota((req) => controle.criarAparelho(req.usuario, corpo(req))));
  api.put('/aparelhos/:id', rota((req) => controle.salvarAparelho(req.usuario, req.params.id, corpo(req))));
  api.delete('/aparelhos/:id', rota((req) => controle.excluirAparelho(req.usuario, req.params.id, req.query.motivo)));
  api.post('/aparelhos/:id/fotos', umArquivo('foto'), rota(async (req) => ({ foto: await controle.enviarFoto(req.usuario, req.params.id, req.file) })));
  api.delete('/fotos/:id', rota((req) => controle.excluirFoto(req.usuario, req.params.id)));

  // Pessoas, supervisores e gestores
  api.get('/pessoas/:cracha', rota(async (req) => ({ pessoa: await equipe.buscarPessoa(req.usuario, req.params.cracha) })));
  api.get('/equipe', rota((req) => equipe.listar(req.usuario)));
  api.post('/supervisores', rota(async (req) => ({ supervisor: await equipe.adicionarSupervisor(req.usuario, corpo(req)) })));
  api.delete('/supervisores/:cracha/:cc', rota((req) => equipe.removerSupervisor(req.usuario, req.params.cracha, req.params.cc)));
  api.post('/gestores', rota(async (req) => ({ gestor: await equipe.adicionarGestor(req.usuario, corpo(req)) })));
  api.delete('/gestores/:cracha', rota((req) => equipe.removerGestor(req.usuario, req.params.cracha)));

  // Planilhas e rateio (TI)
  api.post('/importar', umArquivo('planilha'), rota(async (req) => {
    if (!req.file) throw erro(400, 'Escolha a planilha do Controle de Chips (.xlsx).');
    if (!/\.(xlsx|xls|csv)$/i.test(req.file.originalname)) throw erro(400, 'A planilha deve ser .xlsx, .xls ou .csv.');
    return { importacao: await planilhas.importar(req.usuario, req.file, { gravar: corpo(req).gravar === 'sim' }) };
  }));
  api.get('/exportar', async (req, res, next) => {
    try {
      const { buffer, nome } = await planilhas.exportar(req.usuario);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Controle_Chips.xlsx"; filename*=UTF-8''${encodeURIComponent(nome)}`);
      res.send(buffer);
    } catch (e) {
      next(e);
    }
  });
  api.post('/rateio', umArquivo('fatura'), rota(async (req) => {
    if (!req.file || !/\.pdf$/i.test(req.file.originalname)) throw erro(400, 'Envie a fatura TIM em PDF.');
    const opcoes = opcoesTelefoniaSchema.safeParse(corpo(req));
    if (!opcoes.success) throw erro(400, getZodErrorMessage(opcoes.error));
    return planilhas.rateio(req.usuario, req.file, { ccValorGeral: opcoes.data.ccValorGeral });
  }));

  api.use((req, res) => res.status(404).json({ sucesso: false, erro: 'Rota não encontrada.' }));
  app.use('/api', api);

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = Number(err.status) || 500;
    if (status >= 500) console.error('[Erro]', err);
    const mensagem = err.status ? err.message : `Erro inesperado no servidor: ${err.message}`;
    res.status(status).json({ sucesso: false, erro: mensagem });
  });

  return app;
}

module.exports = { criarApp };
