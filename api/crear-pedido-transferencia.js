// ============================================================
//  API — Crear pedido pagado por transferencia bancaria
//  Función serverless (Vercel). Guarda el pedido en Firestore
//  ("esperando_transferencia") con precio y stock leídos de
//  Firestore, avisa al dueño por mail con todos los datos del
//  cliente y le manda al cliente los datos para transferir.
// ============================================================
const { getDb } = require('./_lib/firebase-admin');
const { validarCliente, armarDetalle, generarNumeroPedido, guardarPedido, responderError } = require('./_lib/pedidos');
const { enviarMailsDePedido } = require('./_lib/mail');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  try {
    const { cartItems, cliente: datosCliente } = req.body || {};
    const cliente = validarCliente(datosCliente);

    const db = getDb();
    const detalle = await armarDetalle(db, cartItems);

    const pedido = {
      numero: generarNumeroPedido(),
      estado: 'esperando_transferencia',
      medioPago: 'transferencia',
      cliente,
      ...detalle
    };
    await guardarPedido(db, pedido);
    await enviarMailsDePedido(pedido);

    res.status(200).json({ numero: pedido.numero, total: pedido.total });
  } catch (err) {
    responderError(res, err, 'No pudimos registrar el pedido. Intentá de nuevo en unos segundos.');
  }
};
