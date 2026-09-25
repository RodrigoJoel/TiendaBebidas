// ============================================================
//  Pedidos — lógica común de las funciones de /api.
//  Valida los datos del cliente, arma el detalle con precios y
//  stock leídos de Firestore (nunca los del navegador), descuenta
//  el stock y guarda el pedido en la colección "pedidos".
// ============================================================
const crypto = require('crypto');
const { FieldValue } = require('firebase-admin/firestore');

// Mismo valor que muestra checkout.js.
const COSTO_ENVIO = 20000;
const MAX_UNIDADES_POR_PRODUCTO = 50;

const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán'
];

// Error con un mensaje pensado para mostrarle al cliente tal cual.
class ErrorPedido extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

function texto(valor, max) {
  return String(valor ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

// ============================================================
//  DATOS DEL CLIENTE
// ============================================================
function validarCliente(datos = {}) {
  const cliente = {
    nombre: texto(datos.nombre, 60),
    dni: String(datos.dni ?? '').replace(/\D/g, ''),
    email: texto(datos.email, 120).toLowerCase(),
    celular: texto(datos.celular, 30),
    direccion: texto(datos.direccion, 120),
    piso: texto(datos.piso, 40),
    ciudad: texto(datos.ciudad, 80),
    provincia: texto(datos.provincia, 40),
    cp: texto(datos.cp, 10).toUpperCase(),
    mensaje: String(datos.mensaje ?? '').trim().slice(0, 500)
  };

  // El nombre va en el mail al cliente: solo letras, así no se puede
  // usar para meter links en un mail enviado a nombre de la tienda.
  if (!/^[\p{L}\s'.-]{3,60}$/u.test(cliente.nombre)) {
    throw new ErrorPedido('Revisá el nombre: solo letras, sin números ni símbolos.');
  }
  if (!/^\d{7,9}$/.test(cliente.dni)) {
    throw new ErrorPedido('El DNI tiene que tener entre 7 y 9 números.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cliente.email)) {
    throw new ErrorPedido('El email no parece válido.');
  }
  if (!/^[\d\s()+-]{8,30}$/.test(cliente.celular)) {
    throw new ErrorPedido('Revisá el número de celular.');
  }
  if (cliente.direccion.length < 4) {
    throw new ErrorPedido('Falta la dirección de entrega.');
  }
  if (cliente.ciudad.length < 2) {
    throw new ErrorPedido('Falta la ciudad.');
  }
  if (!PROVINCIAS.includes(cliente.provincia)) {
    throw new ErrorPedido('Elegí una provincia de la lista.');
  }
  if (!/^(\d{4}|[A-Z]\d{4}[A-Z]{3})$/.test(cliente.cp)) {
    throw new ErrorPedido('El código postal tiene que tener 4 números (ej: 3500) o el formato nuevo (ej: H3500ABC).');
  }
  if (datos.mayorDeEdad !== true) {
    throw new ErrorPedido('Para comprar tenés que confirmar que sos mayor de 18 años.');
  }

  return cliente;
}

// Stock vacío o null = ilimitado (igual que en el sitio y el panel).
function leerStock(prod) {
  return prod.stock === null || prod.stock === undefined || prod.stock === '' ? null : Number(prod.stock);
}

// ============================================================
//  DETALLE DEL PEDIDO (precios y stock desde Firestore)
//  Con `tx` lee los productos dentro de esa transacción.
// ============================================================
async function armarDetalle(db, cartItems, tx = null) {
  if (!Array.isArray(cartItems) || !cartItems.length) {
    throw new ErrorPedido('El carrito está vacío.');
  }

  // Se agrupa por id por si el mismo producto viene repetido.
  const cantidades = new Map();
  for (const entry of cartItems.slice(0, 100)) {
    const id = String(entry?.id ?? '').trim();
    const qty = Math.floor(Number(entry?.qty) || 0);
    if (!id || id.includes('/') || qty < 1) continue;
    cantidades.set(id, (cantidades.get(id) || 0) + qty);
  }
  if (!cantidades.size) throw new ErrorPedido('El carrito está vacío.');

  const refs = [...cantidades.keys()].map(id => db.collection('productos').doc(id));
  const snaps = await (tx || db).getAll(...refs);

  const items = snaps.map(snap => {
    if (!snap.exists) {
      throw new ErrorPedido('Uno de los productos del carrito ya no está a la venta. Quitalo y volvé a intentar.', 409);
    }

    const prod = snap.data();
    const nombre = String(prod.name || 'Producto').slice(0, 200);
    const cantidad = cantidades.get(snap.id);
    const precio = Number(prod.price) || 0;
    const stock = leerStock(prod);

    if (prod.active === false) {
      throw new ErrorPedido(`"${nombre}" ya no está a la venta. Quitalo del carrito y volvé a intentar.`, 409);
    }
    if (precio <= 0) {
      throw new ErrorPedido(`"${nombre}" no tiene precio cargado. Escribinos por WhatsApp para comprarlo.`, 409);
    }
    if (cantidad > MAX_UNIDADES_POR_PRODUCTO) {
      throw new ErrorPedido(`Para comprar más de ${MAX_UNIDADES_POR_PRODUCTO} unidades de "${nombre}" escribinos por WhatsApp.`, 409);
    }
    if (stock !== null && cantidad > stock) {
      throw new ErrorPedido(stock > 0
        ? `Solo quedan ${stock} unidades de "${nombre}". Ajustá la cantidad y volvé a intentar.`
        : `"${nombre}" se quedó sin stock. Quitalo del carrito y volvé a intentar.`, 409);
    }

    return {
      id: snap.id,
      nombre,
      marca: String(prod.brand || ''),
      tamano: String(prod.size || ''),
      precio,
      cantidad,
      subtotal: precio * cantidad
    };
  });

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  return { items, subtotal, envio: COSTO_ENVIO, total: subtotal + COSTO_ENVIO };
}

// ============================================================
//  STOCK
//  Se descuenta dentro de una transacción, así dos compras al mismo
//  tiempo no se pueden llevar la misma unidad. Firestore exige leer
//  todo antes de escribir: llamarla después de las demás lecturas.
//  Devuelve lo que se descontó de cada producto (lo que se repone si
//  se cancela el pedido) y lo que faltó. Nunca deja stock negativo.
// ============================================================
async function descontarStock(tx, db, items) {
  const refs = items.map(i => db.collection('productos').doc(i.id));
  const snaps = await tx.getAll(...refs);
  const descontado = [];
  const faltante = [];

  snaps.forEach((snap, n) => {
    const item = items[n];
    // Producto borrado o con stock ilimitado: no hay nada que descontar.
    const stock = snap.exists ? leerStock(snap.data()) : null;
    if (stock === null) return;

    const quitar = Math.min(item.cantidad, Math.max(stock, 0));
    if (quitar > 0) {
      tx.update(refs[n], { stock: stock - quitar });
      descontado.push({ id: item.id, cantidad: quitar });
    }
    if (quitar < item.cantidad) {
      faltante.push({ id: item.id, nombre: item.nombre, cantidad: item.cantidad - quitar });
    }
  });

  return { descontado, faltante };
}

// ============================================================
//  GUARDADO
// ============================================================
function generarNumeroPedido() {
  const fecha = Date.now().toString(36).toUpperCase();
  const azar = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `GI-${fecha}-${azar}`;
}

// El número de pedido es también el id del documento: pedidos/GI-XXXX.
// Con `tx` se crea dentro de esa transacción.
function guardarPedido(db, pedido, tx = null) {
  const ref = db.collection('pedidos').doc(pedido.numero);
  const datos = {
    ...pedido,
    creadoEn: FieldValue.serverTimestamp(),
    actualizadoEn: FieldValue.serverTimestamp()
  };
  return tx ? tx.create(ref, datos) : ref.create(datos);
}

// Respuesta de error común a todas las funciones de pedidos.
function responderError(res, err, mensajeGenerico) {
  if (err instanceof ErrorPedido) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(mensajeGenerico, err);
  res.status(500).json({ error: mensajeGenerico });
}

module.exports = {
  COSTO_ENVIO,
  ErrorPedido,
  validarCliente,
  armarDetalle,
  descontarStock,
  generarNumeroPedido,
  guardarPedido,
  responderError
};
