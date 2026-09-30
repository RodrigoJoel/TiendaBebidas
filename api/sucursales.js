// ============================================================
//  API — Sucursales de Andreani cerca del cliente
//  GET /api/sucursales?cp=3500&provincia=Chaco
//  El checkout la usa cuando el cliente elige retiro en sucursal:
//  devuelve las 5 más cercanas a su código postal, de la más cercana
//  a la más lejana. La respuesta queda en la caché de Vercel un día.
// ============================================================
const { sucursalesCercanas } = require('./_lib/sucursales');
const { ErrorPedido, responderError } = require('./_lib/pedidos');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  try {
    const cp = String(req.query.cp || '').trim().toUpperCase();
    const provincia = String(req.query.provincia || '').trim().slice(0, 40);
    if (!/^(\d{4}|[A-Z]\d{4}[A-Z]{3})$/.test(cp)) throw new ErrorPedido('El código postal no es válido.');

    let sucursales;
    try {
      sucursales = await sucursalesCercanas(cp, provincia);
    } catch (err) {
      console.error('No se pudo leer la lista de sucursales de Andreani:', err);
      throw new ErrorPedido('No pudimos cargar las sucursales de Andreani.', 502);
    }

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json({ sucursales });
  } catch (err) {
    responderError(res, err, 'No pudimos cargar las sucursales de Andreani.');
  }
};
