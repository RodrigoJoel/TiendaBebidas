// ============================================================
//  API — Vencer pedidos por transferencia sin pagar
//  La llama Vercel una vez por día (cron de vercel.json). Cancela
//  los pedidos que pasaron su plazo sin pago, repone el stock y
//  manda los avisos. La lógica está en api/_lib/vencimientos.js.
//
//  No recibe datos y solo cancela lo que ya venció: llamarla de más
//  no cambia nada. Si está cargada CRON_SECRET, Vercel la manda en
//  cada llamada y se rechaza cualquier otra.
// ============================================================
const { getDb } = require('./_lib/firebase-admin');
const { vencerPedidos } = require('./_lib/vencimientos');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const secreto = process.env.CRON_SECRET;
  if (secreto && req.headers.authorization !== `Bearer ${secreto}`) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  try {
    const vencidos = await vencerPedidos(getDb());
    res.status(200).json({ cancelados: vencidos.length });
  } catch (err) {
    console.error('No se pudieron vencer los pedidos por transferencia:', err);
    res.status(500).json({ error: 'No se pudieron vencer los pedidos.' });
  }
};
