/**
 * Reduz a foto no próprio celular antes de enviar (lado maior até 1600 px, JPEG): uma foto de
 * 4 MB vira uns 300 KB, o envio fica rápido no 4G e o armazenamento não enche.
 * @param {File} arquivo
 * @returns {Promise<Blob>}
 */
export async function reduzirFoto(arquivo, maximo = 1600, qualidade = 0.82) {
  if (!arquivo || !String(arquivo.type).startsWith('image/')) throw new Error('Escolha uma imagem (foto do celular).')
  const url = URL.createObjectURL(arquivo)
  try {
    const imagem = await new Promise((resolver, rejeitar) => {
      const img = new Image()
      img.onload = () => resolver(img)
      img.onerror = () => rejeitar(new Error('Não consegui abrir esta imagem. Tire a foto de novo.'))
      img.src = url
    })
    const escala = Math.min(1, maximo / Math.max(imagem.naturalWidth, imagem.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala))
    canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala))
    canvas.getContext('2d').drawImage(imagem, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolver) => canvas.toBlob(resolver, 'image/jpeg', qualidade))
    if (!blob) throw new Error('Não consegui preparar a foto para envio.')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}
