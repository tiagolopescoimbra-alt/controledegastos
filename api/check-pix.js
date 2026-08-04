import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { charge_id, user_id } = req.query;
  if (!charge_id) return res.status(400).json({ error: 'charge_id obrigatório' });

  // Suporta os dois nomes possíveis da service key
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_SERVICE_KEY) {
    console.error('SUPABASE_SERVICE_KEY não configurada nas variáveis de ambiente');
  }

  try {
    const response = await fetch(`https://www.asaas.com/api/v3/payments/${charge_id}`, {
      headers: { 'access_token': process.env.ASAAS_API_KEY }
    });
    const data = await response.json();
    console.log('Asaas payment status:', data.status, 'charge:', charge_id);

    const paid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(data.status);

    if (paid && user_id) {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('Variáveis Supabase ausentes — não foi possível ativar assinatura');
        return res.status(200).json({ status: data.status, paid, supabase_error: 'env vars ausentes' });
      }

      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { error: upsertError } = await sb.from('subscriptions').upsert({
        user_id,
        status: 'active',
        price_id: 'pix_mensal',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Erro ao ativar assinatura no Supabase:', JSON.stringify(upsertError));
        return res.status(200).json({ status: data.status, paid, supabase_error: upsertError.message });
      }

      console.log('Assinatura ativada com sucesso para user_id:', user_id);
    }

    return res.status(200).json({ status: data.status, paid });

  } catch (err) {
    console.error('check-pix error:', err.message);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
