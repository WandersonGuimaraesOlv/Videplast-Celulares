// Testes da plataforma pela API (HTTP de verdade), com o banco em memória e dados sintéticos.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { criarApp } = require('../src/app');
const { lerControleChips } = require('../src/modules/telefonia');
const { criarRepositorioMemoria } = require('./support/repositorio-memoria');
const { criarPdf, linhasFaturaTim, criarXlsx, CABECALHO_CONTROLE, linhaControle } = require('./support/arquivos');

const GESTOR = '900001';
const SUP_TRANSPORTE = '900002';
const SEM_PAPEL = '900004';

const repo = criarRepositorioMemoria({
  crachas: [
    { cracha: GESTOR, nome: 'Gestor Teste', setor: 'TI', unidade: 1005 },
    { cracha: SUP_TRANSPORTE, nome: 'Supervisor Transporte', setor: 'Transporte', unidade: 1005 },
    { cracha: '900003', nome: 'Motorista Novo', setor: 'Transporte', unidade: 1005 },
    { cracha: SEM_PAPEL, nome: 'Sem Papel', setor: 'Produção', unidade: 1005 },
  ],
  centrosCusto: [
    { centro_custo: '1005COML04', setores: 'Transporte', unidade: 1005 },
    { centro_custo: '1005HEXT01', setores: 'Extrusão', unidade: 1005 },
    { centro_custo: '1005PAUX50', setores: 'Adm. Indústria', unidade: 1005 },
    { centro_custo: '1005PAUX53', setores: 'Almoxarifado', unidade: 1005 },
    { centro_custo: '1007COML04', setores: 'Transporte 3 Rios', unidade: 1007 },
  ],
  gestores: [{ cracha: GESTOR, nome: 'Gestor Teste' }],
  supervisores: [{ cracha: SUP_TRANSPORTE, nome: 'Supervisor Transporte', centro_custo: '1005COML04' }],
});

let servidor;
let base;
before(async () => {
  servidor = criarApp({ repo, filial: 1005 }).listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}/api`;
});
after(() => servidor.close());

async function chamar(usuario, metodo, caminho, corpo) {
  const opcoes = { method: metodo, headers: usuario ? { 'x-usuario': usuario } : {} };
  if (corpo instanceof FormData) opcoes.body = corpo;
  else if (corpo !== undefined) {
    opcoes.headers['content-type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }
  const resposta = await fetch(`${base}${caminho}`, opcoes);
  const tipo = resposta.headers.get('content-type') || '';
  return { status: resposta.status, corpo: tipo.includes('json') ? await resposta.json() : Buffer.from(await resposta.arrayBuffer()) };
}
const formulario = (campos) => {
  const form = new FormData();
  for (const [nome, valor] of Object.entries(campos)) {
    if (valor && valor.conteudo) form.append(nome, new Blob([valor.conteudo], { type: valor.tipo || '' }), valor.nome);
    else form.append(nome, valor);
  }
  return form;
};
const planilhaControle = () =>
  criarXlsx([
    CABECALHO_CONTROLE,
    linhaControle(['64-999990001', 'Motorista Antigo', 'Transporte', '1007COML04']),
    linhaControle(['64-999990002', 'Operador Extrusão', 'Extrusão', '1005HEXT01']),
    linhaControle(['64-999990003', 'Almoxarife', 'Almoxarifado', '1005PAUX53']),
  ]);

describe('identificação', () => {
  test('health responde sem login; o resto exige o crachá do Portal', async () => {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    const r = await chamar(null, 'GET', '/eu');
    assert.equal(r.status, 401);
    assert.match(r.corpo.erro, /Portal de Acesso/);
  });

  test('papéis: gestor, supervisor com os CCs dele e quem não tem papel', async () => {
    assert.deepEqual((await chamar(GESTOR, 'GET', '/eu')).corpo.usuario, { cracha: GESTOR, nome: 'Gestor Teste', gestor: true, ccs: [] });
    assert.deepEqual((await chamar(SUP_TRANSPORTE, 'GET', '/eu')).corpo.usuario.ccs, ['1005COML04']);
    const semPapel = (await chamar(SEM_PAPEL, 'GET', '/eu')).corpo.usuario;
    assert.equal(semPapel.gestor, false);
    assert.deepEqual(semPapel.ccs, []);
  });
});

describe('importar o Controle de Chips', () => {
  test('prévia não grava; 1007 vira 1005; gravar cadastra; reimportar fica igual', async () => {
    const previa = await chamar(GESTOR, 'POST', '/importar', formulario({ planilha: { conteudo: planilhaControle(), nome: 'controle.xlsx' } }));
    assert.equal(previa.status, 200, JSON.stringify(previa.corpo));
    assert.equal(previa.corpo.importacao.novos.length, 3);
    assert.equal(previa.corpo.importacao.gravado, false);
    assert.deepEqual(previa.corpo.importacao.ccsAjustados.map((a) => a.para), ['1005COML04']);
    assert.equal(repo.banco.chips.size, 0);

    const gravado = await chamar(GESTOR, 'POST', '/importar', formulario({ planilha: { conteudo: planilhaControle(), nome: 'controle.xlsx' }, gravar: 'sim' }));
    assert.equal(gravado.corpo.importacao.gravado, true);
    assert.equal(repo.banco.chips.get('64999990001').centro_custo, '1005COML04');
    assert.equal(repo.banco.historico.filter((h) => h.acao === 'criou').length, 3);

    const de_novo = await chamar(GESTOR, 'POST', '/importar', formulario({ planilha: { conteudo: planilhaControle(), nome: 'controle.xlsx' } }));
    assert.equal(de_novo.corpo.importacao.iguais, 3);
    assert.equal(de_novo.corpo.importacao.novos.length, 0);
  });

  test('só a TI importa', async () => {
    const r = await chamar(SUP_TRANSPORTE, 'POST', '/importar', formulario({ planilha: { conteudo: planilhaControle(), nome: 'controle.xlsx' } }));
    assert.equal(r.status, 403);
  });
});

describe('supervisor', () => {
  test('vê só os chips dos CCs dele', async () => {
    const lista = (await chamar(SUP_TRANSPORTE, 'GET', '/controle')).corpo;
    assert.deepEqual(lista.linhas.map((l) => l.numero), ['64999990001']);
    assert.equal(lista.linhas[0].tipo, 'so_chip');
    assert.equal(lista.linhas[0].nome_cc, 'Transporte');
    assert.deepEqual(lista.centrosCusto, [{ codigo: '1005COML04', nome: 'Transporte' }]);
    assert.equal((await chamar(SUP_TRANSPORTE, 'GET', '/ficha?chip=64999990002')).status, 403);
    assert.deepEqual((await chamar(SEM_PAPEL, 'GET', '/controle')).corpo.linhas, []);
  });

  test('troca quem usa pelo crachá (o nome vem do cadastro) e fica no histórico', async () => {
    const r = await chamar(SUP_TRANSPORTE, 'PUT', '/chips/64999990001', { responsavel_cracha: '900003', motivo: 'Troca de motorista' });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal(repo.banco.chips.get('64999990001').responsavel, 'Motorista Novo');
    const ficha = (await chamar(SUP_TRANSPORTE, 'GET', '/ficha?chip=(64) 99999-0001')).corpo;
    const ultimo = ficha.historico[0];
    assert.equal(ultimo.quem_nome, 'Supervisor Transporte');
    assert.equal(ultimo.motivo, 'Troca de motorista');
    assert.deepEqual(ultimo.mudancas.map((m) => m.campo).sort(), ['responsavel', 'responsavel_cracha']);
  });

  test('não troca o centro de custo (só a TI)', async () => {
    const r = await chamar(SUP_TRANSPORTE, 'PUT', '/chips/64999990001', { centro_custo: '1005PAUX50', setor: 'Outro' });
    assert.equal(r.status, 403);
    assert.match(r.corpo.erro, /Só a TI troca o centro de custo/);
    assert.equal(repo.banco.chips.get('64999990001').centro_custo, '1005COML04');
    assert.equal(repo.banco.chips.get('64999990001').setor, 'Transporte');
  });

  test('cadastra o celular do chip; o celular acompanha quem usa o chip', async () => {
    const r = await chamar(SUP_TRANSPORTE, 'POST', '/aparelhos', { chip: '64999990001', marca: 'Samsung', modelo: 'A15', imei: '356938035643809', estado: 'novo' });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    const id = r.corpo.aparelho.id;
    assert.equal(repo.banco.chips.get('64999990001').aparelho_id, id);
    assert.equal(repo.banco.aparelhos.get(id).responsavel, 'Motorista Novo');
    assert.equal(repo.banco.aparelhos.get(id).centro_custo, '1005COML04');

    await chamar(SUP_TRANSPORTE, 'PUT', '/chips/64999990001', { responsavel: 'Outro Motorista', responsavel_cracha: '' });
    assert.equal(repo.banco.aparelhos.get(id).responsavel, 'Outro Motorista');

    const lista = (await chamar(SUP_TRANSPORTE, 'GET', '/controle')).corpo.linhas;
    assert.equal(lista[0].tipo, 'celular_chip');
    assert.equal(lista[0].aparelho.modelo, 'A15');

    const repetido = await chamar(GESTOR, 'POST', '/aparelhos', { centro_custo: '1005PAUX53', marca: 'Moto', imei: '356938035643809' });
    assert.equal(repetido.status, 409);
  });

  test('foto do celular: aceita imagem, recusa outro tipo', async () => {
    const id = repo.banco.chips.get('64999990001').aparelho_id;
    const ok = await chamar(SUP_TRANSPORTE, 'POST', `/aparelhos/${id}/fotos`, formulario({ foto: { conteudo: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), nome: 'foto.jpg', tipo: 'image/jpeg' } }));
    assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
    const ruim = await chamar(SUP_TRANSPORTE, 'POST', `/aparelhos/${id}/fotos`, formulario({ foto: { conteudo: Buffer.from('x'), nome: 'a.txt', tipo: 'text/plain' } }));
    assert.equal(ruim.status, 400);
    const ficha = (await chamar(SUP_TRANSPORTE, 'GET', `/ficha?aparelho=${id}`)).corpo;
    assert.equal(ficha.fotos.length, 1);
    assert.match(ficha.fotos[0].url, /^https:\/\/teste\/aparelhos\//);
    assert.equal((await chamar(SUP_TRANSPORTE, 'GET', '/controle')).corpo.linhas[0].aparelho.fotos, 1);
  });

  test('desvincular: o celular fica no CC como celular sem chip', async () => {
    const id = repo.banco.chips.get('64999990001').aparelho_id;
    const r = await chamar(SUP_TRANSPORTE, 'DELETE', '/chips/64999990001/aparelho?motivo=Celular%20quebrou');
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    const linhas = (await chamar(SUP_TRANSPORTE, 'GET', '/controle')).corpo.linhas;
    assert.deepEqual(linhas.map((l) => l.tipo).sort(), ['so_celular', 'so_chip']);
    const vinculo = await chamar(SUP_TRANSPORTE, 'POST', '/chips/64999990001/aparelho', { aparelho_id: id });
    assert.equal(vinculo.status, 200, JSON.stringify(vinculo.corpo));
    assert.equal(repo.banco.chips.get('64999990001').aparelho_id, id);
  });
});

describe('gestor (TI)', () => {
  test('troca o CC do chip: o celular vai junto e o supervisor antigo deixa de ver', async () => {
    const id = repo.banco.chips.get('64999990001').aparelho_id;
    const r = await chamar(GESTOR, 'PUT', '/chips/64999990001', { centro_custo: '1007paux50' });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal(repo.banco.chips.get('64999990001').centro_custo, '1005PAUX50');
    assert.equal(repo.banco.aparelhos.get(id).centro_custo, '1005PAUX50');
    assert.deepEqual((await chamar(SUP_TRANSPORTE, 'GET', '/controle')).corpo.linhas, []);
    const inexistente = await chamar(GESTOR, 'PUT', '/chips/64999990001', { centro_custo: '1005XXXX99' });
    assert.equal(inexistente.status, 400);
  });

  test('cadastra chip novo e não deixa repetir', async () => {
    const r = await chamar(GESTOR, 'POST', '/chips', { numero: '(64) 98433-0405', centro_custo: '1005COML04', setor: 'Transporte', plano: '10GB' });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal((await chamar(GESTOR, 'POST', '/chips', { numero: '64984330405' })).status, 409);
    assert.equal((await chamar(GESTOR, 'POST', '/chips', { numero: '123' })).status, 400);
    assert.equal((await chamar(SUP_TRANSPORTE, 'POST', '/chips', { numero: '64984330406' })).status, 403);
  });

  test('supervisores e gestores', async () => {
    const add = await chamar(GESTOR, 'POST', '/supervisores', { cracha: '900003', ccs: ['1005HEXT01', '1007PAUX53'] });
    assert.equal(add.status, 200, JSON.stringify(add.corpo));
    assert.deepEqual(add.corpo.supervisor.ccs, ['1005HEXT01', '1005PAUX53']);
    assert.deepEqual((await chamar('900003', 'GET', '/eu')).corpo.usuario.ccs, ['1005HEXT01', '1005PAUX53']);
    assert.equal((await chamar(GESTOR, 'POST', '/supervisores', { cracha: '123456', ccs: ['1005HEXT01'] })).status, 404);
    assert.equal((await chamar(SUP_TRANSPORTE, 'GET', '/equipe')).status, 403);
    assert.equal((await chamar(GESTOR, 'DELETE', `/gestores/${GESTOR}`)).status, 400);
    const equipe = (await chamar(GESTOR, 'GET', '/equipe')).corpo;
    assert.equal(equipe.supervisores.length, 2);
    await chamar(GESTOR, 'DELETE', '/supervisores/900003/1005PAUX53');
    assert.deepEqual((await chamar('900003', 'GET', '/eu')).corpo.usuario.ccs, ['1005HEXT01']);
  });

  test('rateio da fatura TIM com os chips da plataforma; multa inteira no CC informado', async () => {
    const pdf = criarPdf(
      linhasFaturaTim({
        porAcesso: [
          ['Mensalidades e Franquias', '64999990001', '30,00'],
          ['Mensalidades e Franquias', '64999990002', '20,00'],
          ['Mensalidades e Franquias', '64999990003', '10,00'],
        ],
        gerais: [['Outros Créditos e Débitos', '100,00']],
        total: '160,00',
      })
    );
    const r = await chamar(GESTOR, 'POST', '/rateio', formulario({ fatura: { conteudo: pdf, nome: 'fatura.pdf', tipo: 'application/pdf' }, ccValorGeral: '1005PAUX53' }));
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    const porCc = Object.fromEntries(r.corpo.grupos.map((g) => [g.centroCusto, g.total]));
    assert.deepEqual(porCc, { '1005PAUX50': 30, '1005HEXT01': 20, '1005PAUX53': 110 });
    assert.equal(Math.round(r.corpo.grupos.reduce((a, g) => a + g.total, 0) * 100), 16000);
    assert.ok(r.corpo.planilha.length > 100);
    assert.equal((await chamar(SUP_TRANSPORTE, 'POST', '/rateio', formulario({ fatura: { conteudo: pdf, nome: 'fatura.pdf' } }))).status, 403);
  });

  test('exportar gera o Controle de Chips que dá para importar de volta', async () => {
    const r = await chamar(GESTOR, 'GET', '/exportar');
    assert.equal(r.status, 200);
    const lido = lerControleChips(r.corpo, 'Controle_Chips.xlsx');
    assert.equal(lido.chips.size, repo.banco.chips.size);
    assert.equal(lido.chips.get('64999990001').centroCusto, '1005PAUX50');
  });

  test('excluir celular tira do chip e apaga as fotos', async () => {
    const id = repo.banco.chips.get('64999990001').aparelho_id;
    assert.equal((await chamar(SUP_TRANSPORTE, 'DELETE', `/aparelhos/${id}`)).status, 403);
    const r = await chamar(GESTOR, 'DELETE', `/aparelhos/${id}?motivo=Descartado`);
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal(repo.banco.chips.get('64999990001').aparelho_id, null);
    assert.equal(repo.banco.arquivos.size, 0);
  });
});

describe('pedidos para a TI', () => {
  // A esta altura o supervisor do Transporte cuida do chip 64984330405 (sem celular)
  test('supervisor pede para devolver o chip; não repete; regras de cada tipo', async () => {
    const r = await chamar(SUP_TRANSPORTE, 'POST', '/pedidos', { tipo: 'devolver', chip: '(64) 98433-0405', descricao: 'Motorista saiu, ninguém usa' });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal(r.corpo.pedido.status, 'aberto');
    assert.equal(r.corpo.pedido.centro_custo, '1005COML04');
    assert.match(r.corpo.pedido.tipoRotulo, /Devolver/);
    assert.equal((await chamar(SUP_TRANSPORTE, 'POST', '/pedidos', { tipo: 'devolver', chip: '64984330405' })).status, 409);
    assert.equal((await chamar(SUP_TRANSPORTE, 'POST', '/pedidos', { tipo: 'troca_aparelho', chip: '64984330405' })).status, 400);
    assert.equal((await chamar(SUP_TRANSPORTE, 'POST', '/pedidos', { tipo: 'outro', chip: '64984330405' })).status, 400);
    assert.equal((await chamar(SUP_TRANSPORTE, 'POST', '/pedidos', { tipo: 'perda', chip: '64999990002' })).status, 403);
    assert.equal((await chamar(SUP_TRANSPORTE, 'POST', '/pedidos', { tipo: 'xyz', chip: '64984330405' })).status, 400);
  });

  test('o pedido aberto aparece na lista, na ficha e no histórico', async () => {
    const linha = (await chamar(SUP_TRANSPORTE, 'GET', '/controle')).corpo.linhas.find((l) => l.numero === '64984330405');
    assert.deepEqual(linha.pedidos.map((p) => p.tipo), ['devolver']);
    const ficha = (await chamar(SUP_TRANSPORTE, 'GET', '/ficha?chip=64984330405')).corpo;
    assert.equal(ficha.pedidos.length, 1);
    assert.equal(ficha.historico[0].acao, 'pediu à TI');
    assert.equal((await chamar(SUP_TRANSPORTE, 'GET', '/pedidos')).corpo.pedidos.length, 1);
    assert.deepEqual((await chamar(SEM_PAPEL, 'GET', '/pedidos')).corpo.pedidos, []);
  });

  test('só a TI responde; recusar pede motivo; concluir fecha o pedido', async () => {
    const id = repo.banco.pedidos[0].id;
    assert.equal((await chamar(SUP_TRANSPORTE, 'PUT', `/pedidos/${id}`, { status: 'concluido' })).status, 403);
    assert.equal((await chamar(GESTOR, 'PUT', `/pedidos/${id}`, { status: 'recusado' })).status, 400);
    const r = await chamar(GESTOR, 'PUT', `/pedidos/${id}`, { status: 'concluido', resposta: 'Chip recolhido para a TI' });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal(r.corpo.pedido.status, 'concluido');
    assert.equal(r.corpo.pedido.resolvido_por, 'Gestor Teste (900001)');
    const linha = (await chamar(SUP_TRANSPORTE, 'GET', '/controle')).corpo.linhas.find((l) => l.numero === '64984330405');
    assert.deepEqual(linha.pedidos, []);
    assert.equal((await chamar(GESTOR, 'GET', '/pedidos?abertos=sim')).corpo.pedidos.length, 0);
    const ficha = (await chamar(GESTOR, 'GET', '/ficha?chip=64984330405')).corpo;
    assert.equal(ficha.historico[0].acao, 'pedido concluído');
    assert.equal((await chamar(SUP_TRANSPORTE, 'POST', '/pedidos', { tipo: 'devolver', chip: '64984330405' })).status, 200);
  });
});
