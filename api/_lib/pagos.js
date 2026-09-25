// ============================================================
//  Pagos de Mercado Pago — lógica común de /api/confirmar-pago
//  (cuando el cliente vuelve al checkout) y /api/webhook-mercadopago
//  (cuando avisa Mercado Pago, aunque el cliente cierre la pestaña).
//
//  El pago siempre se consulta a Mercado Pago con el Access Token:
//  nunca se confía en la URL ni en el contenido del aviso. Registrar
//  varias veces el mismo pago no repite nada (ni stock ni mails).
// ============================================================
const { MercadoPagoConfig, Payment } = require('mercadopago');
const { FieldValue } = require('firebase-admin/firestore');
const { ErrorPedido, descontarStock } = require('./pedidos');
const { enviarMailsDePedido } = require('./mail');

// Estados de un pago ya aprobado que Mercado Pago revirtió después.
const PAGO_REVERTIDO = { refunded: 'devolvió', charged_back: 'recibió un contracargo de' };

async function consultarPago(paymentId) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error('Falta configurar MP_ACCESS_TOKEN');

  try {
    return await new Payment(new MercadoPagoConfig({ accessToken })).get({ id: paymentId });
  } catch (err) {
    // 404: el pago no existe o es de otra cuenta. Cualquier otro error
    // (Mercado Pago caído, token vencido) se trata como error nuestro.
    if (err?.status === 404 || err?.status === 400) {
      throw new ErrorPedido('No encontramos ese pago en Mercado Pago.', 404);
    }
    throw err;
  }
}

// Los motivos para revisar un pedido se acumulan, no se pisan.
function sumarMotivo(pedido, motivo) {
  return [pedido.motivoRevision, motivo].filter(Boolean).join(' ');
}

function datosDelPago(pago) {
  return {
    id: String(pago.id),
    estado: pago.status,
    detalle: pago.status_detail || '',
    monto: Number(pago.transaction_amount) || 0,
    fecha: pago.date_approved || pago.date_created || null
  };
}

// Guarda el pago en su pedido. Si es la primera vez que se aprueba:
// descuenta el stock, pasa el pedido a "pagado" (o a "revisar_pago" si
// algo no cierra) y manda los mails.
async function registrarPago(db, pago) {
  const numero = String(pago.external_reference || '');
  if (!numero || numero.includes('/')) throw new ErrorPedido('El pago no corresponde a un pedido de la tienda.', 404);

  const ref = db.collection('pedidos').doc(numero);
  const datosPago = datosDelPago(pago);

  const { pedido, recienPagado } = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ErrorPedido('No encontramos el pedido de este pago.', 404);

    const actual = snap.data();
    const aprobadoId = actual.mercadoPago?.pagoAprobadoId || null;
    const cambios = {};

    if (aprobadoId && aprobadoId !== datosPago.id) {
      // Ya hay otro pago aprobado. Si este también se aprobó, Mercado
      // Pago cobró dos veces; si no, es un intento anterior (por ejemplo
      // una tarjeta rechazada) y no se toca nada.
      if (datosPago.estado !== 'approved' || (actual.motivoRevision || '').includes(datosPago.id)) {
        return { pedido: actual, recienPagado: false };
      }
      cambios.estado = 'revisar_pago';
      cambios.motivoRevision = sumarMotivo(actual, `Mercado Pago cobró dos veces este pedido (pago ${datosPago.id}): devolvé uno de los dos pagos.`);
    } else if (aprobadoId) {
      // Mismo pago que ya estaba aprobado: solo interesa si se revirtió.
      if (actual.mercadoPago.pago?.estado === datosPago.estado) {
        return { pedido: actual, recienPagado: false };
      }
      cambios['mercadoPago.pago'] = datosPago;
      if (PAGO_REVERTIDO[datosPago.estado] && actual.estado !== 'cancelado') {
        cambios.estado = 'revisar_pago';
        cambios.motivoRevision = sumarMotivo(actual, `Mercado Pago ${PAGO_REVERTIDO[datosPago.estado]} el pago ${datosPago.id}: no lo envíes (o frená el envío) hasta revisarlo.`);
      }
    } else {
      cambios['mercadoPago.pago'] = datosPago;

      if (datosPago.estado === 'approved') {
        const { descontado, faltante } = await descontarStock(tx, db, actual.items);
        const motivos = [];
        if (Math.abs(datosPago.monto - Number(actual.total)) >= 1) {
          motivos.push(`Mercado Pago cobró $${datosPago.monto.toLocaleString('es-AR')} y el pedido es de $${Number(actual.total).toLocaleString('es-AR')}.`);
        }
        if (faltante.length) {
          motivos.push(`No alcanzó el stock para: ${faltante.map(f => `${f.cantidad}× ${f.nombre}`).join(', ')}.`);
        }
        if (actual.estado === 'cancelado') {
          motivos.push('El pedido estaba cancelado y el cliente lo pagó igual.');
        }

        cambios['mercadoPago.pagoAprobadoId'] = datosPago.id;
        cambios.stockDescontado = [...(actual.stockDescontado || []), ...descontado];
        cambios.estado = motivos.length ? 'revisar_pago' : 'pagado';
        if (motivos.length) cambios.motivoRevision = sumarMotivo(actual, motivos.join(' '));
        cambios.pagadoEn = FieldValue.serverTimestamp();
      }
    }

    cambios.actualizadoEn = FieldValue.serverTimestamp();
    tx.update(ref, cambios);

    return {
      pedido: {
        ...actual,
        estado: cambios.estado || actual.estado,
        motivoRevision: cambios.motivoRevision ?? actual.motivoRevision,
        mercadoPago: { ...actual.mercadoPago, pago: cambios['mercadoPago.pago'] || actual.mercadoPago?.pago }
      },
      recienPagado: Boolean(cambios['mercadoPago.pagoAprobadoId'])
    };
  });

  if (recienPagado) {
    await enviarMailsDePedido(pedido, { alCliente: pedido.estado === 'pagado' });
  }

  return { pedido, recienPagado };
}

module.exports = { consultarPago, registrarPago };
