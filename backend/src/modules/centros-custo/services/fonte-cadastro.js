// Cadastro de centros de custo da filial lido da tabela centro_de_custo do Supabase (a mesma do
// Imobilizados, com todos os CCs da planilha do SAP), guardado por 10 minutos. Se o banco falhar,
// usa a lista que vem no código (data/centros-custo.json, só Rio Verde).
const LISTA_PADRAO = require('../data/centros-custo.json');
const { criarCadastroCentrosCusto } = require('./cadastro-service');

/** Cadastro com a lista ordenada junto (para os campos de escolher CC na tela). */
function montarCadastro(lista) {
  const cadastro = criarCadastroCentrosCusto(lista);
  const itens = lista
    .map((l) => ({ codigo: String(l.centro_custo || '').trim().toUpperCase(), nome: String(l.setores || '').replace(/\s+/g, ' ').trim() }))
    .filter((i) => i.codigo)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  return { ...cadastro, lista: itens };
}

const cadastroDoCodigo = montarCadastro(LISTA_PADRAO);

/**
 * @param {{ listarCentrosCusto(unidade: number): Promise<{ centro_custo: string, setores: string, unidade: number }[]> }} repo
 * @param {number} unidade
 */
function criarFonteDeCadastro(repo, unidade, { validadeMs = 10 * 60 * 1000 } = {}) {
  let cache = null;
  let expira = 0;
  return async function obterCadastro() {
    if (cache && Date.now() < expira) return cache;
    try {
      const lista = await repo.listarCentrosCusto(unidade);
      cache = lista && lista.length ? montarCadastro(lista) : cadastroDoCodigo;
    } catch (e) {
      console.error('[Centros de custo] Usando a lista do código; o banco falhou:', e.message);
      cache = cadastroDoCodigo;
    }
    expira = Date.now() + validadeMs;
    return cache;
  };
}

module.exports = { criarFonteDeCadastro, montarCadastro, cadastroDoCodigo };
