const PRODUCTS = [
  { id: 1, name: 'Patagonia Amber Lager', brand: 'Cervecería Patagonia', cat: 'Cerveza', price: 1800, old: 2200, emoji: '🍺', badge: 'OFERTA' },
  { id: 2, name: 'Malbec Reserva 750ml', brand: 'Trapiche', cat: 'Vino', price: 3500, emoji: '🍷', badge: null },
  { id: 3, name: 'Gin Príncipe de los Apóstoles', brand: 'Apostoles', cat: 'Espirituosos', price: 8900, emoji: '🫙', badge: 'NEW', newBadge: true },
  { id: 4, name: 'Coca-Cola sin azúcar 2.25L', brand: 'Coca-Cola', cat: 'Sin Alcohol', price: 1200, old: 1500, emoji: '🥤', badge: 'OFERTA' },
  { id: 5, name: 'Corona Extra 355ml x6', brand: 'AB InBev', cat: 'Cerveza', price: 4200, emoji: '🍺', badge: null },
  { id: 6, name: 'Agua Villavicencio 6x1.5L', brand: 'Villavicencio', cat: 'Agua', price: 2800, emoji: '💧', badge: null },
  { id: 7, name: 'Fernet Branca 750ml', brand: 'Fratelli Branca', cat: 'Espirituosos', price: 6500, emoji: '🥃', badge: null },
  { id: 8, name: 'Red Bull 250ml x4', brand: 'Red Bull', cat: 'Energizante', price: 3600, emoji: '⚡', badge: 'NEW', newBadge: true },
  { id: 9, name: 'Schneider 1L x6', brand: 'Quilmes', cat: 'Cerveza', price: 5400, old: 6000, emoji: '🍺', badge: 'OFERTA' },
  { id: 10, name: 'Torrontés Clos de los Siete', brand: 'Lurton', cat: 'Vino', price: 4800, emoji: '🍷', badge: null },
  { id: 11, name: 'Sprite 2L x6', brand: 'Coca-Cola', cat: 'Sin Alcohol', price: 4600, emoji: '🥤', badge: null },
  { id: 12, name: 'Whisky Johnnie Walker Red', brand: 'Diageo', cat: 'Espirituosos', price: 11500, emoji: '🥃', badge: null },
];

let cart = {};
let currentFilter = 'Todos';

function formatPrice(n) {
  return '$' + n.toLocaleString('es-AR');
}

function renderProducts(filter) {
  const grid = document.getElementById('productsGrid');
  const items = filter === 'Todos' ? PRODUCTS : PRODUCTS.filter(p => p.cat === filter);
  grid.innerHTML = items.map(p => `
    <div class="prod-card">
      <div class="prod-img">
        ${p.badge ? `<div class="prod-badge${p.newBadge ? ' new' : ''}">${p.badge}</div>` : ''}
        <span style="font-size:4.5rem">${p.emoji}</span>
      </div>
      <div class="prod-info">
        <div class="prod-name">${p.name}</div>
        <div class="prod-brand">${p.brand}</div>
        <div class="prod-bottom">
          <div>
            <span class="prod-price">${formatPrice(p.price)}</span>
            ${p.old ? `<span class="prod-price-old">${formatPrice(p.old)}</span>` : ''}
          </div>
          <button class="btn-add" id="btn-${p.id}" onclick="addToCart(${p.id})">+</button>
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
    document.getElementById('productos').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  return false;
}

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
    el.innerHTML = `<div class="cart-empty" id="cartEmpty"><div class="empty-icon">🍺</div><p>Todavía no agregaste nada</p></div>`;
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
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('overlay');
  drawer.classList.toggle('open');
  overlay.classList.toggle('open');
}

// Inicializar
renderProducts('Todos');