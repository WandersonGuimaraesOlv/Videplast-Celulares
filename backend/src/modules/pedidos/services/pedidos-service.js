// Pedidos para a TI: o supervisor avisa que não precisa mais de um chip/celular (devolver), pede
// reposição do chip, informa perda ou roubo, ou pede troca/conserto do celular. O pedido não muda o
// cadastro sozinho: a TI resolve (no cadastro e na TIM) e responde aqui. Tudo fica no histórico do item.
const { erro } = require('../../shared/erros');
const { texto } = require('../../shared/campos');
const { normalizarTelefone } = require('../../telefonia/services/controle-chips-service');
const { formatarTelefone } = require('../../telefonia/services/rateio-telefonia-service');

const TIPOS_PEDIDO = {
  devolver: 'Devolver para a TI (não precisamos mais)',
  reposicao: 'Reposição do chip (defeito ou perdido)',
  perda: 'Perda ou roubo',
  troca_aparelho: 'Celular com defeito (troca ou conserto)',
  outro: 'Outro pedido',
};
const STATUS_PEDIDO = { aberto: 'Aberto', em_andamento: 'Em andamento', concluido: 'Concluído', recusado: 'Recusado' };
const ABERTOS = ['aberto', 'em_andamento'];

/**
 * @param {{ repo: object, agora?: () => string }} deps
 */
function criarPedidos({ repo, agora = () => new Date().toISOString() }) {
  const quem = (u) => (u.nome ? `${u.nome} (${u.cracha})` : u.cracha);
  const historico = (u, tipo, chave, acao, motivo) => ({
    tipo, chave: String(chave), acao, mudancas: [], motivo: texto(motivo, 300), quem_cracha: u.cracha, quem_nome: u.nome || '', quando: agora(),
  });
  function exigirCc(u, cc) {
    if (u.gestor) return;
    if (!cc) throw erro(403, 'Este item está sem centro de custo: só a TI pode mexer nele.');
    if (!u.ccs.includes(cc)) throw erro(403, `O centro de custo ${cc} não está sob sua supervisão.`);
  }
  /** Registro do histórico no chip e/ou no celular do pedido. */
  const nosItens = (u, pedido, acao, motivo) =>
    [
      pedido.numero_chip && historico(u, 'chip', pedido.numero_chip, acao, motivo),
      pedido.aparelho_id && historico(u, 'aparelho', pedido.aparelho_id, acao, motivo),
    ].filter(Boolean);
  const comRotulos = (p) => ({
    ...p,
    numeroFormatado: p.numero_chip ? formatarTelefone(p.numero_chip) : '',
    tipoRotulo: TIPOS_PEDIDO[p.tipo] || p.tipo,
    statusRotulo: STATUS_PEDIDO[p.status] || p.status,
  });

  /** Novo pedido sobre um chip (entrada.chip) ou um celular sem chip (entrada.aparelho). */
  async function criar(u, entrada = {}) {
    const tipo = String(entrada.tipo || '');
    if (!TIPOS_PEDIDO[tipo]) throw erro(400, 'Escolha o tipo do pedido.');
    const descricao = texto(entrada.descricao, 500);
    if (tipo === 'outro' && !descricao) throw erro(400, 'Conte o que você precisa da TI.');

    let chip = null;
    let aparelho = null;
    if (entrada.chip) {
      const numero = normalizarTelefone(entrada.chip);
      chip = numero ? await repo.buscarChip(numero) : null;
      if (!chip) throw erro(404, 'Chip não encontrado.');
      if (chip.aparelho_id) aparelho = await repo.buscarAparelho(chip.aparelho_id);
    } else if (entrada.aparelho) {
      const id = Number(entrada.aparelho);
      aparelho = Number.isInteger(id) && id > 0 ? await repo.buscarAparelho(id) : null;
      if (!aparelho) throw erro(404, 'Celular não encontrado.');
      chip = await repo.chipDoAparelho(aparelho.id);
    } else {
      throw erro(400, 'Informe o chip ou o celular do pedido.');
    }
    if (tipo === 'reposicao' && !chip) throw erro(400, 'Reposição de chip só vale para um item que tem chip.');
    if (tipo === 'troca_aparelho' && !aparelho) throw erro(400, 'Este chip não tem celular cadastrado. Cadastre o celular antes de pedir a troca.');
    const cc = chip ? chip.centro_custo : aparelho.centro_custo;
    exigirCc(u, cc);

    const doItem = await repo.pedidosDoItem({ numero: chip ? chip.numero : '', aparelhoId: aparelho ? aparelho.id : null });
    const repetido = doItem.find((p) => p.tipo === tipo && ABERTOS.includes(p.status));
    if (repetido) throw erro(409, `Já existe um pedido aberto deste tipo para este item (pedido nº ${repetido.id}).`);

    const pedido = await repo.inserirPedido({
      tipo,
      numero_chip: chip ? chip.numero : '',
      aparelho_id: aparelho ? aparelho.id : null,
      centro_custo: cc || '',
      responsavel: (chip ? chip.responsavel : aparelho.responsavel) || '',
      descricao,
      status: 'aberto',
      pedido_por: quem(u),
      pedido_por_cracha: u.cracha,
      criado_em: agora(),
      atualizado_em: agora(),
    });
    await repo.registrarHistorico(nosItens(u, pedido, 'pediu à TI', `${TIPOS_PEDIDO[tipo]}${descricao ? `: ${descricao}` : ''}`));
    return comRotulos(pedido);
  }

  /** Pedidos que a pessoa enxerga: TI vê todos; supervisor, os dos CCs dele. */
  async function listar(u, { somenteAbertos = false } = {}) {
    const pedidos = await repo.listarPedidos({ ccs: u.gestor ? null : u.ccs, somenteAbertos });
    return pedidos.map(comRotulos);
  }

  /** TI muda a situação do pedido e responde. Concluir/recusar fecham o pedido. */
  async function atualizar(u, id, entrada = {}) {
    if (!u.gestor) throw erro(403, 'Só a TI responde os pedidos.');
    const n = Number(id);
    const pedido = Number.isInteger(n) && n > 0 ? await repo.buscarPedido(n) : null;
    if (!pedido) throw erro(404, 'Pedido não encontrado.');
    const status = String(entrada.status || '');
    if (!STATUS_PEDIDO[status]) throw erro(400, 'Situação do pedido inválida.');
    const resposta = texto(entrada.resposta, 500);
    if (status === 'recusado' && !resposta) throw erro(400, 'Diga o motivo de recusar o pedido.');
    const fecha = status === 'concluido' || status === 'recusado';
    const atualizado = await repo.atualizarPedido(pedido.id, {
      status,
      resposta: resposta || pedido.resposta,
      atualizado_em: agora(),
      resolvido_por: fecha ? quem(u) : '',
      resolvido_em: fecha ? agora() : null,
    });
    await repo.registrarHistorico(
      nosItens(u, pedido, `pedido ${STATUS_PEDIDO[status].toLowerCase()}`, `${TIPOS_PEDIDO[pedido.tipo]}${resposta ? `: ${resposta}` : ''}`)
    );
    return comRotulos(atualizado);
  }

  return { criar, listar, atualizar };
}

/** Pedidos abertos por item, para marcar a lista: chave "chip-<número>" ou "aparelho-<id>". */
function abertosPorItem(pedidos) {
  const mapa = new Map();
  for (const p of pedidos) {
    if (!ABERTOS.includes(p.status)) continue;
    const resumo = { id: p.id, tipo: p.tipo, tipoRotulo: TIPOS_PEDIDO[p.tipo] || p.tipo, status: p.status };
    for (const chave of [p.numero_chip && `chip-${p.numero_chip}`, p.aparelho_id && `aparelho-${p.aparelho_id}`].filter(Boolean)) {
      mapa.set(chave, [...(mapa.get(chave) || []), resumo]);
    }
  }
  return mapa;
}

module.exports = { criarPedidos, abertosPorItem, TIPOS_PEDIDO, STATUS_PEDIDO };
