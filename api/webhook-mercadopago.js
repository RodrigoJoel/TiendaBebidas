// ============================================================
//  API — Aviso (webhook) de Mercado Pago
//  Mercado Pago llama acá cada vez que se crea o cambia un pago,
//  aunque el cliente haya cerrado la pestaña antes de volver al
//  checkout. El pago se registra con la misma lógica que
//  /api/confirmar-pago: se consulta a Mercado Pago, no se confía en
//  el contenido del aviso.
//
//  Responde 200 a lo que no hay que reintentar (avisos de otro tipo,
//  pagos que no son de la tienda) y 500 si falló algo de nuestro
//  lado, así Mercado Pago vuelve a avisar más tarde.
//
//  Si está cargada MP_WEBHOOK_SECRET (la clave secreta de Webhooks
//  del panel de Mercado Pago), se rechazan los avisos sin firma válida.
// ============================================================
const crypto = require('crypto');
const { getDb } = require('./_lib/firebase-admin');
const { ErrorPedido } = require('./_lib/pedidos');
const { consultarPago, registrarPago } = require('./_lib/pagos');

// Firma de Mercado Pago: header x-signature = "ts=...,v1=<hmac sha256>"
// sobre "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
function firmaValida(req, dataId) {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto) return true;

  const partes = {};
  for (const parte of String(req.headers['x-signature'] || '').split(',')) {
    const [clave, valor] = parte.split('=');
    if (clave && valor) partes[clave.trim()] = valor.trim();
  }
  if (!partes.ts || !partes.v1) return false;

  const requestId = req.headers['x-request-id'];
  const manifiesto = `id:${dataId};${requestId ? `request-id:${requestId};` : ''}ts:${partes.ts};`;
  const esperada = crypto.createHmac('sha256', secreto).update(manifiesto).digest('hex');

  return partes.v1.length === esperada.length &&
    crypto.timingSafeEqual(Buffer.from(partes.v1), Buffer.from(esperada));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const query = req.query || {};
  const body = req.body || {};
  const tipo = String(body.type || query.type || query.topic || '');
  const dataId = String(query['data.id'] || body.data?.id || query.id || '').toLowerCase();
  const paymentId = dataId.replace(/\D/g, '');

  // Solo interesan los pagos (Mercado Pago también avisa de órdenes, etc.).
  if (tipo !== 'payment' || !paymentId) {
    res.status(200).json({ ok: true, ignorado: tipo || 'sin tipo' });
    return;
  }

  if (!firmaValida(req, dataId)) {
    console.error('Aviso de Mercado Pago con firma inválida', paymentId);
    res.status(401).json({ error: 'Firma inválida' });
    return;
  }

  try {
    const pago = await consultarPago(paymentId);
    const { pedido } = await registrarPago(getDb(), pago);
    res.status(200).json({ ok: true, numero: pedido.numero, estado: pedido.estado });
  } catch (err) {
    if (err instanceof ErrorPedido) {
      // Pago inexistente o que no es de un pedido de la tienda
      // (por ejemplo, la notificación de prueba del panel).
      res.status(200).json({ ok: true, ignorado: err.message });
      return;
    }
    console.error('No se pudo procesar el aviso de Mercado Pago', paymentId, err);
    res.status(500).json({ error: 'No se pudo procesar el aviso' });
  }
};
