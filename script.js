import { escucharProductos } from "./firebase.js";

// ============================================================
//  ESTADO
// ============================================================
let PRODUCTS = [];
let cart = cargarCarritoGuardado();
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
      stock: p.stock ?? null,
      emoji: p.emoji ?? '🍾',
      badge: p.badge ?? null,
      newBadge: p.newBadge ?? p.badge === 'NEW'
    }))
    .sort((a, b) => Number(a.order ?? 9999) - Number(b.order ?? 9999));

  renderProducts(currentFilter);
  actualizarPreciosDelCarrito();
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

  grid.innerHTML = items.map(p => {
    const sinStock = p.stock !== null && p.stock !== undefined && Number(p.stock) <= 0;
    return `
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
          <button class="btn-add" id="btn-${p.id}" ${sinStock ? 'disabled' : ''} onclick="addToCart('${p.id}')" style="${sinStock ? 'opacity:.4;cursor:not-allowed' : ''}">${sinStock ? '✕' : '+'}</button>
        </div>
      </div>
    </div>
  `;
  }).join('');
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
//  Se guarda en localStorage ('gi_cart') en cada cambio, así se
//  mantiene al pasar de una categoría a otra (cada una es una
//  página distinta) y el checkout lo lee de ahí mismo.
// ============================================================
function cargarCarritoGuardado() {
  try {
    return JSON.parse(localStorage.getItem('gi_cart') || '{}') || {};
  } catch {
    return {};
  }
}

function guardarCarrito() {
  try {
    localStorage.setItem('gi_cart', JSON.stringify(cart));
  } catch {}
}

// Si el precio o el stock de un producto del carrito cambió desde que
// se agregó, se actualiza con los datos vigentes.
function actualizarPreciosDelCarrito() {
  let cambio = false;
  PRODUCTS.forEach(p => {
    if (!cart[p.id]) return;
    const limitado = p.stock !== null && p.stock !== undefined;
    const qty = limitado ? Math.min(cart[p.id].qty, Number(p.stock)) : cart[p.id].qty;
    if (qty > 0) cart[p.id] = { ...p, qty };
    else delete cart[p.id];
    cambio = true;
  });
  if (cambio) updateCart();
}

function addToCart(id) {
  const prod = PRODUCTS.find(p => String(p.id) === String(id));
  if (!prod) return;

  const unlimited = prod.stock === null || prod.stock === undefined;
  const currentQty = cart[id] ? cart[id].qty : 0;
  if (!unlimited && currentQty >= Number(prod.stock)) return;

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
  if (delta > 0) {
    // Los productos de otras categorías no están en PRODUCTS: se usa el
    // stock guardado junto con el carrito.
    const prod = PRODUCTS.find(p => String(p.id) === String(id)) || cart[id];
    const unlimited = prod.stock === null || prod.stock === undefined;
    if (!unlimited && cart[id].qty >= Number(prod.stock)) return;
  }
  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];
  updateCart();
}

function updateCart({ guardar = true } = {}) {
  if (guardar) guardarCarrito();

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
//  IR A CHECKOUT
// ============================================================
function irACheckout() {
  if (!Object.keys(cart).length) return;
  guardarCarrito();
  window.location.href = 'checkout.html';
}

// ============================================================
//  FUNCIONES USADAS POR onclick="..." EN HTML
// ============================================================
window.filterProducts = filterProducts;
window.addToCart = addToCart;
window.changeQty = changeQty;
window.toggleCart = toggleCart;
window.irACheckout = irACheckout;

// Si el carrito cambia en otra pestaña, o se vuelve a esta página con
// "atrás" después de agregar cosas en otra categoría, se recarga.
window.addEventListener('storage', e => {
  if (e.key !== 'gi_cart') return;
  cart = cargarCarritoGuardado();
  updateCart({ guardar: false });
});
window.addEventListener('pageshow', e => {
  if (!e.persisted) return;
  cart = cargarCarritoGuardado();
  updateCart({ guardar: false });
});

// El carrito se inicializa aunque Firestore todavía esté cargando.
updateCart({ guardar: false });
