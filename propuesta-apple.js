// ============================================================
//  PROPUESTA DE DISEÑO — estilo apple.com
//  Lo propio de las páginas de muestra (inicio y secciones): menú del
//  celular, el numerito del carrito, las flechas de la fila de
//  destacados y la aparición de cada bloque al llegar. Productos y
//  carrito los manejan script.js (inicio) y categoria.js (secciones).
// ============================================================

const raiz = document.documentElement;
const gnav = document.getElementById('gnav');
const menu = document.getElementById('menu');
const botonMenu = document.getElementById('botonMenu');
const cajon = document.getElementById('cartDrawer');

// La página de atrás no se mueve mientras hay un menú o el carrito abierto.
function trabarScroll() {
  raiz.classList.toggle('sin-scroll', menu.classList.contains('abierto') || cajon.classList.contains('open'));
}

// ---------- Menú del celular ----------
function abrirMenu(si) {
  menu.classList.toggle('abierto', si);
  menu.inert = !si;
  gnav.classList.toggle('con-menu', si);
  botonMenu.setAttribute('aria-expanded', String(si));
  botonMenu.setAttribute('aria-label', si ? 'Cerrar el menú' : 'Menú');
  trabarScroll();
}
menu.inert = true;
botonMenu.addEventListener('click', () => abrirMenu(!menu.classList.contains('abierto')));
menu.addEventListener('click', (ev) => {
  if (ev.target.closest('a')) abrirMenu(false);
});
window.matchMedia('(min-width: 900px)').addEventListener('change', (ev) => {
  if (ev.matches) abrirMenu(false);
});

// ---------- Carrito ----------
// script.js y categoria.js abren y cierran el cajón con la clase "open".
cajon.inert = true;
new MutationObserver(() => {
  const abierto = cajon.classList.contains('open');
  cajon.inert = !abierto;
  trabarScroll();
  if (abierto) cajon.querySelector('.btn-close').focus({ preventScroll: true });
}).observe(cajon, { attributes: true, attributeFilter: ['class'] });

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  if (cajon.classList.contains('open')) window.toggleCart();
  else if (menu.classList.contains('abierto')) abrirMenu(false);
});

// El numerito solo se ve cuando hay algo en el carrito.
const cuenta = document.getElementById('cartCount');
const marcarCuenta = () => cuenta.toggleAttribute('data-vacio', cuenta.textContent.trim() === '0');
new MutationObserver(marcarCuenta).observe(cuenta, { childList: true, characterData: true, subtree: true });
marcarCuenta();

// ---------- Fila de destacados ----------
// Solo está en el inicio: en las secciones los productos van en grilla.
const fila = document.getElementById('productsGrid');
const flechas = document.getElementById('flechas');
if (fila && flechas) {
  const anterior = document.getElementById('flechaAnterior');
  const siguiente = document.getElementById('flechaSiguiente');

  const actualizarFlechas = () => {
    const max = fila.scrollWidth - fila.clientWidth;
    flechas.hidden = max < 4;
    anterior.disabled = fila.scrollLeft < 4;
    siguiente.disabled = fila.scrollLeft > max - 4;
  };
  // Avanza de a las tarjetas que entran enteras en pantalla.
  const paso = () => {
    const tarjeta = fila.querySelector('.prod-card');
    if (!tarjeta) return fila.clientWidth;
    const ancho = tarjeta.getBoundingClientRect().width + parseFloat(getComputedStyle(fila).columnGap || 0);
    const libre = fila.clientWidth - 2 * parseFloat(getComputedStyle(fila).paddingLeft || 0);
    return ancho * Math.max(1, Math.floor(libre / ancho));
  };
  anterior.addEventListener('click', () => fila.scrollBy({ left: -paso(), behavior: 'smooth' }));
  siguiente.addEventListener('click', () => fila.scrollBy({ left: paso(), behavior: 'smooth' }));
  fila.addEventListener('scroll', actualizarFlechas, { passive: true });
  new MutationObserver(() => {
    fila.scrollLeft = 0;
    actualizarFlechas();
  }).observe(fila, { childList: true });
  new ResizeObserver(actualizarFlechas).observe(fila);
}

// ---------- Aparecer al llegar ----------
const vistos = new IntersectionObserver(
  (entradas) => {
    entradas.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('visto');
      vistos.unobserve(en.target);
    });
  },
  { threshold: 0.2, rootMargin: '0px 0px -6% 0px' }
);
document.querySelectorAll('.rev').forEach((el) => vistos.observe(el));
