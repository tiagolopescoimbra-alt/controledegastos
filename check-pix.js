import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { charge_id, user_id } = req.query;
  if (!charge_id) return res.status(400).json({ error: 'charge_id obrigatório' });

  try {
    const response = await fetch(`https://www.asaas.com/api/v3/payments/${charge_id}`, {
      headers: { 'access_token': process.env.ASAAS_API_KEY }
    });
    const data = await response.json();

    const paid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(data.status);

    if (paid && user_id) {
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      await sb.from('subscriptions').upsert({
        user_id,
        status: 'active',
        price_id: 'pix_mensal',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    }

    return res.status(200).json({ status: data.status, paid });

  } catch (err) {
    console.error('check-pix error:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
