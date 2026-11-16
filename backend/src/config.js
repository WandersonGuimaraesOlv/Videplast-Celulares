// Única leitura de variáveis de ambiente do backend.
require('dotenv').config();

const producao = process.env.NODE_ENV === 'production';

module.exports = {
  porta: Number(process.env.PORT) || 5000,
  producao,
  supabaseUrl: process.env.SUPABASE_URL || '',
  // Chave secret (sb_secret_...): só o backend usa; as tabelas cel_* têm RLS sem políticas
  supabaseKey: process.env.SUPABASE_KEY || '',
  bucketFotos: process.env.BUCKET_FOTOS || 'celulares-fotos',
  // Filial dos chips (contrato TIM de Rio Verde) e da lista de centros de custo
  filial: Number(process.env.FILIAL) || 1005,
  limiteUploadMb: Number(process.env.LIMITE_UPLOAD_MB) || 20,
  // Só fora de produção (npm run dev): crachá usado quando o Nginx não manda o X-Usuario
  usuarioDev: producao ? '' : process.env.USUARIO_DEV || '',
};
