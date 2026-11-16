const { criarCadastroCentrosCusto, cadastroPadrao, normalizarNome } = require('./services/cadastro-service');
const { criarFonteDeCadastro, montarCadastro, cadastroDoCodigo } = require('./services/fonte-cadastro');

module.exports = { criarCadastroCentrosCusto, cadastroPadrao, normalizarNome, criarFonteDeCadastro, montarCadastro, cadastroDoCodigo };
