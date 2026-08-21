import { escucharProductos } from "./firebase.js";

// ============================================================
//  ESTADO
// ============================================================
let PRODUCTS = [];
let cart = {};
let currentSort = 'destacados';
let filteredProducts = [];
let currentPage = 1;
const PRODUCTS_PER_PAGE = 10;
let brandExpanded = false;
let sizeExpanded = false;

// ============================================================
//  UTILS
// ============================================================
function formatPrice(n) {
  return '$' + Number(n || 0).toLocaleString('es-AR');
}

// ============================================================
//  PRODUCTOS DESDE FIRESTORE
// ============================================================
function cargarProductos(productos) {
  PRODUCTS = productos
    .filter(p => p.active !== false)
    .filter(p => (p.category ?? p.cat) === 'Cerveza')
    .map(p => ({
      ...p,
      id: p.id,
      name: p.name ?? 'Producto sin nombre',
      brand: p.brand ?? '',
      cat: p.category ?? p.cat ?? 'Cerveza',
      price: Number(p.price ?? 0),
      size: p.size ?? '',
      emoji: p.emoji ?? '🍺',
      badge: p.badge ?? null,
      oldPrice: Number(p.oldPrice ?? 0) || null,
      stock: p.stock ?? null,
      image: p.image ?? null,
      description: p.description ?? p.descripcion ?? ''
    }))
    .sort((a, b) => Number(a.order ?? 9999) - Number(b.order ?? 9999));

  filteredProducts = [...PRODUCTS];
  currentPage = 1;
  renderFilters();
  sortProducts(currentSort);
}

function mostrarErrorFirebase() {
  const grid = document.getElementById('productsGrid');
  if (grid) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--muted);">
        No se pudieron cargar los cervezas. Revisá la conexión con Firebase.
      </div>`;
  }
}

// Escucha cambios en tiempo real del catálogo.
escucharProductos(cargarProductos, mostrarErrorFirebase);

// ============================================================
//  FILTROS
// ============================================================
function getUniqueBrands() {
  return [...new Set(PRODUCTS.map(p => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

function getUniqueSizes() {
  const sizeOrder = ['50 cc', '200 cc', '375 cc', '500 cc', '700 cc', '750 cc', '1 L', '2 L', '3 L'];
  const sizes = [...new Set(PRODUCTS.map(p => p.size).filter(Boolean))];
  const ordered = sizeOrder.filter(s => sizes.includes(s));
  const others = sizes.filter(s => !sizeOrder.includes(s)).sort();
  return [...ordered, ...others];
}

function renderFilters() {
  const brandContainer = document.getElementById('brandFilter');
  const sizeContainer = document.getElementById('sizeFilter');
  const brandShowMore = document.getElementById('brandShowMore');
  const sizeShowMore = document.getElementById('sizeShowMore');

  if (!brandContainer || !sizeContainer) return;

  const brands = getUniqueBrands();
  brandContainer.innerHTML = brands.map(b => `
    <label>
      <input type="checkbox" class="brand-check" value="${b}" />
      ${b}
    </label>
  `).join('');

  const brandLabels = brandContainer.querySelectorAll('label');
  brandLabels.forEach((label, index) => {
    if (index >= 3) label.style.display = brandExpanded ? 'flex' : 'none';
  });
  if (brandLabels.length > 3) {
    brandShowMore.textContent = brandExpanded ? 'Ver menos' : `Ver más (${brandLabels.length - 3})`;
    brandShowMore.classList.remove('hidden');
  } else {
    brandShowMore.classList.add('hidden');
  }

  const sizes = getUniqueSizes();
  sizeContainer.innerHTML = sizes.map(s => `
    <label>
      <input type="checkbox" class="size-check" value="${s}" />
      ${s}
    </label>
  `).join('');

  const sizeLabels = sizeContainer.querySelectorAll('label');
  sizeLabels.forEach((label, index) => {
    if (index >= 3) label.style.display = sizeExpanded ? 'flex' : 'none';
  });
  if (sizeLabels.length > 3) {
    sizeShowMore.textContent = sizeExpanded ? 'Ver menos' : `Ver más (${sizeLabels.length - 3})`;
    sizeShowMore.classList.remove('hidden');
  } else {
    sizeShowMore.classList.add('hidden');
  }

  document.querySelectorAll('.brand-check, .size-check').forEach(el => {
    el.addEventListener('change', applyFilters);
  });
}

function toggleBrands() {
  brandExpanded = !brandExpanded;
  renderFilters();
}

function toggleSizes() {
  sizeExpanded = !sizeExpanded;
  renderFilters();
}

// ============================================================
//  FILTROS + BÚSQUEDA
// ============================================================
function applyFilters() {
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase().trim() ?? '';
  const selectedBrands = Array.from(document.querySelectorAll('.brand-check:checked')).map(el => el.value);
  const selectedSizes = Array.from(document.querySelectorAll('.size-check:checked')).map(el => el.value);

  filteredProducts = PRODUCTS.filter(p => {
    const matchBrand = !selectedBrands.length || selectedBrands.includes(p.brand);
    const matchSize = !selectedSizes.length || selectedSizes.includes(p.size);
    const matchSearch = !searchTerm || `${p.name} ${p.brand}`.toLowerCase().includes(searchTerm);
    return matchBrand && matchSize && matchSearch;
  });

  currentPage = 1;
  sortProducts(currentSort);
}

// ============================================================
//  ORDEN
// ============================================================
function sortProducts(type) {
  currentSort = type;
  const sorted = [...filteredProducts];

  if (type === 'destacados') {
    sorted.sort((a, b) => {
      if (a.badge && !b.badge) return -1;
      if (!a.badge && b.badge) return 1;
      return Number(a.order ?? 9999) - Number(b.order ?? 9999);
    });
  } else if (type === 'precio-menor') {
    sorted.sort((a, b) => a.price - b.price);
  } else if (type === 'precio-mayor') {
    sorted.sort((a, b) => b.price - a.price);
  }

  filteredProducts = sorted;

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => {
    if (t.textContent.trim() === 'Destacados' && type === 'destacados') t.classList.add('active');
    if (t.textContent.trim() === 'Precio ↑' && type === 'precio-menor') t.classList.add('active');
    if (t.textContent.trim() === 'Precio ↓' && type === 'precio-mayor') t.classList.add('active');
  });

  renderPage();
}

// ============================================================
//  PAGINACIÓN
// ============================================================
function renderPage() {
  const totalProducts = filteredProducts.length;
  const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE);

  if (currentPage > totalPages) currentPage = totalPages || 1;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const endIndex = Math.min(startIndex + PRODUCTS_PER_PAGE, totalProducts);
  const pageProducts = filteredProducts.slice(startIndex, endIndex);

  document.getElementById('productsCounter').textContent = totalProducts > 0
    ? `Mostrando ${startIndex + 1} - ${endIndex} de ${totalProducts} productos`
    : 'No se encontraron productos';

  renderProducts(pageProducts);

  document.getElementById('pageInfo').textContent = `Página ${currentPage} de ${totalPages || 1}`;
  document.getElementById('prevPage').disabled = currentPage <= 1;
  document.getElementById('nextPage').disabled = currentPage >= totalPages;
}

function changePage(delta) {
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const newPage = currentPage + delta;

  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    renderPage();
    document.getElementById('productos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ============================================================
//  RENDER PRODUCTOS
// ============================================================
function renderProducts(items) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  if (!items.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--muted);">No se encontraron productos</div>`;
    return;
  }

  grid.innerHTML = items.map(p => {
    const sinStock = p.stock !== null && p.stock !== undefined && Number(p.stock) <= 0;
    return `
    <div class="prod-card" onclick="openProductModal('${p.id}')">
      <div class="prod-img">
        ${p.badge ? `<div class="prod-badge${p.badge === 'NEW' ? ' new' : ''}">${p.badge}</div>` : ''}
        ${p.image
          ? `<img src="${p.image}" alt="${p.name}" loading="lazy" style="width:100%;height:100%;object-fit:contain;padding:1rem;" />`
          : `<span style="font-size:4.5rem">${p.emoji}</span>`}
      </div>
      <div class="prod-info">
        <div class="prod-name">${p.name}</div>
        <div class="prod-brand">${p.brand}${p.size ? ` · ${p.size}` : ''}</div>
        <div class="prod-bottom">
          <div>
            <span class="prod-price">${formatPrice(p.price)}</span>
            ${p.oldPrice ? `<span class="prod-price-old" style="margin-left:.4rem">${formatPrice(p.oldPrice)}</span>` : ''}
          </div>
          <button class="btn-add" id="btn-${p.id}" ${sinStock ? 'disabled' : ''} onclick="event.stopPropagation(); addToCart('${p.id}')" style="${sinStock ? 'opacity:.4;cursor:not-allowed' : ''}">${sinStock ? '✕' : '+'}</button>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

// ============================================================
//  MODAL DE PRODUCTO
// ============================================================
let modalProductId = null;

function openProductModal(id) {
  const prod = PRODUCTS.find(p => String(p.id) === String(id));
  if (!prod) return;
  modalProductId = id;

  const body = document.getElementById('productModalBody');
  if (!body) return;

  const sinStock = prod.stock !== null && prod.stock !== undefined && Number(prod.stock) <= 0;

  body.innerHTML = `
    <div class="modal-img">
      ${prod.badge ? `<div class="prod-badge${prod.badge === 'NEW' ? ' new' : ''}">${prod.badge}</div>` : ''}
      ${prod.image
        ? `<img src="${prod.image}" alt="${prod.name}" loading="lazy" />`
        : `<span style="font-size:7rem">${prod.emoji}</span>`}
    </div>
    <div class="modal-info">
      <div class="modal-brand">${prod.brand || ''}</div>
      <h2 class="modal-name">${prod.name}</h2>
      <div class="modal-size">${prod.size || ''}</div>
      <p class="modal-description">${prod.description || 'Sin descripción disponible por el momento.'}</p>
      ${sinStock ? `<p style="color:#ff6b6b;font-weight:600;font-size:.85rem;margin-top:.5rem">Sin stock disponible</p>` : ''}
      <div class="modal-bottom">
        <div>
          <span class="prod-price">${formatPrice(prod.price)}</span>
          ${prod.oldPrice ? `<span class="prod-price-old">${formatPrice(prod.oldPrice)}</span>` : ''}
        </div>
        <button class="btn-primary" id="modalAddBtn" ${sinStock ? 'disabled' : ''} style="${sinStock ? 'opacity:.5;cursor:not-allowed' : ''}" onclick="addToCartFromModal('${prod.id}')">${sinStock ? 'Sin stock' : 'Agregar al carrito 🛒'}</button>
      </div>
    </div>
  `;

  document.getElementById('productModal')?.classList.add('open');
  document.getElementById('modalOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function addToCartFromModal(id) {
  addToCart(id);
  const btn = document.getElementById('modalAddBtn');
  if (btn) {
    const original = btn.textContent;
    btn.textContent = 'Agregado ✓';
    setTimeout(() => { btn.textContent = original; }, 900);
  }
}

function closeProductModal() {
  document.getElementById('productModal')?.classList.remove('open');
  document.getElementById('modalOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
  modalProductId = null;
}

// ============================================================
//  RESET
// ============================================================
function resetFilters() {
  document.querySelectorAll('.brand-check, .size-check').forEach(el => el.checked = false);
  document.getElementById('searchInput').value = '';
  brandExpanded = false;
  sizeExpanded = false;
  renderFilters();
  applyFilters();
}

// ============================================================
//  CARRITO
// ============================================================
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
    const prod = PRODUCTS.find(p => String(p.id) === String(id));
    const unlimited = !prod || prod.stock === null || prod.stock === undefined;
    if (!unlimited && cart[id].qty >= Number(prod.stock)) return;
  }
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
  const items = Object.values(cart);

  if (!items.length) {
    el.innerHTML = `<div class="cart-empty"><div class="empty-icon">🍺</div><p>Todavía no agregaste nada</p></div>`;
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
  localStorage.setItem('gi_cart', JSON.stringify(cart));
  window.location.href = 'checkout.html';
}


// ============================================================
//  FUNCIONES USADAS POR onclick="..." EN HTML
// ============================================================
window.toggleBrands = toggleBrands;
window.toggleSizes = toggleSizes;
window.applyFilters = applyFilters;
window.sortProducts = sortProducts;
window.changePage = changePage;
window.resetFilters = resetFilters;
window.addToCart = addToCart;
window.changeQty = changeQty;
window.toggleCart = toggleCart;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.addToCartFromModal = addToCartFromModal;
window.irACheckout = irACheckout;

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeProductModal();
});

updateCart();
