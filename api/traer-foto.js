// ============================================================
//  API — Traer una foto de otro sitio (solo para el panel)
//  El navegador no puede leer fotos de otros sitios (CORS), así
//  que para pasarlas al almacenamiento propio el panel las pide
//  acá: la función la descarga y la devuelve tal cual. Después el
//  panel la achica y la guarda con /api/subir-foto.
// ============================================================
const { verificarAdmin } = require('./_lib/admin-auth');
const { ErrorPedido, responderError } = require('./_lib/pedidos');

// Vercel no deja responder más de 4,5 MB
const MAX_BYTES = 4 * 1024 * 1024;

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  try {
    await verificarAdmin(req);

    let url;
    try {
      url = new URL(String(req.query.url || ''));
    } catch {
      throw new ErrorPedido('La dirección de la foto no es válida.');
    }
    if (!['http:', 'https:'].includes(url.protocol)) throw new ErrorPedido('La dirección de la foto no es válida.');

    let origen;
    try {
      origen = await fetch(url, {
        headers: { Accept: 'image/*', 'User-Agent': 'Mozilla/5.0 (compatible; ReservaGlobalImportados/1.0)' },
        signal: AbortSignal.timeout(15000)
      });
    } catch {
      throw new ErrorPedido('El sitio de la foto no respondió.', 502);
    }
    if (!origen.ok) {
      throw new ErrorPedido(`El sitio de la foto respondió con error ${origen.status}: puede que la foto ya no exista.`, 502);
    }

    // Algunos sitios mandan las fotos como "octet-stream": el panel igual
    // comprueba que se pueda abrir como imagen antes de subirla.
    const tipo = (origen.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!tipo.startsWith('image/') && tipo !== 'application/octet-stream' && tipo !== 'binary/octet-stream') {
      throw new ErrorPedido('Esa dirección no es una foto.', 502);
    }

    const datos = Buffer.from(await origen.arrayBuffer());
    if (datos.length > MAX_BYTES) throw new ErrorPedido('La foto original pesa más de 4 MB.', 413);

    res.setHeader('Content-Type', tipo);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(datos);
  } catch (err) {
    responderError(res, err, 'No se pudo traer la foto.');
  }
};
