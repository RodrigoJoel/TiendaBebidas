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
let medioPago = 'mp';

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

  const retorno = verificarRetornoMercadoPago();
  if (retorno === 'approved') return;

  if (!Object.keys(cart).length) {
    // No hay nada para pagar: volvemos a la tienda.
    window.location.href = 'index.html';
    return;
  }

  renderResumen();

  if (retorno === 'pending' || retorno === 'failure') {
    mostrarPaso(2);
  }
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
//  SELECCIÓN DE MEDIO DE PAGO
// ============================================================
const WHATSAPP_NUMERO = '5492995000000';

function seleccionarMedioPago(metodo) {
  medioPago = metodo;

  document.querySelectorAll('.payment-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.method === metodo);
  });

  document.getElementById('cardsStrip')?.classList.toggle('hidden', metodo !== 'mp');
  document.getElementById('transferDetails')?.classList.toggle('hidden', metodo !== 'transferencia');
  document.getElementById('btnPagarMP')?.classList.toggle('hidden', metodo !== 'mp');
  document.getElementById('btnConfirmarTransferencia')?.classList.toggle('hidden', metodo !== 'transferencia');
}

// ============================================================
//  PAGO (Mercado Pago Checkout Pro)
// ============================================================
function generarNumeroPedido() {
  const fecha = Date.now().toString(36).toUpperCase();
  const azar = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GI-${fecha}-${azar}`;
}

async function pagarConMercadoPago() {
  const btn = document.getElementById('btnPagarMP');
  const email = document.getElementById('fEmail')?.value || '';
  const numeroPedido = generarNumeroPedido();
  const cartItems = Object.values(cart).map(i => ({ id: i.id, qty: i.qty }));

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Generando pago…';
  }

  try {
    const resp = await fetch('/api/crear-preferencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartItems, orderNumber: numeroPedido, payerEmail: email })
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || !(data.init_point || data.sandbox_init_point)) {
      throw new Error(data.error || 'No se pudo generar el pago');
    }

    // Se guardan para poder mostrar la confirmación cuando Mercado
    // Pago redirija de vuelta a esta misma página.
    localStorage.setItem('gi_pending_order', numeroPedido);
    localStorage.setItem('gi_pending_email', email);

    window.location.href = data.init_point || data.sandbox_init_point;
  } catch (err) {
    console.error('Error al iniciar el pago con Mercado Pago:', err);
    alert('No pudimos conectar con Mercado Pago. Probá de nuevo en unos segundos.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Pagar con Mercado Pago 🔒';
    }
  }
}

// ============================================================
//  MAIL DE CONFIRMACIÓN
// ============================================================
async function enviarMailConfirmacion(email, numeroPedido, metodoPago) {
  if (!email) return;

  const items = Object.values(cart).map(i => ({
    name: i.name,
    qty: i.qty,
    subtotal: formatPrice(i.price * i.qty)
  }));
  const total = formatPrice(cartTotal() + COSTO_ENVIO);

  try {
    await fetch('/api/enviar-confirmacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, orderNumber: numeroPedido, items, total, metodoPago })
    });
  } catch (err) {
    console.error('No se pudo enviar el mail de confirmación:', err);
  }
}

// ============================================================
//  PAGO (Transferencia bancaria)
// ============================================================
function confirmarTransferencia() {
  const email = document.getElementById('fEmail')?.value || '';
  const numeroPedido = generarNumeroPedido();
  const total = cartTotal() + COSTO_ENVIO;
  const detalleItems = Object.values(cart).map(i => `${i.qty}x ${i.name}`).join(', ');

  const mensaje = `Hola! Quiero confirmar mi pedido ${numeroPedido} por transferencia.\nPedido: ${detalleItems}\nTotal: ${formatPrice(total)}\nEn un momento les envío el comprobante.`;
  window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`, '_blank');

  enviarMailConfirmacion(email, numeroPedido, 'transferencia');

  document.getElementById('orderNumber').textContent = numeroPedido;
  document.getElementById('confirmEmail').textContent = email || '—';
  document.getElementById('confirmationTitle').textContent = '¡Pedido registrado!';
  document.getElementById('confirmationText').innerHTML = `Avisanos por WhatsApp con el comprobante de tu transferencia a <strong>${email || 'tu contacto'}</strong> — apenas lo confirmemos, coordinamos el envío.`;
  document.getElementById('confirmationNote').textContent = 'Tu pedido queda pendiente hasta que verifiquemos el comprobante que nos envíes por WhatsApp.';
  document.getElementById('checkoutSide')?.classList.add('hidden');

  mostrarPaso(3);

  localStorage.removeItem('gi_cart');
  cart = {};
}

// ============================================================
//  RETORNO DESDE MERCADO PAGO
//  Mercado Pago redirige a checkout.html?status=approved|pending|
//  failure (junto con más parámetros propios). Acá se detecta esa
//  vuelta y se muestra el paso correspondiente.
// ============================================================
function verificarRetornoMercadoPago() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status') || params.get('collection_status');
  if (!status) return null;

  // Se limpia la URL para no reprocesar el mismo estado si se recarga.
  window.history.replaceState({}, '', window.location.pathname);

  if (status === 'approved') {
    const numeroPedido = params.get('external_reference') || localStorage.getItem('gi_pending_order') || generarNumeroPedido();
    const email = localStorage.getItem('gi_pending_email') || '—';

    document.getElementById('orderNumber').textContent = numeroPedido;
    document.getElementById('confirmEmail').textContent = email;
    document.getElementById('checkoutSide')?.classList.add('hidden');

    mostrarPaso(3);

    enviarMailConfirmacion(email, numeroPedido, 'mp');

    localStorage.removeItem('gi_cart');
    localStorage.removeItem('gi_pending_order');
    localStorage.removeItem('gi_pending_email');
    cart = {};
    return 'approved';
  }

  if (status === 'pending' || status === 'in_process') {
    alert('Tu pago está pendiente de aprobación. Te avisaremos por email apenas se confirme.');
    return 'pending';
  }

  alert('El pago no se pudo completar. Podés intentar de nuevo.');
  return 'failure';
}

// ============================================================
//  FUNCIONES USADAS POR onclick="..." EN HTML
// ============================================================
window.irAPago = irAPago;
window.volverAPasoUno = volverAPasoUno;
window.seleccionarMedioPago = seleccionarMedioPago;
window.pagarConMercadoPago = pagarConMercadoPago;
window.confirmarTransferencia = confirmarTransferencia;

poblarProvincias();
cargarCarrito();
