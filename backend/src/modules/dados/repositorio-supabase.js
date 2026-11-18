// Repositório: a única parte do backend que conversa com o Supabase (tabelas cel_*, crachas,
// centro_de_custo e o Storage das fotos). Os serviços recebem um repositório: este em produção,
// um em memória nos testes (tests/support/repositorio-memoria.js), com os mesmos métodos.
const { erro } = require('../shared/erros');

const LIMITE = 5000;

function criarRepositorioSupabase(supabase, { bucket }) {
  /** Resultado do supabase-js → dados, ou erro 500 com a mensagem do banco. */
  const resultado = ({ data, error }, oQue) => {
    if (error) throw erro(500, `Erro no banco ao ${oQue}: ${error.message}`);
    return data;
  };

  return {
    // ---------- Chips ----------
    async listarChips(ccs = null) {
      let q = supabase.from('cel_chips').select('*').order('numero').range(0, LIMITE - 1);
      if (ccs) q = q.in('centro_custo', ccs.length ? ccs : ['-']);
      return resultado(await q, 'listar os chips');
    },
    async buscarChip(numero) {
      return resultado(await supabase.from('cel_chips').select('*').eq('numero', numero).maybeSingle(), 'buscar o chip');
    },
    async chipDoAparelho(aparelhoId) {
      return resultado(await supabase.from('cel_chips').select('*').eq('aparelho_id', aparelhoId).maybeSingle(), 'buscar o chip do celular');
    },
    async inserirChips(linhas) {
      if (!linhas.length) return [];
      return resultado(await supabase.from('cel_chips').insert(linhas).select('*'), 'cadastrar o chip');
    },
    async atualizarChip(numero, campos) {
      return resultado(await supabase.from('cel_chips').update(campos).eq('numero', numero).select('*').single(), 'gravar o chip');
    },
    async excluirChip(numero) {
      resultado(await supabase.from('cel_chips').delete().eq('numero', numero), 'excluir o chip');
    },

    // ---------- Celulares ----------
    async listarAparelhos(ccs = null) {
      let q = supabase.from('cel_aparelhos').select('*').order('id').range(0, LIMITE - 1);
      if (ccs) q = q.in('centro_custo', ccs.length ? ccs : ['-']);
      return resultado(await q, 'listar os celulares');
    },
    async listarAparelhosPorIds(ids) {
      if (!ids.length) return [];
      return resultado(await supabase.from('cel_aparelhos').select('*').in('id', ids), 'listar os celulares');
    },
    async buscarAparelho(id) {
      return resultado(await supabase.from('cel_aparelhos').select('*').eq('id', id).maybeSingle(), 'buscar o celular');
    },
    async buscarAparelhoPorImei(imei) {
      return resultado(await supabase.from('cel_aparelhos').select('*').eq('imei', imei).maybeSingle(), 'conferir o IMEI');
    },
    async inserirAparelho(dados) {
      return resultado(await supabase.from('cel_aparelhos').insert(dados).select('*').single(), 'cadastrar o celular');
    },
    async atualizarAparelho(id, campos) {
      return resultado(await supabase.from('cel_aparelhos').update(campos).eq('id', id).select('*').single(), 'gravar o celular');
    },
    async excluirAparelho(id) {
      resultado(await supabase.from('cel_aparelhos').delete().eq('id', id), 'excluir o celular');
    },

    // ---------- Histórico ----------
    async registrarHistorico(entradas) {
      if (!entradas.length) return;
      resultado(await supabase.from('cel_historico').insert(entradas), 'gravar o histórico');
    },
    async listarHistorico(itens, limite = 200) {
      // itens: [{ tipo, chave }]
      if (!itens.length) return [];
      const filtro = itens.map((i) => `and(tipo.eq.${i.tipo},chave.eq.${i.chave})`).join(',');
      return resultado(
        await supabase.from('cel_historico').select('*').or(filtro).order('quando', { ascending: false }).limit(limite),
        'ler o histórico'
      );
    },

    // ---------- Fotos ----------
    async listarFotos(aparelhoId) {
      return resultado(
        await supabase.from('cel_fotos').select('*').eq('aparelho_id', aparelhoId).order('criado_em', { ascending: false }),
        'listar as fotos'
      );
    },
    async contarFotos(aparelhoIds) {
      if (!aparelhoIds.length) return new Map();
      const linhas = resultado(
        await supabase.from('cel_fotos').select('aparelho_id').in('aparelho_id', aparelhoIds).range(0, LIMITE - 1),
        'contar as fotos'
      );
      const contagem = new Map();
      for (const l of linhas) contagem.set(l.aparelho_id, (contagem.get(l.aparelho_id) || 0) + 1);
      return contagem;
    },
    async inserirFoto(dados) {
      return resultado(await supabase.from('cel_fotos').insert(dados).select('*').single(), 'gravar a foto');
    },
    async buscarFoto(id) {
      return resultado(await supabase.from('cel_fotos').select('*').eq('id', id).maybeSingle(), 'buscar a foto');
    },
    async excluirFoto(id) {
      resultado(await supabase.from('cel_fotos').delete().eq('id', id), 'excluir a foto');
    },
    async enviarArquivo(caminho, buffer, tipo) {
      const { error } = await supabase.storage.from(bucket).upload(caminho, buffer, { contentType: tipo, upsert: false });
      if (error) throw erro(500, `Não consegui guardar a foto: ${error.message}`);
    },
    async urlsAssinadas(caminhos, segundos = 3600) {
      if (!caminhos.length) return new Map();
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(caminhos, segundos);
      if (error) throw erro(500, `Não consegui abrir as fotos: ${error.message}`);
      return new Map((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
    },
    async apagarArquivos(caminhos) {
      if (!caminhos.length) return;
      const { error } = await supabase.storage.from(bucket).remove(caminhos);
      if (error) console.error('[Fotos] Não consegui apagar do Storage:', error.message);
    },

    // ---------- Pedidos para a TI ----------
    async listarPedidos({ ccs = null, somenteAbertos = false } = {}) {
      let q = supabase.from('cel_pedidos').select('*').order('criado_em', { ascending: false }).limit(500);
      if (ccs) q = q.in('centro_custo', ccs.length ? ccs : ['-']);
      if (somenteAbertos) q = q.in('status', ['aberto', 'em_andamento']);
      return resultado(await q, 'listar os pedidos');
    },
    async pedidosDoItem({ numero = '', aparelhoId = null }) {
      const filtros = [numero && `numero_chip.eq.${numero}`, aparelhoId && `aparelho_id.eq.${aparelhoId}`].filter(Boolean);
      if (!filtros.length) return [];
      return resultado(
        await supabase.from('cel_pedidos').select('*').or(filtros.join(',')).order('criado_em', { ascending: false }).limit(100),
        'ler os pedidos do item'
      );
    },
    async buscarPedido(id) {
      return resultado(await supabase.from('cel_pedidos').select('*').eq('id', id).maybeSingle(), 'buscar o pedido');
    },
    async inserirPedido(dados) {
      return resultado(await supabase.from('cel_pedidos').insert(dados).select('*').single(), 'gravar o pedido');
    },
    async atualizarPedido(id, campos) {
      return resultado(await supabase.from('cel_pedidos').update(campos).eq('id', id).select('*').single(), 'atualizar o pedido');
    },

    // ---------- Supervisores e gestores ----------
    async listarSupervisores() {
      return resultado(await supabase.from('cel_supervisores').select('*').order('nome').order('centro_custo'), 'listar os supervisores');
    },
    async ccsDoSupervisor(cracha) {
      const linhas = resultado(await supabase.from('cel_supervisores').select('centro_custo').eq('cracha', cracha), 'ler os CCs do supervisor');
      return linhas.map((l) => l.centro_custo);
    },
    async adicionarSupervisores(linhas) {
      if (!linhas.length) return;
      resultado(await supabase.from('cel_supervisores').upsert(linhas, { onConflict: 'cracha,centro_custo' }), 'gravar o supervisor');
    },
    async removerSupervisor(cracha, centroCusto) {
      resultado(await supabase.from('cel_supervisores').delete().eq('cracha', cracha).eq('centro_custo', centroCusto), 'remover o supervisor');
    },
    async listarGestores() {
      return resultado(await supabase.from('cel_gestores').select('*').order('nome'), 'listar os gestores');
    },
    async ehGestor(cracha) {
      const linha = resultado(await supabase.from('cel_gestores').select('cracha').eq('cracha', cracha).maybeSingle(), 'conferir o gestor');
      return Boolean(linha);
    },
    async adicionarGestor(linha) {
      resultado(await supabase.from('cel_gestores').upsert(linha, { onConflict: 'cracha' }), 'gravar o gestor');
    },
    async removerGestor(cracha) {
      resultado(await supabase.from('cel_gestores').delete().eq('cracha', cracha), 'remover o gestor');
    },

    // ---------- Cadastros que já existem (crachás e centros de custo) ----------
    async buscarCracha(cracha) {
      if (!/^\d+$/.test(cracha)) return null;
      const linha = resultado(
        await supabase.from('crachas').select('id, nome_completo, setor, unidade').eq('id', cracha).maybeSingle(),
        'buscar o crachá'
      );
      return linha ? { cracha: String(linha.id), nome: linha.nome_completo || '', setor: linha.setor || '', unidade: linha.unidade } : null;
    },
    async listarCentrosCusto(unidade) {
      return resultado(
        await supabase.from('centro_de_custo').select('centro_custo, setores, unidade').eq('unidade', unidade).order('centro_custo').range(0, LIMITE - 1),
        'listar os centros de custo'
      );
    },
  };
}

/** Sem SUPABASE_URL/KEY: cada chamada responde 503 com o que falta, em vez de derrubar o servidor. */
function repositorioIndisponivel() {
  return new Proxy(
    {},
    {
      get: () => async () => {
        throw erro(503, 'O banco de dados não está configurado no servidor (SUPABASE_URL/SUPABASE_KEY no .env). Chame a TI.');
      },
    }
  );
}

module.exports = { criarRepositorioSupabase, repositorioIndisponivel };
