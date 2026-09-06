// ============================================================
//  API — Crear preferencia de pago (Mercado Pago Checkout Pro)
//  Función serverless (Vercel). Corre en el servidor: acá vive
//  el Access Token, nunca en el navegador.
//
//  Vuelve a leer precio y nombre desde Firestore por id de
//  producto (no confía en lo que mande el navegador) para que
//  nadie pueda alterar el precio manipulando el carrito local.
// ============================================================
const { MercadoPagoConfig, Preference } = require('mercadopago');
const admin = require('firebase-admin');

const COSTO_ENVIO = 20000;

function getAdminApp() {
  if (admin.apps.length) return admin.app();

  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  if (!raw) throw new Error('Falta configurar FIREBASE_SERVICE_ACCOUNT_KEY');

  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const serviceAccount = JSON.parse(json);

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      res.status(500).json({ error: 'El pago no está configurado todavía (falta MP_ACCESS_TOKEN)' });
      return;
    }

    const { cartItems, orderNumber, payerEmail } = req.body || {};

    if (!Array.isArray(cartItems) || !cartItems.length) {
      res.status(400).json({ error: 'El carrito está vacío' });
      return;
    }

    const db = getAdminApp().firestore();

    const items = [];
    for (const entry of cartItems) {
      const qty = Math.max(1, Math.min(50, Math.floor(Number(entry?.qty) || 0)));
      if (!entry?.id || !qty) continue;

      const snap = await db.collection('productos').doc(String(entry.id)).get();
      if (!snap.exists) continue;

      const prod = snap.data();
      const price = Number(prod.price) || 0;
      if (price <= 0) continue;

      items.push({
        title: String(prod.name || 'Producto').slice(0, 250),
        quantity: qty,
        unit_price: price,
        currency_id: 'ARS'
      });
    }

    if (!items.length) {
      res.status(400).json({ error: 'No pudimos validar los productos del carrito' });
      return;
    }

    items.push({
      title: 'Envío',
      quantity: 1,
      unit_price: COSTO_ENVIO,
      currency_id: 'ARS'
    });

    const origin = `https://${req.headers.host}`;
    const mpClient = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(mpClient);

    const result = await preference.create({
      body: {
        items,
        payer: payerEmail ? { email: payerEmail } : undefined,
        external_reference: orderNumber || '',
        back_urls: {
          success: `${origin}/checkout.html`,
          failure: `${origin}/checkout.html`,
          pending: `${origin}/checkout.html`
        },
        auto_return: 'approved',
        statement_descriptor: 'GLOBAL IMPORTADOS'
      }
    });

    res.status(200).json({
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point
    });
  } catch (err) {
    console.error('Error al crear preferencia de Mercado Pago:', err);
    res.status(500).json({ error: 'No se pudo generar el pago. Intentá de nuevo.' });
  }
};
