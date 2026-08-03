const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Precisa do corpo raw para verificar assinatura do Stripe
export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook assinatura inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const obj = event.data.object;

  try {
    switch (event.type) {
      // Assinatura criada ou renovada
      case 'customer.subscription.updated': {
        const status = obj.status === 'active' ? 'active' : 'inactive';
        await supabase
          .from('subscriptions')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', obj.id);
        break;
      }

      // Assinatura cancelada
      case 'customer.subscription.deleted': {
        await supabase
          .from('subscriptions')
          .update({ status: 'inactive', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', obj.id);
        break;
      }

      // Pagamento falhou
      case 'invoice.payment_failed': {
        const customerId = obj.customer;
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', customerId);
        break;
      }

      default:
        // Ignorar outros eventos
        break;
    }
  } catch (err) {
    console.error('Erro ao processar webhook:', err);
    return res.status(500).json({ error: err.message });
  }

  res.json({ received: true });
};
