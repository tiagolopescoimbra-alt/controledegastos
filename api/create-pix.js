export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { user_id, email, name, cpfCnpj } = req.body;
  const ASAAS_KEY = process.env.ASAAS_API_KEY;
  const ASAAS_URL = 'https://www.asaas.com/api/v3';

  if (!ASAAS_KEY) {
    console.error('ASAAS_API_KEY não configurada');
    return res.status(500).json({ error: 'Chave API não configurada' });
  }

  // Limpar CPF/CNPJ (só dígitos)
  const cpfCnpjClean = (cpfCnpj || '').replace(/\D/g, '');
  if (!cpfCnpjClean || (cpfCnpjClean.length !== 11 && cpfCnpjClean.length !== 14)) {
    return res.status(400).json({ error: 'CPF ou CNPJ inválido' });
  }

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
      console.log('Cliente existente encontrado:', customerId);

      // Atualizar o cliente com o CPF/CNPJ
      const updateRes = await fetch(`${ASAAS_URL}/customers/${customerId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ cpfCnpj: cpfCnpjClean })
      });
      const updateData = await updateRes.json();
      console.log('Cliente atualizado:', JSON.stringify(updateData));
    } else {
      const custRes = await fetch(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: name || email.split('@')[0],
          email,
          cpfCnpj: cpfCnpjClean,
          externalReference: user_id,
          notificationDisabled: true
        })
      });
      const custData = await custRes.json();
      console.log('Cliente criado:', JSON.stringify(custData));
      if (!custData.id) {
        return res.status(400).json({ error: 'Erro ao criar cliente', details: custData });
      }
      customerId = custData.id;
    }

    // 2. Criar cobrança PIX
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const paymentBody = {
      customer: customerId,
      billingType: 'PIX',
      value: 29.90,
      dueDate,
      description: 'FinGestor - Assinatura Mensal',
      externalReference: user_id,
      postalService: false
    };
    console.log('Criando pagamento PIX...');

    const payRes = await fetch(`${ASAAS_URL}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(paymentBody)
    });
    const payData = await payRes.json();
    console.log('Asaas payment response (status ' + payRes.status + '):', JSON.stringify(payData));

    if (!payData.id) {
      return res.status(400).json({ error: 'Erro ao criar cobrança', details: payData });
    }

    // 3. Buscar QR Code
    const qrRes = await fetch(`${ASAAS_URL}/payments/${payData.id}/pixQrCode`, { headers });
    const qrData = await qrRes.json();
    console.log('QR Code response:', JSON.stringify(qrData));

    return res.status(200).json({
      chargeId: payData.id,
      pixCode: qrData.payload,
      qrCodeImage: qrData.encodedImage,
      value: payData.value,
      dueDate: payData.dueDate
    });

  } catch (err) {
    console.error('create-pix error:', err.message, err.stack);
    return res.status(500).json({ error: 'Erro interno ao gerar PIX' });
  }
}
