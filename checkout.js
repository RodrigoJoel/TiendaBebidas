// ============================================================
//  CHECKOUT — GLOBAL IMPORTADOS
//  Página compartida por todas las categorías: lee el carrito
//  guardado en localStorage por cada sección (whisky.js, etc.)
//  y crea el pedido en el servidor (/api), que es quien valida
//  datos, precios y stock antes de guardarlo.
// ============================================================

// Mismo valor que usa el servidor (api/_lib/pedidos.js).
const COSTO_ENVIO = 20000;
const WHATSAPP_NUMERO = '5492995000000';

const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán'
];

// id del campo en el formulario → nombre del dato que recibe el servidor
const CAMPOS = {
  fNombre: 'nombre',
  fDni: 'dni',
  fDireccion: 'direccion',
  fPiso: 'piso',
  fCiudad: 'ciudad',
  fProvincia: 'provincia',
  fCp: 'cp',
  fEmail: 'email',
  fCelular: 'celular',
  fMensaje: 'mensaje'
};
const CLAVE_DATOS = 'gi_checkout_datos';

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

function itemsParaEnviar() {
  return Object.values(cart).map(i => ({ id: i.id, qty: i.qty }));
}

// POST a /api: devuelve la respuesta, o tira un error que trae el
// mensaje del servidor (ya pensado para mostrarle al cliente).
async function postJSON(url, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.error || `Error ${resp.status}`);
    err.status = resp.status;
    err.mensajeCliente = data.error;
    throw err;
  }
  return data;
}

function mostrarError(mensaje) {
  const el = document.getElementById('checkoutError');
  if (!el) {
    alert(mensaje);
    return;
  }
  el.textContent = mensaje;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function ocultarError() {
  document.getElementById('checkoutError')?.classList.add('hidden');
}

function setCargando(btn, cargando, texto) {
  if (!btn) return;
  btn.disabled = cargando;
  btn.textContent = texto;
}

// ============================================================
//  DATOS DEL CLIENTE
//  Se guardan en sessionStorage (solo esta pestaña) para no tener
//  que completarlos de nuevo si Mercado Pago rechaza el pago.
// ============================================================
function leerDatosCliente() {
  const datos = {};
  Object.entries(CAMPOS).forEach(([id, campo]) => {
    datos[campo] = document.getElementById(id)?.value.trim() || '';
  });
  datos.mayorDeEdad = document.getElementById('fMayorEdad')?.checked === true;
  return datos;
}

function guardarDatosCliente() {
  try {
    sessionStorage.setItem(CLAVE_DATOS, JSON.stringify(leerDatosCliente()));
  } catch {}
}

function datosGuardados() {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_DATOS) || 'null');
  } catch {
    return null;
  }
}

// Devuelve true si con lo guardado el formulario queda completo.
function restaurarDatosCliente() {
  const datos = datosGuardados();
  if (!datos) return false;

  Object.entries(CAMPOS).forEach(([id, campo]) => {
    const el = document.getElementById(id);
    if (el && datos[campo]) el.value = datos[campo];
  });
  const check = document.getElementById('fMayorEdad');
  if (check) check.checked = datos.mayorDeEdad === true;

  return document.getElementById('datosForm')?.checkValidity() ?? false;
}

// Por si se llega al paso 2 sin los datos completos: se vuelve al
// formulario y el navegador marca qué falta.
function validarDatosAntesDePagar() {
  const form = document.getElementById('datosForm');
  if (form && !form.checkValidity()) {
    mostrarPaso(1);
    form.reportValidity();
    return false;
  }
  return true;
}

function vaciarCarrito() {
  localStorage.removeItem('gi_cart');
  localStorage.removeItem('gi_pending_order');
  try { sessionStorage.removeItem(CLAVE_DATOS); } catch {}
  cart = {};
}

// ============================================================
//  INIT
// ============================================================
function cargarCarrito() {
  try {
    cart = JSON.parse(localStorage.getItem('gi_cart') || '{}') || {};
  } catch {
    cart = {};
  }

  // Mercado Pago redirige a checkout.html?status=approved|pending|
  // failure|null (junto con más parámetros propios).
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status') || params.get('collection_status');
  if (status) {
    // Se limpia la URL para no reprocesar el mismo estado si se recarga.
    window.history.replaceState({}, '', window.location.pathname);
  }

  const paymentId = params.get('payment_id') || params.get('collection_id');
  if (paymentId && ['approved', 'pending', 'in_process'].includes(status)) {
    confirmarPagoMercadoPago(paymentId, params.get('external_reference'));
    return;
  }

  if (!Object.keys(cart).length) {
    // No hay nada para pagar: volvemos a la tienda.
    window.location.href = 'index.html';
    return;
  }

  renderResumen();
  const datosCompletos = restaurarDatosCliente();

  if (status) {
    if (datosCompletos) mostrarPaso(2);
    mostrarError('El pago no se completó. Podés intentar de nuevo o elegir transferencia bancaria.');
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
  ocultarError();
  guardarDatosCliente();
  mostrarPaso(2);
  return false;
}

function volverAPasoUno() {
  ocultarError();
  mostrarPaso(1);
}

// ============================================================
//  SELECCIÓN DE MEDIO DE PAGO
// ============================================================
function seleccionarMedioPago(metodo) {
  medioPago = metodo;
  ocultarError();

  document.querySelectorAll('.payment-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.method === metodo);
  });

  document.getElementById('cardsStrip')?.classList.toggle('hidden', metodo !== 'mp');
  document.getElementById('transferDetails')?.classList.toggle('hidden', metodo !== 'transferencia');
  document.getElementById('btnPagarMP')?.classList.toggle('hidden', metodo !== 'mp');
  document.getElementById('btnConfirmarTransferencia')?.classList.toggle('hidden', metodo !== 'transferencia');
}

// ============================================================
//  CONFIRMACIÓN (paso 3)
// ============================================================
// texto: string o lista de partes; { fuerte: '...' } va en negrita.
function mostrarConfirmacion({ icono, titulo, numero, texto, nota }) {
  document.getElementById('confirmationIcon').textContent = icono;
  document.getElementById('confirmationTitle').textContent = titulo;
  document.getElementById('orderNumber').textContent = numero || '—';
  document.getElementById('confirmationText').replaceChildren(...[].concat(texto).map(parte => {
    if (typeof parte === 'string') return parte;
    const b = document.createElement('strong');
    b.textContent = parte.fuerte;
    return b;
  }));
  document.getElementById('confirmationNote').textContent = nota || '';
  document.getElementById('checkoutSide')?.classList.add('hidden');
  mostrarPaso(3);
}

// ============================================================
//  PAGO (Mercado Pago Checkout Pro)
// ============================================================
async function pagarConMercadoPago() {
  if (!validarDatosAntesDePagar()) return;

  const btn = document.getElementById('btnPagarMP');
  ocultarError();
  setCargando(btn, true, 'Generando pago…');

  try {
    const data = await postJSON('/api/crear-preferencia', {
      cartItems: itemsParaEnviar(),
      cliente: leerDatosCliente()
    });
    const link = data.init_point || data.sandbox_init_point;
    if (!link) throw new Error('Mercado Pago no devolvió el link de pago');

    // Se guardan para mostrar la confirmación cuando Mercado Pago
    // redirija de vuelta a esta misma página.
    localStorage.setItem('gi_pending_order', data.numero);
    guardarDatosCliente();

    window.location.href = link;
  } catch (err) {
    console.error('Error al iniciar el pago con Mercado Pago:', err);
    mostrarError(err.mensajeCliente || 'No pudimos conectar con Mercado Pago. Probá de nuevo en unos segundos.');
    setCargando(btn, false, 'Pagar con Mercado Pago 🔒');
  }
}

// Al volver de Mercado Pago se consulta el pago en el servidor, que
// lo verifica directo con Mercado Pago (la URL se puede inventar).
async function confirmarPagoMercadoPago(paymentId, numeroUrl) {
  const numero = numeroUrl || localStorage.getItem('gi_pending_order') || '';
  const email = datosGuardados()?.email || '';

  mostrarConfirmacion({
    icono: '⏳',
    titulo: 'Confirmando tu pago…',
    numero,
    texto: 'Estamos verificando el pago con Mercado Pago. No cierres esta página.',
    nota: ''
  });

  let resultado;
  try {
    resultado = await postJSON('/api/confirmar-pago', { paymentId });
  } catch (err) {
    console.error('No se pudo confirmar el pago:', err);
    if (err.status === 400 || err.status === 404) {
      mostrarConfirmacion({
        icono: '⚠️',
        titulo: 'No pudimos confirmar el pago',
        numero,
        texto: 'No encontramos este pago en Mercado Pago. Si te lo cobraron, escribinos por WhatsApp con el número de pedido.',
        nota: ''
      });
      return;
    }
    // Mercado Pago informó el pago pero no pudimos verificarlo ahora:
    // queda registrado igual y lo revisamos a mano.
    mostrarConfirmacion({
      icono: '✅',
      titulo: '¡Recibimos tu pago!',
      numero,
      texto: 'Estamos terminando de registrarlo. Si en unas horas no te llega la confirmación, escribinos por WhatsApp con el número de pedido.',
      nota: 'Guardá el número de pedido por cualquier consulta sobre tu envío.'
    });
    vaciarCarrito();
    return;
  }

  const numeroFinal = resultado.numero || numero;

  if (resultado.estado === 'pagado' || resultado.estado === 'enviado') {
    mostrarConfirmacion({
      icono: '✅',
      titulo: '¡Pago aprobado!',
      numero: numeroFinal,
      texto: email
        ? ['Te enviamos la confirmación a ', { fuerte: email }, '. Te avisamos cuando despachemos tu pedido.']
        : 'Te avisamos cuando despachemos tu pedido.',
      nota: 'Guardá el número de pedido por cualquier consulta sobre tu envío.'
    });
    vaciarCarrito();
  } else if (resultado.estado === 'revisar_pago') {
    mostrarConfirmacion({
      icono: '🔎',
      titulo: 'Recibimos tu pago',
      numero: numeroFinal,
      texto: 'Lo estamos revisando y te contactamos a la brevedad para coordinar el envío.',
      nota: 'Guardá el número de pedido por cualquier consulta.'
    });
    vaciarCarrito();
  } else if (['pending', 'in_process', 'authorized'].includes(resultado.pagoEstado)) {
    mostrarConfirmacion({
      icono: '⏳',
      titulo: 'Pago pendiente',
      numero: numeroFinal,
      texto: 'Tu pedido quedó registrado y el pago está pendiente de acreditación en Mercado Pago. Cuando se acredite, coordinamos el envío.',
      nota: 'Guardá el número de pedido por cualquier consulta.'
    });
    vaciarCarrito();
  } else {
    // Rechazado o cancelado: se vuelve al paso de pago con los datos.
    if (!Object.keys(cart).length) {
      window.location.href = 'index.html';
      return;
    }
    document.getElementById('checkoutSide')?.classList.remove('hidden');
    renderResumen();
    mostrarPaso(restaurarDatosCliente() ? 2 : 1);
    mostrarError('Mercado Pago rechazó el pago. Podés intentar con otro medio o elegir transferencia bancaria.');
  }
}

// ============================================================
//  PAGO (Transferencia bancaria)
// ============================================================
async function confirmarTransferencia() {
  if (!validarDatosAntesDePagar()) return;

  const btn = document.getElementById('btnConfirmarTransferencia');
  const cliente = leerDatosCliente();
  ocultarError();
  setCargando(btn, true, 'Registrando pedido…');

  let pedido;
  try {
    pedido = await postJSON('/api/crear-pedido-transferencia', {
      cartItems: itemsParaEnviar(),
      cliente
    });
  } catch (err) {
    console.error('No se pudo registrar el pedido por transferencia:', err);
    mostrarError(err.mensajeCliente || 'No pudimos registrar el pedido. Probá de nuevo en unos segundos.');
    setCargando(btn, false, 'Confirmar pedido 🏦');
    return;
  }

  // Los datos de la cuenta se pasan al paso 3, junto al total real
  // (calculado por el servidor) y al botón para mandar el comprobante.
  const box = document.getElementById('confirmTransfer');
  const btnWhatsapp = document.getElementById('btnWhatsappComprobante');
  const datosCuenta = document.getElementById('transferDetails');
  if (box && datosCuenta && btnWhatsapp) {
    box.insertBefore(datosCuenta, btnWhatsapp);
    datosCuenta.classList.remove('hidden');
  }
  document.getElementById('confirmTransferTotal').textContent = formatPrice(pedido.total);
  const mensaje = `Hola! Soy ${cliente.nombre}. Te mando el comprobante de transferencia del pedido ${pedido.numero} (total ${formatPrice(pedido.total)}).`;
  btnWhatsapp.href = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
  box?.classList.remove('hidden');

  mostrarConfirmacion({
    icono: '✅',
    titulo: '¡Pedido registrado!',
    numero: pedido.numero,
    texto: ['Transferí el total a la cuenta de abajo y mandanos el comprobante por WhatsApp. También te enviamos estos datos a ', { fuerte: cliente.email }, '.'],
    nota: 'Tu pedido queda pendiente hasta que verifiquemos la transferencia.'
  });

  vaciarCarrito();
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
