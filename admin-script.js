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
function esc(v) { return String(v ?? '').replace(/"/g, '&quot;'); }
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
  if (el) el.classList.add('active');
  render(page);
}
window.navigate = navigate;

function render(page) {
  const main = document.getElementById('mainContent');
  if (!main) return;
  if (page === 'dashboard') { main.innerHTML = pageDashboard(); return; }
  if (page === 'todos') { main.innerHTML = pageCategoryManager('todos'); return; }
  if (window.CATEGORY_CONFIG[page]) { main.innerHTML = pageCategoryManager(page); return; }
  main.innerHTML = '<p style="color:var(--muted)">Página no encontrada</p>';
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

  return `
    <div class="page-header">
      <div>
        <div class="page-title">PANEL <span>DE CONTROL</span></div>
        <div class="page-sub">Catálogo sincronizado en tiempo real con Firebase</div>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-icon">🍾</div><div class="stat-info"><strong>${all.length}</strong><span>Productos totales</span></div></div>
      <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-info"><strong>${active}</strong><span>Activos en el sitio</span></div></div>
      <div class="stat-card"><div class="stat-icon red">❌</div><div class="stat-info"><strong>${sinStock}</strong><span>Sin stock</span></div></div>
      <div class="stat-card"><div class="stat-icon yellow">🗂️</div><div class="stat-info"><strong>${catsConProductos}/${window.CATEGORY_KEYS.length}</strong><span>Categorías con productos</span></div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
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
