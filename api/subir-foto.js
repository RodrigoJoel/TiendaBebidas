// ============================================================
//  API — Subir una foto al almacenamiento de la tienda
//  (Vercel Blob, conectado al proyecto con BLOB_READ_WRITE_TOKEN).
//  La usa el panel: el navegador ya achicó la foto y la manda en
//  base64 con el token del admin. Devuelve la URL pública, que el
//  panel guarda en el producto o en el carrusel.
// ============================================================
const { put } = require('@vercel/blob');
const { verificarAdmin } = require('./_lib/admin-auth');
const { ErrorPedido, responderError } = require('./_lib/pedidos');

const MAX_BYTES = 3 * 1024 * 1024;
const CARPETAS = ['productos', 'carruseles'];

// Tipos aceptados: extensión y cómo empiezan los bytes de cada formato
// (así no se guarda cualquier archivo con la etiqueta de imagen).
const FORMATOS = {
  'image/webp': { ext: 'webp', esValido: b => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' },
  'image/jpeg': { ext: 'jpg', esValido: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', esValido: b => b.toString('hex', 0, 8) === '89504e470d0a1a0a' }
};

// "Jack Daniel's Honey 750 cc" → "jack-daniel-s-honey-750-cc"
function nombreDeArchivo(nombre) {
  return String(nombre || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'foto';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  try {
    await verificarAdmin(req);

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new ErrorPedido('Falta conectar el almacenamiento de fotos (BLOB_READ_WRITE_TOKEN).', 500);
    }

    const { imagen, tipo, carpeta, nombre } = req.body || {};
    const formato = FORMATOS[tipo];
    if (!formato) throw new ErrorPedido('La foto tiene que ser WebP, JPG o PNG.');
    if (!CARPETAS.includes(carpeta)) throw new ErrorPedido('Carpeta de fotos no válida.');

    const datos = Buffer.from(String(imagen || ''), 'base64');
    if (datos.length < 12 || !formato.esValido(datos)) throw new ErrorPedido('El archivo no es una imagen válida.');
    if (datos.length > MAX_BYTES) throw new ErrorPedido('La foto pesa más de 3 MB.', 413);

    // El sufijo al azar hace única cada URL: así se puede guardar en
    // caché por un año y cambiar la foto nunca pisa una anterior.
    const blob = await put(`${carpeta}/${nombreDeArchivo(nombre)}.${formato.ext}`, datos, {
      access: 'public',
      contentType: tipo,
      addRandomSuffix: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365
    });

    res.status(200).json({ url: blob.url });
  } catch (err) {
    responderError(res, err, 'No se pudo guardar la foto. Probá de nuevo.');
  }
};
