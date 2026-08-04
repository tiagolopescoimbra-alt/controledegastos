export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { user_id, email, name } = req.body;
  const ASAAS_KEY = process.env.ASAAS_API_KEY;
  const ASAAS_URL = 'https://www.asaas.com/api/v3';

  const headers = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_KEY
  };

  try {
    // 1. Buscar ou criar cliente no Asaas
    let customerId;
    const searchRes = await fetch(`${ASAAS_URL}/customers?email=${encodeURIComponent(email)}&limit=1`, { headers });
    const searchData = await searchRes.json();

    if (searchData.data && searchData.data.length > 0) {
      customerId = searchData.data[0].id;
    } else {
      const custRes = await fetch(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: name || email.split('@')[0],
          email,
          externalReference: user_id
        })
      });
      const custData = await custRes.json();
      if (!custData.id) return res.status(400).json({ error: 'Erro ao criar cliente', details: custData });
      customerId = custData.id;
    }

    // 2. Criar cobrança PIX
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const payRes = await fetch(`${ASAAS_URL}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: 29.90,
        dueDate,
        description: 'FinGestor - Assinatura Mensal',
        externalReference: user_id
      })
    });
    const payData = await payRes.json();
    if (!payData.id) return res.status(400).json({ error: 'Erro ao criar cobrança', details: payData });

    // 3. Buscar QR Code
    const qrRes = await fetch(`${ASAAS_URL}/payments/${payData.id}/pixQrCode`, { headers });
    const qrData = await qrRes.json();

    return res.status(200).json({
      chargeId: payData.id,
      pixCode: qrData.payload,
      qrCodeImage: qrData.encodedImage,
      value: payData.value,
      dueDate: payData.dueDate
    });

  } catch (err) {
    console.error('create-pix error:', err);
    return res.status(500).json({ error: 'Erro interno ao gerar PIX' });
  }
}
