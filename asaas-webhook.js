import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const event = req.body;
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    const payment = event.payment;
    const userId = payment?.externalReference;

    if (!userId) return res.status(200).json({ received: true });

    // Pagamento confirmado → ativar assinatura
    if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event.event)) {
      await sb.from('subscriptions').upsert({
        user_id: userId,
        status: 'active',
        price_id: 'pix_mensal',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    }

    // Pagamento vencido ou estornado → desativar
    if (['PAYMENT_OVERDUE', 'PAYMENT_REFUNDED', 'PAYMENT_DELETED'].includes(event.event)) {
      await sb.from('subscriptions').update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      }).eq('user_id', userId);
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('asaas-webhook error:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
