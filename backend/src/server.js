const config = require('./config');
const supabase = require('./lib/supabase');
const { criarApp } = require('./app');
const { criarRepositorioSupabase, repositorioIndisponivel } = require('./modules/dados');

const repo = supabase ? criarRepositorioSupabase(supabase, { bucket: config.bucketFotos }) : repositorioIndisponivel();
const app = criarApp({ repo, filial: config.filial, usuarioDev: config.usuarioDev, limiteUploadMb: config.limiteUploadMb });

app.listen(config.porta, () => console.log(`[Servidor] Celulares e Chips ativo na porta ${config.porta}`));
