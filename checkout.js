// ============================================================
//  CHECKOUT — GLOBAL IMPORTADOS
//  Página compartida por todas las categorías: lee el carrito
//  guardado en localStorage por cada sección (whisky.js, etc.)
// ============================================================

const COSTO_ENVIO = 20000;

const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán'
];

let cart = {};

// ============================================================
//  UTILS
// ============================================================
function formatPrice(n) {
  return '$' + Number(n || 0).toLocaleString('es-AR');
}

function cartTotal() {
  return Object.values(cart).reduce((s, i) => s + Number(i.price) * i.qty, 0);
}

// ============================================================
//  INIT
// ============================================================
function cargarCarrito() {
  try {
    cart = JSON.parse(localStorage.getItem('gi_cart') || '{}');
  } catch {
    cart = {};
  }

  if (!Object.keys(cart).length) {
    // No hay nada para pagar: volvemos a la tienda.
    window.location.href = 'index.html';
    return;
  }

  renderResumen();
}

function poblarProvincias() {
  const select = document.getElementById('fProvincia');
  if (!select) return;
  PROVINCIAS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  });
}

// ============================================================
//  RENDER RESUMEN (paso 2 + sidebar)
// ============================================================
function renderResumen() {
  const items = Object.values(cart);
  const subtotal = cartTotal();
  const total = subtotal + COSTO_ENVIO;

  const itemsHtml = items.map(i => `
    <div class="summary-item-row">
      <span>${i.qty}× ${i.name}${i.size ? ` (${i.size})` : ''}</span>
      <span>${formatPrice(i.price * i.qty)}</span>
    </div>
  `).join('');

  const summaryItems = document.getElementById('summaryItems');
  const sideItems = document.getElementById('sideItems');
  if (summaryItems) summaryItems.innerHTML = itemsHtml;
  if (sideItems) sideItems.innerHTML = itemsHtml;

  document.getElementById('summarySubtotal').textContent = formatPrice(subtotal);
  document.getElementById('summaryShipping').textContent = formatPrice(COSTO_ENVIO);
  document.getElementById('summaryTotal').textContent = formatPrice(total);

  document.getElementById('sideSubtotal').textContent = formatPrice(subtotal);
  document.getElementById('sideShipping').textContent = formatPrice(COSTO_ENVIO);
  document.getElementById('sideTotal').textContent = formatPrice(total);
}

// ============================================================
//  NAVEGACIÓN ENTRE PASOS
// ============================================================
function mostrarPaso(n) {
  [1, 2, 3].forEach(i => {
    document.getElementById('step' + i)?.classList.toggle('active', i === n);
    const indicator = document.getElementById('stepIndicator' + i);
    if (!indicator) return;
    indicator.classList.toggle('active', i === n);
    indicator.classList.toggle('done', i < n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function irAPago(event) {
  event.preventDefault();
  mostrarPaso(2);
  return false;
}

function volverAPasoUno() {
  mostrarPaso(1);
}

// ============================================================
//  PAGO (Mercado Pago — integración pendiente)
// ============================================================
function generarNumeroPedido() {
  const fecha = Date.now().toString(36).toUpperCase();
  const azar = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GI-${fecha}-${azar}`;
}

function pagarConMercadoPago() {
  // TODO: reemplazar esta simulación por la integración real de
  // Mercado Pago Checkout Pro (requiere Firebase Cloud Functions
  // para generar la preferencia de pago de forma segura).
  // Por ahora, simulamos que el pago fue aprobado y avanzamos
  // directo a la confirmación del pedido.

  const email = document.getElementById('fEmail')?.value || '—';
  const numeroPedido = generarNumeroPedido();

  document.getElementById('orderNumber').textContent = numeroPedido;
  document.getElementById('confirmEmail').textContent = email;

  document.getElementById('checkoutSide')?.classList.add('hidden');

  mostrarPaso(3);

  localStorage.removeItem('gi_cart');
  cart = {};
}

// ============================================================
//  FUNCIONES USADAS POR onclick="..." EN HTML
// ============================================================
window.irAPago = irAPago;
window.volverAPasoUno = volverAPasoUno;
window.pagarConMercadoPago = pagarConMercadoPago;

poblarProvincias();
cargarCarrito();
