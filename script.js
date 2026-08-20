import { escucharProductos } from "./firebase.js";

// ============================================================
//  ESTADO
// ============================================================
let PRODUCTS = [];
let cart = {};
let currentFilter = 'Todos';

// ============================================================
//  UTILS
// ============================================================
function formatPrice(n) {
  return '$' + Number(n || 0).toLocaleString('es-AR');
}

function isActive(product) {
  return product.active !== false;
}

// ============================================================
//  PRODUCTOS DESDE FIRESTORE
// ============================================================
function cargarProductos(productos) {
  PRODUCTS = productos
    .filter(isActive)
    .map(p => ({
      ...p,
      cat: p.category ?? p.cat ?? '',
      price: Number(p.price ?? 0),
      old: p.oldPrice != null ? Number(p.oldPrice) : (p.old != null ? Number(p.old) : null),
      emoji: p.emoji ?? '🍾',
      badge: p.badge ?? null,
      newBadge: p.newBadge ?? p.badge === 'NEW'
    }))
    .sort((a, b) => Number(a.order ?? 9999) - Number(b.order ?? 9999));

  renderProducts(currentFilter);
  actualizarContadoresCategorias();
}

function mostrarErrorFirebase() {
  const grid = document.getElementById('productsGrid');
  if (grid) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--muted);">
        No se pudieron cargar los productos. Revisá la conexión con Firebase.
      </div>`;
  }
}

// Escucha cambios en tiempo real. Cuando el futuro panel admin agregue,
// edite o desactive productos, el sitio se actualizará automáticamente.
escucharProductos(cargarProductos, mostrarErrorFirebase);

// ============================================================
//  CATEGORÍAS
// ============================================================
function actualizarContadoresCategorias() {
  document.querySelectorAll('.cat-card').forEach(card => {
    const onclick = card.getAttribute('onclick') || '';
    const match = onclick.match(/filterProducts\(['"](.+?)['"]\)/);
    if (!match) return;

    const category = match[1];
    const count = PRODUCTS.filter(p => p.cat === category).length;
    const counter = card.querySelector('.cat-count');
    if (counter) counter.textContent = count ? `${count} productos` : '';
  });
}

// ============================================================
//  PRODUCTOS
// ============================================================
function renderProducts(filter) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  const items = filter === 'Todos'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.cat === filter);

  if (!items.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--muted);">
        No hay productos disponibles en esta categoría.
      </div>`;
    return;
  }

  grid.innerHTML = items.map(p => `
    <div class="prod-card">
      <div class="prod-img">
        ${p.badge ? `<div class="prod-badge${p.newBadge ? ' new' : ''}">${p.badge}</div>` : ''}
        ${p.image
          ? `<img src="${p.image}" alt="${p.name}" loading="lazy" style="width:100%;height:100%;object-fit:contain;padding:1rem;" />`
          : `<span style="font-size:4.5rem">${p.emoji}</span>`}
      </div>
      <div class="prod-info">
        <div class="prod-name">${p.name}</div>
        <div class="prod-brand">${p.brand ?? ''}</div>
        <div class="prod-bottom">
          <div>
            <span class="prod-price">${formatPrice(p.price)}</span>
            ${p.old ? `<span class="prod-price-old">${formatPrice(p.old)}</span>` : ''}
          </div>
          <button class="btn-add" id="btn-${p.id}" onclick="addToCart('${p.id}')">+</button>
        </div>
      </div>
    </div>
  `).join('');
}

function filterProducts(cat) {
  currentFilter = cat;
  renderProducts(cat);

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => {
    if (t.textContent.trim() === cat || (cat === 'Todos' && t.textContent.trim() === 'Todos')) {
      t.classList.add('active');
    }
  });

  if (cat !== 'Todos') {
    document.getElementById('productos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  return false;
}

// ============================================================
//  CARRITO
// ============================================================
function addToCart(id) {
  const prod = PRODUCTS.find(p => String(p.id) === String(id));
  if (!prod) return;

  cart[id] = cart[id]
    ? { ...cart[id], qty: cart[id].qty + 1 }
    : { ...prod, qty: 1 };

  const btn = document.getElementById('btn-' + id);
  if (btn) {
    btn.classList.add('added');
    btn.textContent = '✓';
    setTimeout(() => {
      btn.classList.remove('added');
      btn.textContent = '+';
    }, 900);
  }

  updateCart();
}

function changeQty(id, delta) {
  if (!cart[id]) return;
  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];
  updateCart();
}

function updateCart() {
  const total = Object.values(cart).reduce((s, i) => s + Number(i.price) * i.qty, 0);
  const count = Object.values(cart).reduce((s, i) => s + i.qty, 0);

  document.getElementById('cartCount').textContent = count;
  document.getElementById('cartTotal').textContent = formatPrice(total);
  document.getElementById('checkoutBtn').disabled = count === 0;
  renderCartItems();
}

function renderCartItems() {
  const el = document.getElementById('cartItems');
  if (!el) return;

  const items = Object.values(cart);
  if (!items.length) {
    el.innerHTML = `<div class="cart-empty" id="cartEmpty"><div class="empty-icon">🍺</div><p>Todavía no agregaste nada</p></div>`;
    return;
  }

  el.innerHTML = items.map(i => `
    <div class="cart-item">
      <div class="cart-item-img">${i.image ? `<img src="${i.image}" alt="" style="width:100%;height:100%;object-fit:contain;">` : i.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${i.name}</div>
        <div class="cart-item-price">${formatPrice(i.price)}</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="changeQty('${i.id}', -1)">−</button>
          <span class="qty-val">${i.qty}</span>
          <button class="qty-btn" onclick="changeQty('${i.id}', 1)">+</button>
        </div>
      </div>
    </div>
  `).join('');
}

function toggleCart() {
  document.getElementById('cartDrawer')?.classList.toggle('open');
  document.getElementById('overlay')?.classList.toggle('open');
}

// ============================================================
//  FUNCIONES USADAS POR onclick="..." EN HTML
// ============================================================
window.filterProducts = filterProducts;
window.addToCart = addToCart;
window.changeQty = changeQty;
window.toggleCart = toggleCart;

// El carrito se inicializa aunque Firestore todavía esté cargando.
updateCart();
