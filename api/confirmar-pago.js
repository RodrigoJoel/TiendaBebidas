// ============================================================
//  API — Confirmar un pago de Mercado Pago
//  Cuando Mercado Pago devuelve al cliente a checkout.html, el
//  navegador manda el payment_id y acá se consulta el pago
//  directamente a Mercado Pago (no se confía en la URL). Si está
//  aprobado, el pedido pasa a "pagado" y se mandan los mails.
//  Llamarla varias veces con el mismo pago no repite nada.
// ============================================================
const { MercadoPagoConfig, Payment } = require('mercadopago');
const { FieldValue } = require('firebase-admin/firestore');
const { getDb } = require('./_lib/firebase-admin');
const { ErrorPedido, responderError } = require('./_lib/pedidos');
const { enviarMailsDePedido } = require('./_lib/mail');

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

    const paymentId = String(req.body?.paymentId ?? '').replace(/\D/g, '');
    if (!paymentId) throw new ErrorPedido('Falta el número de pago.');

    let pago;
    try {
      pago = await new Payment(new MercadoPagoConfig({ accessToken })).get({ id: paymentId });
    } catch (err) {
      console.error('Mercado Pago no devolvió el pago', paymentId, err);
      throw new ErrorPedido('No encontramos ese pago en Mercado Pago.', 404);
    }

    const numero = String(pago.external_reference || '');
    if (!numero || numero.includes('/')) throw new ErrorPedido('El pago no corresponde a un pedido de la tienda.', 404);

    const db = getDb();
    const ref = db.collection('pedidos').doc(numero);
    const datosPago = {
      id: String(pago.id),
      estado: pago.status,
      detalle: pago.status_detail || '',
      monto: Number(pago.transaction_amount) || 0,
      fecha: pago.date_approved || pago.date_created || null
    };

    const { pedido, recienPagado } = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ErrorPedido('No encontramos el pedido de este pago.', 404);

      const actual = snap.data();
      if (actual.estado === 'pagado' || actual.estado === 'revisar_pago') {
        return { pedido: actual, recienPagado: false };
      }

      const cambios = { 'mercadoPago.pago': datosPago, actualizadoEn: FieldValue.serverTimestamp() };
      if (pago.status === 'approved') {
        // Si el monto cobrado no coincide con el total del pedido, no se
        // da por pagado: queda marcado para revisarlo a mano.
        cambios.estado = Math.abs(datosPago.monto - Number(actual.total)) < 1 ? 'pagado' : 'revisar_pago';
      }
      tx.update(ref, cambios);

      return {
        pedido: { ...actual, ...(cambios.estado ? { estado: cambios.estado } : {}), mercadoPago: { ...actual.mercadoPago, pago: datosPago } },
        recienPagado: Boolean(cambios.estado)
      };
    });

    if (recienPagado) {
      await enviarMailsDePedido(pedido, { alCliente: pedido.estado === 'pagado' });
    }

    res.status(200).json({
      numero,
      estado: pedido.estado,
      pagoEstado: pago.status,
      total: pedido.total
    });
  } catch (err) {
    responderError(res, err, 'No pudimos confirmar el pago. Si te lo cobraron, escribinos por WhatsApp.');
  }
};
