const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

// Sem as variáveis o servidor sobe (o /api/health responde), mas as telas avisam que falta o banco.
let supabase = null;
if (!config.supabaseUrl || !config.supabaseKey) {
  console.warn('[Supabase] SUPABASE_URL/SUPABASE_KEY não configurados no .env.');
} else {
  supabase = createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false } });
}

module.exports = supabase;
