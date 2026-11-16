/**
 * Erro com o código HTTP que a rota deve responder e uma mensagem para mostrar na tela.
 * 400 dado inválido, 401 sem identificação, 403 sem permissão, 404 não existe, 409 conflito.
 */
function erro(status, mensagem) {
  const e = new Error(mensagem);
  e.status = status;
  return e;
}

module.exports = { erro };
