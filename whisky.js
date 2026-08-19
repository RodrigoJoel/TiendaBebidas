// ============================================================
//  WHISKY DATA
// ============================================================
let PRODUCTS = [
  // 700cc
  { id: 1, name: 'Whisky Glen Moray Elgin Heritage 21 Años', brand: 'Glen Moray', cat: 'Whisky', price: 759990, size: '700 cc', emoji: '🥃', badge: 'Premium' },
  { id: 2, name: 'Whisky Jack Daniel\'s Honey', brand: 'Jack Daniel\'s', cat: 'Whisky', price: 64990, size: '700 cc', emoji: '🥃', badge: null },
  { id: 3, name: 'Whisky Loch Lomond 12 Años', brand: 'Loch Lomond', cat: 'Whisky', price: 129900, size: '700 cc', emoji: '🥃', badge: null },
  { id: 5, name: 'Whisky The Deacon Ahumado Escocés', brand: 'The Deacon', cat: 'Whisky', price: 129999, size: '700 cc', emoji: '🥃', badge: null },
  { id: 13, name: 'Whisky Grant\'s Ale Cask 12 Años', brand: 'Grant\'s', cat: 'Whisky', price: 42990, size: '700 cc', emoji: '🥃', badge: null },
  { id: 15, name: 'The Macallan Double Cask 18 Años', brand: 'Macallan', cat: 'Whisky', price: 1590000, size: '700 cc', emoji: '🥃', badge: 'Premium' },
  { id: 16, name: 'Whisky The Macallan Harmony', brand: 'Macallan', cat: 'Whisky', price: 1090000, size: '700 cc', emoji: '🥃', badge: null },
  { id: 17, name: 'Whisky Highland Park 18 Años', brand: 'Highland Park', cat: 'Whisky', price: 799000, size: '700 cc', emoji: '🥃', badge: 'Premium' },
  { id: 18, name: 'Whisky Highland Park 12 Años', brand: 'Highland Park', cat: 'Whisky', price: 259990, size: '700 cc', emoji: '🥃', badge: null },
  { id: 19, name: 'Whisky Penderyn Patagonia La Alazana', brand: 'Penderyn', cat: 'Whisky', price: 249900, size: '700 cc', emoji: '🥃', badge: null },
  { id: 20, name: 'Whisky Ballantines Queen Edición Limitada', brand: 'Ballantines', cat: 'Whisky', price: 41999, size: '700 cc', emoji: '🥃', badge: 'Edición' },

  // 750cc
  { id: 4, name: 'Whisky Jack Daniels N°7 + Estuche Guitarra', brand: 'Jack Daniel\'s', cat: 'Whisky', price: 249000, size: '750 cc', emoji: '🥃', badge: 'Edición' },
  { id: 6, name: 'Whisky Maker\'s Mark + 2 Vasos', brand: 'Maker\'s Mark', cat: 'Whisky', price: 149990, size: '750 cc', emoji: '🥃', badge: 'Oferta' },
  { id: 7, name: 'Whisky Kamiki Sakura Wood', brand: 'Kamiki', cat: 'Whisky', price: 449000, size: '750 cc', emoji: '🥃', badge: 'Premium' },
  { id: 8, name: 'Whisky Kamiki Original Blended Malt', brand: 'Kamiki', cat: 'Whisky', price: 369000, size: '750 cc', emoji: '🥃', badge: null },
  { id: 9, name: 'Whisky Kamiki Intense Wood', brand: 'Kamiki', cat: 'Whisky', price: 419000, size: '750 cc', emoji: '🥃', badge: null },
  { id: 10, name: 'Whisky Jack Daniels N°7 750cc + Vaso + Estuche', brand: 'Jack Daniel\'s', cat: 'Whisky', price: 64990, size: '750 cc', emoji: '🥃', badge: 'Oferta' },
  { id: 12, name: 'Whisky Jack Daniels Apple', brand: 'Jack Daniel\'s', cat: 'Whisky', price: 56999, size: '750 cc', emoji: '🥃', badge: null },
  { id: 14, name: 'Whisky Glenfiddich 30 Años', brand: 'Glenfiddich', cat: 'Whisky', price: 4890000, size: '750 cc', emoji: '🥃', badge: 'Colección' },

  // 1L
  { id: 11, name: 'Whisky Jack Daniels N°7 1L', brand: 'Jack Daniel\'s', cat: 'Whisky', price: 79999, size: '1 L', emoji: '🥃', badge: null },

  // Ejemplos con tamaños variados
  { id: 21, name: 'Whisky Miniature 50cc', brand: 'Miniature Co.', cat: 'Whisky', price: 5000, size: '50 cc', emoji: '🥃', badge: 'Mini' },
  { id: 22, name: 'Whisky Sample 200cc', brand: 'Sample House', cat: 'Whisky', price: 15000, size: '200 cc', emoji: '🥃', badge: null },
  { id: 23, name: 'Whisky Half Bottle 375cc', brand: 'Half Bottle Co.', cat: 'Whisky', price: 35000, size: '375 cc', emoji: '🥃', badge: null },
  { id: 24, name: 'Whisky Medium 500cc', brand: 'Medium Distillery', cat: 'Whisky', price: 45000, size: '500 cc', emoji: '🥃', badge: null },
  { id: 25, name: 'Whisky Magnum 2L', brand: 'Magnum Whisky', cat: 'Whisky', price: 250000, size: '2 L', emoji: '🥃', badge: 'Magnum' },
  { id: 26, name: 'Whisky Party 3L', brand: 'Party Whisky', cat: 'Whisky', price: 380000, size: '3 L', emoji: '🥃', badge: 'Party' },
];

// ============================================================
//  ESTADO
// ============================================================
let cart = {};
let currentSort = 'destacados';
let filteredProducts = [...PRODUCTS];
let currentPage = 1;
const PRODUCTS_PER_PAGE = 10;

// Estados de "Ver más"
let brandExpanded = false;
let sizeExpanded = false;

// ============================================================
//  UTILS
// ============================================================
function formatPrice(n) {
  return '$' + n.toLocaleString('es-AR');
}

// ============================================================
//  EXTRAER MARCAS Y TAMAÑOS ÚNICOS
// ============================================================
function getUniqueBrands() {
  const brands = [...new Set(PRODUCTS.map(p => p.brand))];
  return brands.sort();
}

function getUniqueSizes() {
  const sizeOrder = ['50 cc', '200 cc', '375 cc', '500 cc', '700 cc', '750 cc', '1 L', '2 L', '3 L'];
  const sizes = [...new Set(PRODUCTS.map(p => p.size))];
  return sizeOrder.filter(s => sizes.includes(s));
}

// ============================================================
//  RENDER FILTROS CON "VER MÁS"
// ============================================================
function renderFilters() {
  // Marcas
  const brandContainer = document.getElementById('brandFilter');
  const brands = getUniqueBrands();
  const brandShowMore = document.getElementById('brandShowMore');
  
  brandContainer.innerHTML = brands.map(b => `
    <label>
      <input type="checkbox" class="brand-check" value="${b}" />
      ${b}
    </label>
  `).join('');

  // Controlar visibilidad de marcas
  const brandLabels = brandContainer.querySelectorAll('label');
  if (brandLabels.length > 3) {
    brandLabels.forEach((label, index) => {
      if (index >= 3) label.style.display = brandExpanded ? 'flex' : 'none';
    });
    brandShowMore.textContent = brandExpanded ? 'Ver menos' : `Ver más (${brandLabels.length - 3})`;
    brandShowMore.classList.remove('hidden');
  } else {
    brandShowMore.classList.add('hidden');
  }

  // Tamaños
  const sizeContainer = document.getElementById('sizeFilter');
  const sizes = getUniqueSizes();
  const sizeShowMore = document.getElementById('sizeShowMore');
  
  sizeContainer.innerHTML = sizes.map(s => `
    <label>
      <input type="checkbox" class="size-check" value="${s}" />
      ${s}
    </label>
  `).join('');

  // Controlar visibilidad de tamaños
  const sizeLabels = sizeContainer.querySelectorAll('label');
  if (sizeLabels.length > 3) {
    sizeLabels.forEach((label, index) => {
      if (index >= 3) label.style.display = sizeExpanded ? 'flex' : 'none';
    });
    sizeShowMore.textContent = sizeExpanded ? 'Ver menos' : `Ver más (${sizeLabels.length - 3})`;
    sizeShowMore.classList.remove('hidden');
  } else {
    sizeShowMore.classList.add('hidden');
  }

  // Escuchar cambios
  document.querySelectorAll('.brand-check, .size-check').forEach(el => {
    el.addEventListener('change', applyFilters);
  });
}

// ============================================================
//  TOGGLES PARA "VER MÁS"
// ============================================================
function toggleBrands() {
  brandExpanded = !brandExpanded;
  renderFilters();
}

function toggleSizes() {
  sizeExpanded = !sizeExpanded;
  renderFilters();
}

// Exponer funciones globalmente
window.toggleBrands = toggleBrands;
window.toggleSizes = toggleSizes;

// ============================================================
//  APLICAR FILTROS + BÚSQUEDA
// ============================================================
function applyFilters() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

  const selectedBrands = Array.from(document.querySelectorAll('.brand-check:checked')).map(el => el.value);
  const selectedSizes = Array.from(document.querySelectorAll('.size-check:checked')).map(el => el.value);

  const hasBrandFilter = selectedBrands.length > 0;
  const hasSizeFilter = selectedSizes.length > 0;
  const hasSearch = searchTerm.length > 0;

  filteredProducts = PRODUCTS.filter(p => {
    const matchBrand = !hasBrandFilter || selectedBrands.includes(p.brand);
    const matchSize = !hasSizeFilter || selectedSizes.includes(p.size);
    const matchSearch = !hasSearch || p.name.toLowerCase().includes(searchTerm);
    return matchBrand && matchSize && matchSearch;
  });

  currentPage = 1;
  sortProducts(currentSort);
}

// ============================================================
//  ORDENAR
// ============================================================
function sortProducts(type) {
  currentSort = type;
  let sorted = [...filteredProducts];

  if (type === 'destacados') {
    sorted.sort((a, b) => {
      if (a.badge && !b.badge) return -1;
      if (!a.badge && b.badge) return 1;
      return 0;
    });
  } else if (type === 'precio-menor') {
    sorted.sort((a, b) => a.price - b.price);
  } else if (type === 'precio-mayor') {
    sorted.sort((a, b) => b.price - a.price);
  }

  filteredProducts = sorted;

  // Actualizar tabs
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
  
  // Asegurar que la página actual sea válida
  if (currentPage > totalPages) currentPage = totalPages || 1;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const endIndex = Math.min(startIndex + PRODUCTS_PER_PAGE, totalProducts);
  const pageProducts = filteredProducts.slice(startIndex, endIndex);

  // Actualizar contador
  document.getElementById('productsCounter').textContent = 
    totalProducts > 0 
      ? `Mostrando ${startIndex + 1} - ${endIndex} de ${totalProducts} productos`
      : 'No se encontraron productos';

  // Renderizar productos
  renderProducts(pageProducts);

  // Actualizar controles de paginación
  document.getElementById('pageInfo').textContent = `Página ${currentPage} de ${totalPages || 1}`;
  document.getElementById('prevPage').disabled = currentPage <= 1;
  document.getElementById('nextPage').disabled = currentPage >= totalPages;
}

function changePage(delta) {
  const totalProducts = filteredProducts.length;
  const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE);
  const newPage = currentPage + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    renderPage();
    // Scroll al inicio de los productos
    document.getElementById('productos').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Exponer funciones de paginación
window.changePage = changePage;

// ============================================================
//  RENDER PRODUCTOS
// ============================================================
function renderProducts(items) {
  const grid = document.getElementById('productsGrid');
  if (items.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--muted);">No se encontraron productos</div>`;
    return;
  }
  grid.innerHTML = items.map(p => `
    <div class="prod-card">
      <div class="prod-img">
        ${p.badge ? `<div class="prod-badge${p.badge === 'NEW' ? ' new' : ''}">${p.badge}</div>` : ''}
        <span style="font-size:4.5rem">${p.emoji}</span>
      </div>
      <div class="prod-info">
        <div class="prod-name">${p.name}</div>
        <div class="prod-brand">${p.brand} · ${p.size}</div>
        <div class="prod-bottom">
          <div>
            <span class="prod-price">${formatPrice(p.price)}</span>
          </div>
          <button class="btn-add" id="btn-${p.id}" onclick="addToCart(${p.id})">+</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ============================================================
//  RESET FILTROS
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
  const prod = PRODUCTS.find(p => p.id === id);
  if (!prod) return;
  cart[id] = cart[id] ? { ...cart[id], qty: cart[id].qty + 1 } : { ...prod, qty: 1 };
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
  renderCartItems();
}

function updateCart() {
  const total = Object.values(cart).reduce((s, i) => s + i.price * i.qty, 0);
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
    el.innerHTML = `<div class="cart-empty"><div class="empty-icon">🥃</div><p>Todavía no agregaste nada</p></div>`;
    return;
  }
  el.innerHTML = items.map(i => `
    <div class="cart-item">
      <div class="cart-item-img">${i.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${i.name}</div>
        <div class="cart-item-price">${formatPrice(i.price)}</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="changeQty(${i.id}, -1)">−</button>
          <span class="qty-val">${i.qty}</span>
          <button class="qty-btn" onclick="changeQty(${i.id}, 1)">+</button>
        </div>
      </div>
    </div>
  `).join('');
}

function toggleCart() {
  document.getElementById('cartDrawer').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('open');
}

// ============================================================
//  ADMIN: AGREGAR PRODUCTOS
// ============================================================
function addProduct(product) {
  const maxId = PRODUCTS.reduce((max, p) => Math.max(max, p.id), 0);
  product.id = maxId + 1;
  PRODUCTS.push(product);
  renderFilters();
  applyFilters();
  console.log(`✅ Producto agregado: ${product.name}`);
}

window.addProduct = addProduct;

// ============================================================
//  INIT
// ============================================================
renderFilters();
applyFilters();

console.log('📦 Tamaños disponibles:', getUniqueSizes());
console.log('📦 Para agregar un producto desde la consola:');
console.log('addProduct({ name: "Whisky Nuevo", brand: "Marca X", cat: "Whisky", price: 99999, size: "750 cc", emoji: "🥃", badge: "Nuevo" })');