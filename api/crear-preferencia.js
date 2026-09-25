// ============================================================
//  API — Crear pedido + preferencia de pago (Mercado Pago)
//  Función serverless (Vercel). Corre en el servidor: acá vive
//  el Access Token, nunca en el navegador.
//
//  Guarda el pedido en Firestore ("pendiente_pago") con los datos
//  del cliente y con precio y stock leídos de Firestore (no confía
//  en lo que mande el navegador), y devuelve el link de pago.
//  El pago se confirma después en /api/confirmar-pago.
// ============================================================
const { MercadoPagoConfig, Preference } = require('mercadopago');
const { getDb } = require('./_lib/firebase-admin');
const { validarCliente, armarDetalle, generarNumeroPedido, guardarPedido, responderError } = require('./_lib/pedidos');

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

    const { cartItems, cliente: datosCliente } = req.body || {};
    const cliente = validarCliente(datosCliente);

    const db = getDb();
    const detalle = await armarDetalle(db, cartItems);
    const numero = generarNumeroPedido();

    const origin = `https://${req.headers.host}`;
    const preference = new Preference(new MercadoPagoConfig({ accessToken }));

    const result = await preference.create({
      body: {
        items: [
          ...detalle.items.map(i => ({
            id: i.id,
            title: i.nombre.slice(0, 250),
            quantity: i.cantidad,
            unit_price: i.precio,
            currency_id: 'ARS'
          })),
          { id: 'envio', title: 'Envío', quantity: 1, unit_price: detalle.envio, currency_id: 'ARS' }
        ],
        payer: {
          name: cliente.nombre,
          email: cliente.email,
          identification: { type: 'DNI', number: cliente.dni }
        },
        external_reference: numero,
        back_urls: {
          success: `${origin}/checkout.html`,
          failure: `${origin}/checkout.html`,
          pending: `${origin}/checkout.html`
        },
        auto_return: 'approved',
        statement_descriptor: 'GLOBAL IMPORTADOS'
      }
    });

    await guardarPedido(db, {
      numero,
      estado: 'pendiente_pago',
      medioPago: 'mercadopago',
      cliente,
      ...detalle,
      mercadoPago: { preferenciaId: result.id }
    });

    res.status(200).json({
      numero,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point
    });
  } catch (err) {
    responderError(res, err, 'No se pudo generar el pago. Intentá de nuevo.');
  }
};
