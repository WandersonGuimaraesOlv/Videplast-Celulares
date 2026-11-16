// Limpeza dos campos que chegam das telas e comparação "antes x depois" para o histórico.
const { erro } = require('./erros');

const ESTADOS = ['novo', 'bom', 'regular', 'ruim', 'quebrado'];
const SITUACOES_APARELHO = ['em_uso', 'reserva', 'manutencao', 'descartado'];
const SITUACOES_CHIP = ['ativo', 'reserva', 'cancelado'];

const ROTULOS = {
  numero: 'Chip',
  responsavel: 'Quem usa',
  responsavel_cracha: 'Crachá de quem usa',
  setor: 'Setor',
  centro_custo: 'Centro de custo',
  plano: 'Plano',
  operadora: 'Operadora',
  situacao: 'Situação',
  observacao: 'Observação',
  marca: 'Marca',
  modelo: 'Modelo',
  imei: 'IMEI',
  patrimonio: 'Patrimônio',
  estado: 'Estado do celular',
  aparelho: 'Celular',
};

/** Texto de uma linha só, sem espaços repetidos. */
const texto = (valor, maximo = 120) => String(valor ?? '').replace(/\s+/g, ' ').trim().slice(0, maximo);

/**
 * Código de centro de custo conferido no cadastro: "1007paux21" → "1005PAUX21" (em RV todo CC é 1005).
 * Vazio continua vazio. Código que não existe no cadastro → erro 400.
 */
function centroCustoValido(valor, cadastro) {
  const codigo = String(valor ?? '').replace(/\s+/g, '').toUpperCase();
  if (!codigo) return '';
  if (!/^[0-9A-Z]{4,20}$/.test(codigo)) throw erro(400, `Centro de custo inválido: "${codigo}".`);
  const ajustado = cadastro.ajustarUnidade(codigo);
  if (!cadastro.buscar(ajustado)) throw erro(400, `O centro de custo ${codigo} não existe no cadastro de centros de custo.`);
  return ajustado;
}

/**
 * Só os campos permitidos, limpos e validados. Campos ausentes na entrada não aparecem na saída
 * (a gravação mexe só no que veio).
 * @param {Record<string, unknown>} entrada
 * @param {string[]} permitidos
 * @param {{ tipo: 'chip' | 'aparelho', cadastro: { ajustarUnidade(c: string): string, buscar(c: string): unknown } }} contexto
 */
function limparCampos(entrada, permitidos, { tipo, cadastro }) {
  const saida = {};
  for (const campo of permitidos) {
    if (!Object.prototype.hasOwnProperty.call(entrada || {}, campo)) continue;
    const valor = entrada[campo];
    switch (campo) {
      case 'centro_custo':
        saida.centro_custo = centroCustoValido(valor, cadastro);
        break;
      case 'responsavel_cracha': {
        const c = texto(valor, 20);
        if (c && !/^\d{1,10}$/.test(c)) throw erro(400, 'Crachá de quem usa: só números.');
        saida.responsavel_cracha = c;
        break;
      }
      case 'imei': {
        const c = String(valor ?? '').replace(/\D/g, '');
        if (c && (c.length < 14 || c.length > 16)) throw erro(400, 'O IMEI tem 15 números (aparece discando *#06# no celular).');
        saida.imei = c;
        break;
      }
      case 'estado':
        if (!ESTADOS.includes(valor)) throw erro(400, 'Estado do celular inválido.');
        saida.estado = valor;
        break;
      case 'situacao': {
        const lista = tipo === 'chip' ? SITUACOES_CHIP : SITUACOES_APARELHO;
        if (!lista.includes(valor)) throw erro(400, 'Situação inválida.');
        saida.situacao = valor;
        break;
      }
      case 'operadora':
        saida.operadora = texto(valor, 30).toUpperCase() || 'TIM';
        break;
      case 'observacao':
        saida.observacao = texto(valor, 500);
        break;
      default:
        saida[campo] = texto(valor);
    }
  }
  return saida;
}

/** O que muda entre o registro e os campos novos: [{ campo, rotulo, antes, depois }]. */
function diferencas(antes, depois) {
  return Object.keys(depois)
    .filter((campo) => String(antes?.[campo] ?? '') !== String(depois[campo] ?? ''))
    .map((campo) => ({ campo, rotulo: ROTULOS[campo] || campo, antes: antes?.[campo] ?? '', depois: depois[campo] ?? '' }));
}

module.exports = { ESTADOS, SITUACOES_APARELHO, SITUACOES_CHIP, ROTULOS, texto, centroCustoValido, limparCampos, diferencas };
