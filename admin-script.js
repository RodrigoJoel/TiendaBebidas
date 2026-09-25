/* ============================================================
   ADMIN PANEL LOGIC — Reserva Global Importados
   Colección única "productos" en Firestore, filtrada por category.
   ============================================================ */

window.CATEGORY_CONFIG = {
  Whisky:      { icon: '🥃', label: 'Whisky',      title: 'GESTIÓN DE <span>WHISKY</span>',      sub: 'Blends, single malt y bourbon.' },
  Ron:         { icon: '🍹', label: 'Ron',         title: 'GESTIÓN DE <span>RON</span>',         sub: 'Ron blanco, añejo y especiado.' },
  Vodka:       { icon: '🍸', label: 'Vodka',       title: 'GESTIÓN DE <span>VODKA</span>',       sub: 'Vodkas nacionales e importados.' },
  Tequila:     { icon: '🌵', label: 'Tequila',     title: 'GESTIÓN DE <span>TEQUILA</span>',     sub: 'Blanco, reposado y añejo.' },
  Gin:         { icon: '🍈', label: 'Gin',         title: 'GESTIÓN DE <span>GIN</span>',         sub: 'London dry y gins premium.' },
  Licores:     { icon: '🥂', label: 'Licores',     title: 'GESTIÓN DE <span>LICORES</span>',     sub: 'Licores, cremas y aperitivos.' },
  Aguardiente: { icon: '🥃', label: 'Aguardiente', title: 'GESTIÓN DE <span>AGUARDIENTE</span>', sub: 'Aguardientes y destilados.' },
  Espumante:   { icon: '🍾', label: 'Espumante',   title: 'GESTIÓN DE <span>ESPUMANTE</span>',   sub: 'Champagne, espumantes y frizzantes.' },
  Cerveza:     { icon: '🍺', label: 'Cerveza',     title: 'GESTIÓN DE <span>CERVEZA</span>',     sub: 'Rubias, negras, IPA y artesanales.' },
  Vino:        { icon: '🍷', label: 'Vino',        title: 'GESTIÓN DE <span>VINO</span>',        sub: 'Tintos, blancos y rosados.' },
  Energizante: { icon: '⚡', label: 'Energizante', title: 'GESTIÓN DE <span>ENERGIZANTE</span>', sub: 'Bebidas energizantes.' },
  Combos:      { icon: '📦', label: 'Combos',      title: 'GESTIÓN DE <span>COMBOS</span>',      sub: 'Packs y combos armados.' }
};
window.CATEGORY_KEYS = Object.keys(window.CATEGORY_CONFIG);

const COMMON_SIZES = ['50 cc', '200 cc', '269 cc', '355 cc', '375 cc', '473 cc', '500 cc', '700 cc', '750 cc', '1 L', '1.5 L', '2 L', '3 L'];

window.adminFilters = window.adminFilters || {};
window.currentPage = window.currentPage || 'dashboard';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
// Escapa todo el HTML: los pedidos traen texto escrito por el cliente.
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-AR'); }

function setSaving(state) {
  const el = document.getElementById('savingBadge');
  if (!el) return;
  if (state === 'saving') { el.textContent = '⚡ Guardando...'; el.className = 'show saving'; }
  else if (state === 'ok') { el.textContent = '✅ Guardado'; el.className = 'show'; setTimeout(() => el.className = '', 2000); }
  else el.className = '';
}

function showToast(msg, type = 'ok') {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'err' ? ' err' : '');
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
window.showToast = showToast;

function previewImg(inputId, previewId) {
  const url = document.getElementById(inputId)?.value.trim();
  const prev = document.getElementById(previewId);
  if (!prev) return;
  prev.innerHTML = url ? `<img src="${esc(url)}" alt=""/>` : `<span>Vista previa</span>`;
}
window.previewImg = previewImg;

async function fbAdd(data) {
  setSaving('saving');
  try {
    const ref = await window.fsAddDoc(window.fsCollection(window.db, 'productos'), data);
    setSaving('ok');
    return ref.id;
  } catch (e) { setSaving(''); showToast('❌ Error: ' + e.message, 'err'); return null; }
}
async function fbUpdate(docId, data) {
  setSaving('saving');
  try {
    await window.fsUpdateDoc(window.fsDoc(window.db, 'productos', docId), data);
    setSaving('ok');
    return true;
  } catch (e) { setSaving(''); showToast('❌ Error: ' + e.message, 'err'); return false; }
}
async function fbDelete(docId) {
  setSaving('saving');
  try {
    await window.fsDeleteDoc(window.fsDoc(window.db, 'productos', docId));
    setSaving('ok');
    return true;
  } catch (e) { setSaving(''); showToast('❌ Error: ' + e.message, 'err'); return false; }
}

function getProductsFor(cat) {
  const all = window.DATA.productos || [];
  if (!cat || cat === 'todos') return [...all].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  return all.filter(p => p.category === cat).sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
}

function getUniqueBrands(cat) {
  const list = getProductsFor(cat);
  return [...new Set(list.map(p => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}
function getUniqueSizes(cat) {
  const list = getProductsFor(cat);
  const sizes = [...new Set(list.map(p => p.size).filter(Boolean))];
  const ordered = COMMON_SIZES.filter(s => sizes.includes(s));
  const others = sizes.filter(s => !COMMON_SIZES.includes(s)).sort();
  return [...ordered, ...others];
}

function badgeClass(b) {
  if (!b) return '';
  const low = b.toLowerCase();
  if (low === 'new') return 'badge-new';
  if (low.includes('oferta') || low.includes('descuento')) return 'badge-offer';
  if (low.includes('hot') || low.includes('últimas')) return 'badge-hot';
  return '';
}

function stockPill(stock) {
  if (stock === null || stock === undefined || stock === '') return `<span style="font-family:var(--font-mono);font-size:11px;color:var(--lime)">∞ Sin límite</span>`;
  const n = Number(stock);
  const color = n <= 0 ? 'var(--danger)' : n <= 5 ? 'var(--citrus)' : 'var(--lime)';
  const text = n <= 0 ? '❌ Sin stock' : `📦 ${n} uds`;
  return `<span style="font-family:var(--font-mono);font-size:11px;color:${color}">${text}</span>`;
}

// ─────────────────────────────────────────────
// NAVIGATION / RENDER
// ─────────────────────────────────────────────
function navigate(page, el) {
  window.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el = el || document.querySelector(`.nav-item[data-page="${page}"]`);
  if (el) el.classList.add('active');
  document.querySelector('.sidebar')?.classList.remove('open');
  render(page);
  window.scrollTo(0, 0);
}
window.navigate = navigate;

// En celular el menú lateral está escondido y se abre con ☰.
function toggleSidebar() {
  document.querySelector('.sidebar')?.classList.toggle('open');
}
window.toggleSidebar = toggleSidebar;

document.addEventListener('click', (e) => {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar?.classList.contains('open') && !e.target.closest('.sidebar, .menu-btn')) sidebar.classList.remove('open');
});

function render(page) {
  const main = document.getElementById('mainContent');
  if (!main) return;
  actualizarContadorPedidos();
  if (document.getElementById('orderModal')?.classList.contains('open')) renderPedidoModal();

  // Los datos llegan en tiempo real: si se estaba escribiendo en un
  // buscador, se mantiene el foco al redibujar.
  const activo = document.activeElement;
  const foco = activo && activo.id && main.contains(activo) ? { id: activo.id, pos: activo.selectionStart } : null;

  if (page === 'dashboard') main.innerHTML = pageDashboard();
  else if (page === 'pedidos') main.innerHTML = pagePedidos();
  else if (page === 'carousels') main.innerHTML = pageCarousels();
  else if (page === 'todos') main.innerHTML = pageCategoryManager('todos');
  else if (window.CATEGORY_CONFIG[page]) main.innerHTML = pageCategoryManager(page);
  else main.innerHTML = '<p style="color:var(--muted)">Página no encontrada</p>';

  const input = foco && document.getElementById(foco.id);
  if (input) {
    input.focus();
    if (foco.pos !== null && foco.pos !== undefined && input.setSelectionRange) input.setSelectionRange(foco.pos, foco.pos);
  }
}
window.render = render;

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
function pageDashboard() {
  const all = window.DATA.productos || [];
  const active = all.filter(p => p.active !== false).length;
  const sinStock = all.filter(p => p.stock !== null && p.stock !== undefined && Number(p.stock) <= 0).length;
  const catsConProductos = window.CATEGORY_KEYS.filter(c => all.some(p => p.category === c)).length;

  const ultimos = [...all].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
  const paraAtender = pedidosParaAtender();

  return `
    <div class="page-header">
      <div>
        <div class="page-title">PANEL <span>DE CONTROL</span></div>
        <div class="page-sub">Catálogo sincronizado en tiempo real con Firebase</div>
      </div>
    </div>
    ${paraAtender ? `
    <button type="button" class="orders-alert" onclick="navigate('pedidos',null)">
      <span>🧾</span>
      <span>Tenés <strong>${paraAtender} ${paraAtender === 1 ? 'pedido' : 'pedidos'}</strong> para atender</span>
      <span class="go">Ver pedidos →</span>
    </button>` : ''}
    <div class="stats-row">
      <div class="stat-card"><div class="stat-icon">🍾</div><div class="stat-info"><strong>${all.length}</strong><span>Productos totales</span></div></div>
      <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-info"><strong>${active}</strong><span>Activos en el sitio</span></div></div>
      <div class="stat-card"><div class="stat-icon red">❌</div><div class="stat-info"><strong>${sinStock}</strong><span>Sin stock</span></div></div>
      <div class="stat-card"><div class="stat-icon yellow">🗂️</div><div class="stat-info"><strong>${catsConProductos}/${window.CATEGORY_KEYS.length}</strong><span>Categorías con productos</span></div></div>
    </div>
    <div class="dash-grid">
      <div class="card">
        <div class="card-header"><div class="card-title"><span>⚡</span> Accesos rápidos</div></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${window.CATEGORY_KEYS.map(c => `<button class="btn btn-ghost" onclick="navigate('${c}',null)" style="justify-content:flex-start">${window.CATEGORY_CONFIG[c].icon} ${window.CATEGORY_CONFIG[c].label}</button>`).join('')}
            <button class="btn btn-ghost" onclick="navigate('todos',null)" style="justify-content:flex-start">🗂️ Todos los productos</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title"><span>📦</span> Últimos productos agregados</div></div>
        <div class="card-body">
          <div class="prod-list">
            ${ultimos.length === 0 ? `<p style="color:var(--muted);text-align:center;padding:20px">Todavía no cargaste productos.</p>` : ultimos.map(p => `
              <div class="prod-item">
                <div class="prod-thumb">${p.image ? `<img src="${esc(p.image)}" alt=""/>` : `<span style="font-size:22px">${p.emoji || window.CATEGORY_CONFIG[p.category]?.icon || '🍾'}</span>`}</div>
                <div class="prod-meta">
                  <strong>${esc(p.name)}</strong>
                  <div class="meta-row">
                    <span class="meta-price">${fmt(p.price)}</span>
                    <span class="meta-brand">${esc(p.brand || '')}</span>
                    <span class="badge-pill">${esc(p.category || '')}</span>
                  </div>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────
// PEDIDOS
// Los crean las funciones de /api cuando alguien compra. Acá se ven en
// tiempo real y se les cambia el estado. Cancelar repone el stock que
// el pedido había descontado, en la misma transacción.
// ─────────────────────────────────────────────
const ESTADOS_PEDIDO = {
  esperando_transferencia: { label: 'Esperando transferencia', icon: '🏦', clase: 'st-wait' },
  pagado:                  { label: 'Pagado · para enviar',    icon: '✅', clase: 'st-ok' },
  revisar_pago:            { label: 'Revisar',                 icon: '⚠️', clase: 'st-alert' },
  enviado:                 { label: 'Enviado',                 icon: '🚚', clase: 'st-done' },
  pendiente_pago:          { label: 'Sin pagar',               icon: '⌛', clase: 'st-muted' },
  cancelado:               { label: 'Cancelado',               icon: '✖', clase: 'st-muted' }
};
const PEDIDOS_PARA_ATENDER = ['esperando_transferencia', 'pagado', 'revisar_pago'];

// "Sin pagar" son los que fueron a Mercado Pago y no pagaron (o
// abandonaron): no aparecen en "Para atender".
const VISTAS_PEDIDOS = [
  { key: 'atender',                 label: 'Para atender',             estados: PEDIDOS_PARA_ATENDER },
  { key: 'esperando_transferencia', label: 'Esperando transferencia',  estados: ['esperando_transferencia'] },
  { key: 'pagado',                  label: 'Para enviar',              estados: ['pagado'] },
  { key: 'revisar_pago',            label: 'Revisar',                  estados: ['revisar_pago'] },
  { key: 'enviado',                 label: 'Enviados',                 estados: ['enviado'] },
  { key: 'pendiente_pago',          label: 'Sin pagar (Mercado Pago)', estados: ['pendiente_pago'] },
  { key: 'cancelado',               label: 'Cancelados',               estados: ['cancelado'] },
  { key: 'todos',                   label: 'Todos',                    estados: null }
];

const ESTADOS_PAGO_MP = {
  approved: 'aprobado', pending: 'pendiente', in_process: 'en proceso', authorized: 'autorizado',
  rejected: 'rechazado', cancelled: 'cancelado', refunded: 'devuelto', charged_back: 'contracargo'
};

window.pedidosFiltro = window.pedidosFiltro || { vista: 'atender', busqueda: '' };
window.pedidoAbierto = null;
window.notasBorrador = {};

const TITULO_PANEL = document.title;

function pedidosParaAtender() {
  return (window.DATA.pedidos || []).filter(p => PEDIDOS_PARA_ATENDER.includes(p.estado)).length;
}

// Número en el menú y en la pestaña del navegador: "(2) Reserva Global..."
function actualizarContadorPedidos() {
  const n = pedidosParaAtender();
  const badge = document.getElementById('navPedidosCount');
  if (badge) {
    badge.textContent = n;
    badge.classList.toggle('hidden', !n);
  }
  document.title = (n ? `(${n}) ` : '') + TITULO_PANEL;
}

function estadoPedido(p) {
  return ESTADOS_PEDIDO[p.estado] || { label: p.estado || '—', icon: '•', clase: 'st-muted' };
}

// Firestore devuelve Timestamp; por las dudas también acepta texto o número.
function aFecha(v) {
  if (!v) return null;
  const d = typeof v.toDate === 'function' ? v.toDate() : new Date(v);
  return isNaN(d) ? null : d;
}
function fechaHora(v, conAnio = false) {
  const d = aFecha(v);
  if (!d) return '';
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', ...(conAnio ? { year: 'numeric' } : {}), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

function normalizar(t) {
  return String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function unidadesDescontadas(p) {
  return (p.stockDescontado || []).reduce((s, d) => s + (Number(d.cantidad) || 0), 0);
}

// Link de WhatsApp al celular del cliente. Los celulares se escriben de
// mil formas (0299 15-412-3456, +54 9 11 ...): se lleva a 549 + código
// de área + número (10 dígitos). Si no se puede, no se muestra el link.
function whatsappCliente(celular) {
  let d = String(celular || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) {
    d = d.slice(2);
    if (d.startsWith('9')) d = d.slice(1);
  }
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 12) {
    const k = [2, 3, 4].find(i => d.slice(i, i + 2) === '15');
    if (k !== undefined) d = d.slice(0, k) + d.slice(k + 2);
  }
  return d.length === 10 ? `https://wa.me/549${d}` : null;
}

function pagePedidos() {
  const encabezado = `
    <div class="page-header">
      <div>
        <div class="page-title">PEDIDOS <span>DE LA TIENDA</span></div>
        <div class="page-sub">Se actualizan solos cuando entra una compra. Tocá un pedido para ver el detalle y cambiarle el estado.</div>
      </div>
    </div>`;

  const error = window.DATA.pedidosError;
  if (error) {
    return encabezado + `
      <div class="order-note alert">
        ${error === 'permission-denied'
          ? '🔒 Firestore todavía no deja leer los pedidos: falta publicar la regla de <code>pedidos</code> en Firebase Console → Firestore Database → Reglas (está en FIREBASE_SETUP.md, sección 6). Después de publicarla, recargá esta página.'
          : `No se pudieron cargar los pedidos (${esc(error)}). Probá recargar la página.`}
      </div>`;
  }

  const todos = window.DATA.pedidos || [];
  const filtro = window.pedidosFiltro;
  const vista = VISTAS_PEDIDOS.find(v => v.key === filtro.vista) || VISTAS_PEDIDOS[0];
  const termino = normalizar(filtro.busqueda).trim();
  const lista = todos.filter(p => {
    if (vista.estados && !vista.estados.includes(p.estado)) return false;
    if (!termino) return true;
    const c = p.cliente || {};
    return normalizar([p.numero, c.nombre, c.email, c.dni, c.celular, c.ciudad].join(' ')).includes(termino);
  });

  const chips = VISTAS_PEDIDOS.map(v => {
    const n = v.estados ? todos.filter(p => v.estados.includes(p.estado)).length : todos.length;
    return `<button type="button" class="chip ${v.key === vista.key ? 'active' : ''}" onclick="setPedidosFiltro('vista','${v.key}')">${v.label}<span class="n">${n}</span></button>`;
  }).join('');

  const vacio = !todos.length
    ? 'Todavía no entró ningún pedido.'
    : termino
      ? 'Ningún pedido coincide con la búsqueda.'
      : vista.key === 'atender' ? '🎉 No hay pedidos para atender.' : 'No hay pedidos en esta vista.';

  return encabezado + `
    <div class="card">
      <div class="card-body">
        <div class="chip-row">${chips}</div>
        <div class="field">
          <input id="pedidosBusqueda" placeholder="Buscar número, nombre, email, DNI..." value="${esc(filtro.busqueda)}" oninput="setPedidosFiltro('busqueda', this.value)"/>
        </div>
        <div class="order-list">
          ${lista.length ? lista.map(filaPedido).join('') : `<p class="empty">${vacio}</p>`}
        </div>
        ${todos.length >= 300 ? '<p class="empty">Se muestran los últimos 300 pedidos.</p>' : ''}
      </div>
    </div>`;
}

function filaPedido(p) {
  const st = estadoPedido(p);
  const c = p.cliente || {};
  const unidades = (p.items || []).reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
  const apagado = p.estado === 'cancelado' || p.estado === 'pendiente_pago';
  return `
    <button type="button" class="order-item ${apagado ? 'is-muted' : ''}" data-numero="${esc(p.numero)}" onclick="abrirPedido(this.dataset.numero)">
      <div class="order-main">
        <div><span class="order-num">${esc(p.numero)}</span><span class="order-date">${esc(fechaHora(p.creadoEn))}</span></div>
        <div class="order-sub"><strong>${esc(c.nombre)}</strong> — ${esc(c.ciudad)}, ${esc(c.provincia)}</div>
        <div class="order-sub">${unidades} ${unidades === 1 ? 'unidad' : 'unidades'} · ${p.medioPago === 'transferencia' ? '🏦 Transferencia' : '💳 Mercado Pago'}</div>
      </div>
      <div class="order-side">
        <div class="order-total">${fmt(p.total)}</div>
        <span class="st-pill ${st.clase}">${st.icon} ${esc(st.label)}</span>
      </div>
    </button>`;
}

function setPedidosFiltro(clave, valor) {
  window.pedidosFiltro[clave] = valor;
  render('pedidos');
}
window.setPedidosFiltro = setPedidosFiltro;

// ── Detalle del pedido (modal) ──
function abrirPedido(numero) {
  window.pedidoAbierto = numero;
  renderPedidoModal();
  const modal = document.getElementById('orderModal');
  modal.classList.remove('hidden');
  modal.classList.add('open');
}
window.abrirPedido = abrirPedido;

function closeOrderModal() {
  window.pedidoAbierto = null;
  const modal = document.getElementById('orderModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.classList.add('hidden');
}
window.closeOrderModal = closeOrderModal;

function avisoPedido(p) {
  switch (p.estado) {
    case 'revisar_pago':
      return `<div class="order-note alert">⚠️ ${esc(p.motivoRevision || 'Revisá el pago antes de enviar.')}</div>`;
    case 'esperando_transferencia':
      return `<div class="order-note info">Cuando te llegue la transferencia de <strong>${fmt(p.total)}</strong> (el cliente manda el comprobante por WhatsApp), marcalo como pagado. Si no paga, cancelalo y el stock vuelve a estar disponible.</div>`;
    case 'pendiente_pago':
      return `<div class="order-note info">El cliente fue a pagar con Mercado Pago pero el pago todavía no se aprobó. Si se aprueba, el pedido pasa solo a "Pagado". Si quedó abandonado, podés cancelarlo (no reservó stock).</div>`;
    case 'pagado':
      return `<div class="order-note info">Listo para preparar y enviar. Cuando lo despaches, marcalo como enviado.</div>`;
    default:
      return '';
  }
}

function fechasPedido(p) {
  const partes = [`Creado el ${fechaHora(p.creadoEn, true)}`];
  if (p.pagadoEn && p.estado !== 'esperando_transferencia') partes.push(`pagado el ${fechaHora(p.pagadoEn, true)}`);
  if (p.estado === 'enviado' && p.enviadoEn) partes.push(`enviado el ${fechaHora(p.enviadoEn, true)}`);
  if (p.estado === 'cancelado' && p.canceladoEn) partes.push(`cancelado el ${fechaHora(p.canceladoEn, true)}`);
  return esc(partes.join(' · '));
}

function textoStock(p) {
  const n = unidadesDescontadas(p);
  if (n) return n === 1
    ? '1 unidad descontada del stock (vuelve al stock si cancelás el pedido)'
    : `${n} unidades descontadas del stock (vuelven al stock si cancelás el pedido)`;
  if (p.estado === 'pendiente_pago') return 'Se descuenta cuando se apruebe el pago';
  if (p.estado === 'cancelado') return 'Nada descontado (si tenía, ya volvió al stock)';
  return 'Nada descontado (productos sin límite de stock)';
}

function accionesPedido(p) {
  const boton = (hacia, texto, clase) =>
    `<button type="button" class="btn ${clase}" data-numero="${esc(p.numero)}" data-desde="${esc(p.estado)}" data-hacia="${hacia}" onclick="cambiarEstadoPedido(this.dataset.numero, this.dataset.desde, this.dataset.hacia)">${texto}</button>`;
  const cancelar = boton('cancelado', '✖ Cancelar pedido', 'btn-danger');

  switch (p.estado) {
    case 'esperando_transferencia': return boton('pagado', '✅ Llegó la transferencia', 'btn-success') + cancelar;
    case 'pendiente_pago':          return cancelar;
    case 'pagado':                  return boton('enviado', '🚚 Marcar enviado', 'btn-primary') + cancelar;
    case 'revisar_pago':            return boton('pagado', '✅ Ya lo revisé: está pagado', 'btn-success') + cancelar;
    case 'enviado':                 return boton('pagado', '↩ Volver a "para enviar"', 'btn-ghost');
    default:                        return '';
  }
}

function renderPedidoModal() {
  const body = document.getElementById('orderModalBody');
  if (!body) return;
  const p = (window.DATA.pedidos || []).find(x => x.numero === window.pedidoAbierto);
  if (!p) {
    body.innerHTML = '<p class="empty">No se encontró el pedido.</p>';
    return;
  }

  // Si se estaba escribiendo la nota, se mantiene el foco al redibujar.
  const escribiendoNota = document.activeElement?.id === 'pedidoNota';
  const st = estadoPedido(p);
  const c = p.cliente || {};
  const wa = whatsappCliente(c.celular);
  const pago = p.mercadoPago?.pago;
  const nota = window.notasBorrador[p.numero] ?? p.notaAdmin ?? '';
  const acciones = accionesPedido(p);

  body.innerHTML = `
    <div class="order-head">
      <div class="modal-title">PEDIDO <span>${esc(p.numero)}</span></div>
      <span class="st-pill ${st.clase}">${st.icon} ${esc(st.label)}</span>
    </div>
    <div class="order-dates">${fechasPedido(p)}</div>
    ${avisoPedido(p)}

    <div class="order-grid">
      <div class="order-box">
        <h4>Cliente</h4>
        <dl class="kv">
          <dt>Nombre</dt><dd>${esc(c.nombre)}</dd>
          <dt>DNI</dt><dd>${esc(c.dni)}</dd>
          <dt>Email</dt><dd><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></dd>
          <dt>Celular</dt><dd><a href="tel:${esc(String(c.celular || '').replace(/[^\d+]/g, ''))}">${esc(c.celular)}</a>${wa ? ` · <a href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</dd>
        </dl>
      </div>
      <div class="order-box">
        <h4>Entrega</h4>
        <dl class="kv">
          <dt>Dirección</dt><dd>${esc(c.direccion)}${c.piso ? `, ${esc(c.piso)}` : ''}</dd>
          <dt>Ciudad</dt><dd>${esc(c.ciudad)}, ${esc(c.provincia)}</dd>
          <dt>CP</dt><dd>${esc(c.cp)}</dd>
          ${c.mensaje ? `<dt>Mensaje</dt><dd>${esc(c.mensaje)}</dd>` : ''}
        </dl>
      </div>
    </div>

    <div class="order-box">
      <h4>Productos</h4>
      <table class="order-items">
        ${(p.items || []).map(i => `
          <tr><td>${Number(i.cantidad) || 0}× ${esc(i.nombre)}${i.tamano ? ` <span class="muted">(${esc(i.tamano)})</span>` : ''}</td><td>${fmt(i.subtotal)}</td></tr>`).join('')}
        <tr class="sum"><td>Envío</td><td>${fmt(p.envio)}</td></tr>
        <tr class="total"><td>Total</td><td>${fmt(p.total)}</td></tr>
      </table>
    </div>

    <div class="order-grid">
      <div class="order-box">
        <h4>Pago y stock</h4>
        <dl class="kv">
          <dt>Medio</dt><dd>${p.medioPago === 'transferencia' ? '🏦 Transferencia' : '💳 Mercado Pago'}</dd>
          ${pago ? `<dt>Pago MP</dt><dd>N° ${esc(pago.id)} · ${esc(ESTADOS_PAGO_MP[pago.estado] || pago.estado)} · ${fmt(pago.monto)}</dd>` : ''}
          <dt>Stock</dt><dd>${esc(textoStock(p))}</dd>
        </dl>
      </div>
      <div class="order-box">
        <h4>Nota interna</h4>
        <div class="field" style="margin-bottom:8px">
          <textarea id="pedidoNota" maxlength="1000" placeholder="Ej: transferencia recibida el 3/10 · enviado por Andreani, seguimiento 123..." oninput="window.notasBorrador[window.pedidoAbierto] = this.value">${esc(nota)}</textarea>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="guardarNotaPedido()">💾 Guardar nota</button>
      </div>
    </div>

    ${acciones ? `<div class="order-actions btn-row">${acciones}</div>` : ''}
  `;

  if (escribiendoNota) {
    const area = document.getElementById('pedidoNota');
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }
}

const MENSAJES_ESTADO = {
  pagado: '✅ Pedido marcado como pagado',
  enviado: '🚚 Pedido marcado como enviado',
  cancelado: '✖ Pedido cancelado'
};

// Cambia el estado en una transacción: si el pedido cambió mientras se
// lo miraba (por ejemplo, llegó el pago de Mercado Pago), no se pisa.
async function cambiarEstadoPedido(numero, desde, hacia) {
  const p = (window.DATA.pedidos || []).find(x => x.numero === numero);
  if (!p) return;

  if (hacia === 'cancelado') {
    const unidades = unidadesDescontadas(p);
    const yaPago = p.medioPago === 'mercadopago'
      ? Boolean(p.mercadoPago?.pagoAprobadoId)
      : p.estado === 'pagado' || p.estado === 'revisar_pago';
    let pregunta = `¿Cancelar el pedido ${numero}?`;
    if (unidades) pregunta += `\n\n${unidades === 1 ? 'Vuelve 1 unidad' : `Vuelven ${unidades} unidades`} al stock.`;
    if (yaPago) pregunta += '\n\nOjo: el cliente ya pagó. La devolución de la plata la tenés que hacer vos (desde Mercado Pago o por transferencia).';
    if (!confirm(pregunta)) return;
  }

  const botones = document.querySelectorAll('.order-actions button');
  botones.forEach(b => { b.disabled = true; });
  setSaving('saving');

  try {
    await window.fsRunTransaction(window.db, async (tx) => {
      const ref = window.fsDoc(window.db, 'pedidos', numero);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('El pedido ya no existe.');
      const actual = snap.data();
      if (actual.estado !== desde) {
        throw new Error(`El pedido cambió mientras lo mirabas (ahora está "${estadoPedido(actual).label}"). Revisalo de nuevo.`);
      }

      const cambios = { estado: hacia, actualizadoEn: window.fsServerTimestamp() };
      if (hacia === 'pagado' && !actual.pagadoEn) cambios.pagadoEn = window.fsServerTimestamp();
      if (hacia === 'enviado') cambios.enviadoEn = window.fsServerTimestamp();

      if (hacia === 'cancelado') {
        // Todas las lecturas antes de escribir (lo exige Firestore).
        const reponer = actual.stockDescontado || [];
        const refs = reponer.map(d => window.fsDoc(window.db, 'productos', d.id));
        const productos = await Promise.all(refs.map(r => tx.get(r)));
        productos.forEach((prod, i) => {
          if (!prod.exists()) return; // el producto se borró
          const stock = prod.data().stock;
          if (stock === null || stock === undefined || stock === '') return; // ahora es ilimitado
          tx.update(refs[i], { stock: Number(stock) + (Number(reponer[i].cantidad) || 0) });
        });
        cambios.stockDescontado = [];
        cambios.canceladoEn = window.fsServerTimestamp();
      }

      tx.update(ref, cambios);
    });
    setSaving('ok');
    showToast(MENSAJES_ESTADO[hacia] || '✅ Pedido actualizado');
  } catch (e) {
    setSaving('');
    showToast('❌ ' + (e.message || 'No se pudo actualizar el pedido'), 'err');
    botones.forEach(b => { b.disabled = false; });
  }
}
window.cambiarEstadoPedido = cambiarEstadoPedido;

async function guardarNotaPedido() {
  const numero = window.pedidoAbierto;
  const area = document.getElementById('pedidoNota');
  if (!numero || !area) return;
  setSaving('saving');
  try {
    await window.fsUpdateDoc(window.fsDoc(window.db, 'pedidos', numero), {
      notaAdmin: area.value.trim().slice(0, 1000),
      actualizadoEn: window.fsServerTimestamp()
    });
    delete window.notasBorrador[numero];
    setSaving('ok');
    showToast('💾 Nota guardada');
  } catch (e) {
    setSaving('');
    showToast('❌ Error: ' + e.message, 'err');
  }
}
window.guardarNotaPedido = guardarNotaPedido;

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('orderModal')?.classList.contains('open')) closeOrderModal();
  else if (document.getElementById('productModal')?.classList.contains('open')) closeProductModal();
});

// ─────────────────────────────────────────────
// CARRUSELES DE PORTADA (fotos de fondo del hero)
// ─────────────────────────────────────────────
window.CAROUSEL_SECTIONS = [
  { key: 'home', icon: '🏠', label: 'Inicio (home)' },
  { key: 'whisky', icon: '🥃', label: 'Whisky' },
  { key: 'ron', icon: '🍹', label: 'Ron' },
  { key: 'vodka', icon: '🍸', label: 'Vodka' },
  { key: 'tequila', icon: '🌵', label: 'Tequila' },
  { key: 'gin', icon: '🍈', label: 'Gin' },
  { key: 'licores', icon: '🥂', label: 'Licores' },
  { key: 'aguardiente', icon: '🥃', label: 'Aguardiente' },
  { key: 'espumante', icon: '🍾', label: 'Espumante' },
  { key: 'cerveza', icon: '🍺', label: 'Cerveza' },
  { key: 'vino', icon: '🍷', label: 'Vino' },
  { key: 'energizante', icon: '⚡', label: 'Energizante' },
  { key: 'combos', icon: '📦', label: 'Combos' }
];

function pageCarousels() {
  const data = window.DATA.carousels || {};
  return `
    <div class="page-header">
      <div>
        <div class="page-title">CARRUSELES <span>DE PORTADA</span></div>
        <div class="page-sub">Hasta 3 fotos de fondo para el encabezado de cada sección. Se van rotando solas en el sitio; con 1 sola foto queda fija.</div>
      </div>
    </div>
    ${window.CAROUSEL_SECTIONS.map(s => carouselCard(s, (data[s.key] && data[s.key].images) || [])).join('')}
  `;
}

function carouselCard(section, images) {
  const slots = [0, 1, 2].map(i => {
    const url = images[i] || '';
    const inputId = `car_${section.key}_${i}`;
    const prevId = `${inputId}_prev`;
    return `
      <div class="field">
        <label>Foto ${i + 1}</label>
        <input id="${inputId}" value="${esc(url)}" placeholder="https://..." oninput="previewImg('${inputId}','${prevId}')"/>
        <div class="img-preview-wrap"><div class="img-preview" id="${prevId}">${url ? `<img src="${esc(url)}" alt=""/>` : `<span>Vista previa</span>`}</div></div>
      </div>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span>${section.icon}</span> ${section.label}</div>
      </div>
      <div class="card-body">
        <div class="field-row3">${slots}</div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="saveCarousel('${section.key}')">💾 Guardar</button>
        </div>
      </div>
    </div>`;
}

async function saveCarousel(key) {
  const images = [0, 1, 2]
    .map(i => document.getElementById(`car_${key}_${i}`)?.value.trim())
    .filter(Boolean);
  setSaving('saving');
  try {
    await window.fsSetDoc(window.fsDoc(window.db, 'heroCarousels', key), { images }, { merge: true });
    setSaving('ok');
    showToast('✅ Carrusel actualizado');
  } catch (e) {
    setSaving('');
    showToast('❌ Error: ' + e.message, 'err');
  }
}
window.saveCarousel = saveCarousel;

// ─────────────────────────────────────────────
// CATEGORY MANAGER (agregar / listar / editar / borrar)
// ─────────────────────────────────────────────
function pageCategoryManager(cat) {
  const isAll = cat === 'todos';
  const conf = isAll ? { icon: '🗂️', label: 'Todos los productos', title: 'TODO EL <span>CATÁLOGO</span>', sub: 'Todas las categorías en una sola vista.' } : window.CATEGORY_CONFIG[cat];

  const state = window.adminFilters[cat] || { search: '', brand: 'all', size: 'all' };
  window.adminFilters[cat] = state;

  const list = getProductsFor(cat);
  const brands = getUniqueBrands(cat);
  const sizes = getUniqueSizes(cat);

  const term = state.search.toLowerCase().trim();
  const filtered = list.filter(p => {
    const matchSearch = !term || `${p.name} ${p.brand} ${p.size}`.toLowerCase().includes(term);
    const matchBrand = state.brand === 'all' || p.brand === state.brand;
    const matchSize = state.size === 'all' || p.size === state.size;
    return matchSearch && matchBrand && matchSize;
  });

  return `
    <div class="page-header">
      <div>
        <div class="page-title">${conf.title}</div>
        <div class="page-sub">${conf.sub}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title"><span>${conf.icon}</span> Productos (${filtered.length}/${list.length})</div>
      </div>
      <div class="card-body">
        <div class="field-row3" style="margin-bottom:16px">
          <div class="field" style="margin:0">
            <label>Buscar</label>
            <input id="filterSearch_${cat}" placeholder="Nombre, marca o tamaño..." value="${esc(state.search)}" oninput="setAdminFilter('${cat}','search',this.value)"/>
          </div>
          <div class="field" style="margin:0">
            <label>Marca</label>
            <select onchange="setAdminFilter('${cat}','brand',this.value)">
              <option value="all">Todas</option>
              ${brands.map(b => `<option value="${esc(b)}" ${state.brand === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="margin:0">
            <label>Tamaño</label>
            <select onchange="setAdminFilter('${cat}','size',this.value)">
              <option value="all">Todos</option>
              ${sizes.map(s => `<option value="${esc(s)}" ${state.size === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="prod-list">
          ${filtered.length === 0 ? `<p style="color:var(--muted);text-align:center;padding:20px">No hay productos que coincidan con la búsqueda o filtros.</p>` : filtered.map(p => `
            <div class="prod-item ${p.active === false ? 'inactive' : ''}">
              <div class="prod-thumb">${p.image ? `<img src="${esc(p.image)}" alt=""/>` : `<span style="font-size:22px">${p.emoji || window.CATEGORY_CONFIG[p.category]?.icon || '🍾'}</span>`}</div>
              <div class="prod-meta">
                <strong>${esc(p.name)}</strong>
                <div class="meta-row">
                  <span class="meta-price">${fmt(p.price)}</span>
                  ${p.oldPrice ? `<span class="meta-old">${fmt(p.oldPrice)}</span>` : ''}
                  <span class="meta-brand">${esc(p.brand || '')}${p.size ? ' · ' + esc(p.size) : ''}</span>
                  ${p.badge ? `<span class="badge-pill ${badgeClass(p.badge)}">${esc(p.badge)}</span>` : ''}
                  ${isAll ? `<span class="badge-pill">${esc(p.category || '')}</span>` : ''}
                  ${stockPill(p.stock)}
                  ${p.active === false ? `<span class="badge-pill badge-inactive">OCULTO</span>` : ''}
                </div>
              </div>
              <div class="prod-actions">
                <button class="btn btn-ghost btn-sm" onclick="editProduct('${p.docId}')">✏️ Editar</button>
                <button class="btn btn-ghost btn-sm" onclick="toggleActive('${p.docId}', ${p.active === false})">${p.active === false ? '👁️ Mostrar' : '🙈 Ocultar'}</button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.docId}')">🗑</button>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    ${isAll ? '' : `
    <div class="add-panel">
      <div class="add-panel-title">➕ AGREGAR ${conf.label.toUpperCase()}</div>

      <div class="field-row">
        <div class="field"><label>Nombre</label><input id="npName_${cat}" placeholder="Ej: Jack Daniel's Honey"/></div>
        <div class="field"><label>Marca</label><input id="npBrand_${cat}" list="npBrandList_${cat}" placeholder="Ej: Jack Daniel's"/>
          <datalist id="npBrandList_${cat}">${brands.map(b => `<option value="${esc(b)}"></option>`).join('')}</datalist>
        </div>
      </div>

      <div class="field-row">
        <div class="field"><label>Tamaño</label><input id="npSize_${cat}" list="npSizeList_${cat}" placeholder="Ej: 750 cc"/>
          <datalist id="npSizeList_${cat}">${[...new Set([...COMMON_SIZES, ...sizes])].map(s => `<option value="${esc(s)}"></option>`).join('')}</datalist>
        </div>
        <div class="field"><label>Badge</label><input id="npBadge_${cat}" list="npBadgeList_${cat}" placeholder="Ej: NEW, Oferta..."/>
          <datalist id="npBadgeList_${cat}">
            <option value="NEW"></option><option value="Oferta"></option><option value="Premium"></option><option value="Hot"></option><option value="Últimas unidades"></option>
          </datalist>
        </div>
      </div>

      <div class="field-row3">
        <div class="field"><label>Precio ($)</label><input id="npPrice_${cat}" type="number" min="0" placeholder="24990"/></div>
        <div class="field"><label>Precio tachado ($)</label><input id="npOld_${cat}" type="number" min="0" placeholder="0 = sin tachado"/></div>
        <div class="field"><label>Stock (uds.)</label><input id="npStock_${cat}" type="number" min="0" placeholder="Vacío = ilimitado"/></div>
      </div>

      <div class="field">
        <label>URL imagen</label>
        <input id="npImg_${cat}" placeholder="https://..." oninput="previewImg('npImg_${cat}','npImgPrev_${cat}')"/>
        <div class="img-preview-wrap"><div class="img-preview" id="npImgPrev_${cat}"><span>Vista previa</span></div></div>
      </div>

      <div class="field"><label>Emoji de respaldo (si no hay imagen)</label><input id="npEmoji_${cat}" value="${conf.icon}"/></div>

      <div class="field"><label>Descripción</label><textarea id="npDesc_${cat}" placeholder="Se muestra en la ficha del producto..."></textarea></div>

      <div class="btn-row" style="margin-top:14px">
        <button class="btn btn-primary" onclick="addProduct('${cat}')">✅ Agregar ${conf.label.toLowerCase()}</button>
      </div>
    </div>`}
  `;
}

function setAdminFilter(cat, key, value) {
  window.adminFilters[cat] = window.adminFilters[cat] || { search: '', brand: 'all', size: 'all' };
  window.adminFilters[cat][key] = value;
  if (key === 'search') {
    const input = document.getElementById(`filterSearch_${cat}`);
    const cursor = input ? input.selectionStart : null;
    render(cat);
    const newInput = document.getElementById(`filterSearch_${cat}`);
    if (newInput) { newInput.focus(); if (cursor !== null) newInput.setSelectionRange(cursor, cursor); }
  } else {
    render(cat);
  }
}
window.setAdminFilter = setAdminFilter;

// ─────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────
async function addProduct(cat) {
  const name = document.getElementById(`npName_${cat}`).value.trim();
  const price = Number(document.getElementById(`npPrice_${cat}`).value) || 0;
  if (!name || !price) { showToast('⚠️ Completá nombre y precio', 'err'); return; }

  const stockRaw = document.getElementById(`npStock_${cat}`).value;
  const list = getProductsFor(cat);

  const data = {
    name,
    brand: document.getElementById(`npBrand_${cat}`).value.trim(),
    size: document.getElementById(`npSize_${cat}`).value.trim(),
    category: cat,
    price,
    oldPrice: Number(document.getElementById(`npOld_${cat}`).value) || null,
    stock: stockRaw === '' ? null : Number(stockRaw),
    badge: document.getElementById(`npBadge_${cat}`).value.trim() || null,
    emoji: document.getElementById(`npEmoji_${cat}`).value.trim() || window.CATEGORY_CONFIG[cat].icon,
    image: document.getElementById(`npImg_${cat}`).value.trim(),
    description: document.getElementById(`npDesc_${cat}`).value.trim(),
    active: true,
    order: list.length,
    createdAt: Date.now()
  };

  const newId = await fbAdd(data);
  if (newId) {
    showToast(`✅ ${name} agregado — ya visible en el sitio`);
    ['Name', 'Brand', 'Size', 'Badge', 'Price', 'Old', 'Stock', 'Img', 'Desc'].forEach(f => {
      const el = document.getElementById(`np${f}_${cat}`);
      if (el) el.value = '';
    });
    document.getElementById(`npEmoji_${cat}`).value = window.CATEGORY_CONFIG[cat].icon;
    previewImg(`npImg_${cat}`, `npImgPrev_${cat}`);
  }
}
window.addProduct = addProduct;

async function deleteProduct(docId) {
  if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
  const ok = await fbDelete(docId);
  if (ok) showToast('🗑 Producto eliminado');
}
window.deleteProduct = deleteProduct;

async function toggleActive(docId, makeActive) {
  const ok = await fbUpdate(docId, { active: makeActive });
  if (ok) showToast(makeActive ? '👁️ Producto visible en el sitio' : '🙈 Producto oculto del sitio');
}
window.toggleActive = toggleActive;

// ─────────────────────────────────────────────
// MODAL DE EDICIÓN
// ─────────────────────────────────────────────
function editProduct(docId) {
  const p = (window.DATA.productos || []).find(x => x.docId === docId);
  if (!p) return;

  document.getElementById('pmDocId').value = docId;
  document.getElementById('pmName').value = p.name || '';
  document.getElementById('pmCategory').value = p.category || 'Whisky';
  document.getElementById('pmBrand').value = p.brand || '';
  document.getElementById('pmSize').value = p.size || '';
  document.getElementById('pmPrice').value = p.price || '';
  document.getElementById('pmOld').value = p.oldPrice || '';
  document.getElementById('pmStock').value = (p.stock === null || p.stock === undefined) ? '' : p.stock;
  document.getElementById('pmBadge').value = p.badge || '';
  document.getElementById('pmEmoji').value = p.emoji || window.CATEGORY_CONFIG[p.category]?.icon || '';
  document.getElementById('pmImg').value = p.image || '';
  document.getElementById('pmDesc').value = p.description || '';
  document.getElementById('pmOrder').value = p.order ?? 0;
  document.getElementById('pmActive').checked = p.active !== false;

  const brandList = document.getElementById('pmBrandList');
  const sizeList = document.getElementById('pmSizeList');
  if (brandList) brandList.innerHTML = getUniqueBrands(p.category).map(b => `<option value="${esc(b)}"></option>`).join('');
  if (sizeList) sizeList.innerHTML = [...new Set([...COMMON_SIZES, ...getUniqueSizes(p.category)])].map(s => `<option value="${esc(s)}"></option>`).join('');

  previewImg('pmImg', 'pmImgPrev');

  const modal = document.getElementById('productModal');
  modal.classList.remove('hidden');
  modal.classList.add('open');
}
window.editProduct = editProduct;

function closeProductModal() {
  const modal = document.getElementById('productModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.classList.add('hidden');
}
window.closeProductModal = closeProductModal;

document.addEventListener('click', (e) => {
  const modal = document.getElementById('productModal');
  if (modal && modal.classList.contains('open') && e.target === modal) closeProductModal();
  const orderModal = document.getElementById('orderModal');
  if (orderModal && orderModal.classList.contains('open') && e.target === orderModal) closeOrderModal();
});

async function saveProductModal() {
  const docId = document.getElementById('pmDocId').value;
  const stockRaw = document.getElementById('pmStock').value;

  const data = {
    name: document.getElementById('pmName').value.trim(),
    category: document.getElementById('pmCategory').value,
    brand: document.getElementById('pmBrand').value.trim(),
    size: document.getElementById('pmSize').value.trim(),
    price: Number(document.getElementById('pmPrice').value) || 0,
    oldPrice: Number(document.getElementById('pmOld').value) || null,
    stock: stockRaw === '' ? null : Number(stockRaw),
    badge: document.getElementById('pmBadge').value.trim() || null,
    emoji: document.getElementById('pmEmoji').value.trim(),
    image: document.getElementById('pmImg').value.trim(),
    description: document.getElementById('pmDesc').value.trim(),
    order: Number(document.getElementById('pmOrder').value) || 0,
    active: document.getElementById('pmActive').checked
  };

  if (!data.name || !data.price) { showToast('⚠️ Completá nombre y precio', 'err'); return; }

  const ok = await fbUpdate(docId, data);
  if (ok) {
    closeProductModal();
    showToast('✅ Producto actualizado en Firebase');
  }
}
window.saveProductModal = saveProductModal;
