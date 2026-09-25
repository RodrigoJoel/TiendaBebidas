// ============================================================
//  API — Confirmar un pago de Mercado Pago
//  Cuando Mercado Pago devuelve al cliente a checkout.html, el
//  navegador manda el payment_id y acá se consulta el pago
//  directamente a Mercado Pago (no se confía en la URL). Si está
//  aprobado, el pedido pasa a "pagado", se descuenta el stock y se
//  mandan los mails. Llamarla varias veces con el mismo pago no
//  repite nada (el aviso de /api/webhook-mercadopago usa la misma
//  lógica, así que no importa cuál de los dos llegue primero).
// ============================================================
const { getDb } = require('./_lib/firebase-admin');
const { ErrorPedido, responderError } = require('./_lib/pedidos');
const { consultarPago, registrarPago } = require('./_lib/pagos');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  try {
    if (!process.env.MP_ACCESS_TOKEN) {
      res.status(500).json({ error: 'El pago no está configurado todavía (falta MP_ACCESS_TOKEN)' });
      return;
    }

    const paymentId = String(req.body?.paymentId ?? '').replace(/\D/g, '');
    if (!paymentId) throw new ErrorPedido('Falta el número de pago.');

    const pago = await consultarPago(paymentId);
    const { pedido } = await registrarPago(getDb(), pago);

    res.status(200).json({
      numero: pedido.numero,
      estado: pedido.estado,
      pagoEstado: pago.status,
      total: pedido.total
    });
  } catch (err) {
    responderError(res, err, 'No pudimos confirmar el pago. Si te lo cobraron, escribinos por WhatsApp.');
  }
};
