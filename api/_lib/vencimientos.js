// ============================================================
//  Vencimiento de pedidos por transferencia.
//  Un pedido por transferencia reserva stock al crearse y guarda
//  hasta cuándo se puede pagar (venceEn). Si llega esa fecha y nadie
//  lo marcó como pagado, se cancela solo: el stock vuelve a estar
//  disponible y se avisa por mail al cliente y al dueño.
//
//  Lo corre una vez por día /api/vencer-pedidos (ver vercel.json),
//  así que un pedido puede seguir abierto hasta un día después de
//  vencer, nunca antes.
// ============================================================
const { FieldValue } = require('firebase-admin/firestore');
const { reponerStock } = require('./pedidos');
const { enviarMailsDeVencimiento } = require('./mail');

// Los pedidos anteriores a esta función no tienen venceEn: no vencen
// solos, se siguen cancelando a mano desde el panel.
function vencio(pedido, ahora) {
  return pedido.estado === 'esperando_transferencia' &&
    Boolean(pedido.venceEn) && pedido.venceEn.toMillis() <= ahora;
}

// Cancela un pedido vencido y repone su stock. Devuelve el pedido, o
// null si mientras tanto se pagó o se canceló desde el panel.
function vencerPedido(db, numero, ahora) {
  const ref = db.collection('pedidos').doc(numero);

  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists || !vencio(snap.data(), ahora)) return null;

    const pedido = snap.data();
    await reponerStock(tx, db, pedido.stockDescontado || []);
    tx.update(ref, {
      estado: 'cancelado',
      motivoCancelacion: 'vencido',
      stockDescontado: [],
      canceladoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp()
    });
    return pedido;
  });
}

// Devuelve los pedidos que se cancelaron en esta pasada.
async function vencerPedidos(db, ahora = Date.now()) {
  // Solo por estado (no hace falta crear un índice) y la fecha se mira
  // acá: los pedidos esperando transferencia son pocos.
  const pendientes = await db.collection('pedidos').where('estado', '==', 'esperando_transferencia').get();
  const vencidos = [];

  for (const doc of pendientes.docs) {
    if (!vencio(doc.data(), ahora)) continue;
    try {
      const pedido = await vencerPedido(db, doc.id, ahora);
      if (pedido) vencidos.push(pedido);
    } catch (err) {
      // Uno que falla no frena al resto: se reintenta en la próxima pasada.
      console.error('No se pudo vencer el pedido', doc.id, err);
    }
  }

  if (vencidos.length) await enviarMailsDeVencimiento(vencidos);
  return vencidos;
}

module.exports = { vencerPedidos };
