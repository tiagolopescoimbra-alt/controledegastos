const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { session_id, user_id } = req.query;

  if (!session_id || !user_id) {
    return res.status(400).json({ error: 'session_id e user_id são obrigatórios' });
  }

  try {
    // Buscar a sessão no Stripe para confirmar o pagamento
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      return res.json({ active: false, reason: 'Pagamento não concluído' });
    }

    // Salvar/atualizar assinatura no Supabase
    const { error } = await supabase.from('subscriptions').upsert(
      {
        user_id,
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        status: 'active',
        price_id: process.env.STRIPE_PRICE_ID,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.error('Erro ao salvar no Supabase:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ active: true });
  } catch (err) {
    console.error('Erro ao verificar sessão:', err);
    res.status(500).json({ error: err.message });
  }
};
