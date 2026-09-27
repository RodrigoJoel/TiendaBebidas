// ============================================================
//  CARRUSEL DE FONDO DEL HERO — GLOBAL IMPORTADOS
//  Muestra hasta 3 fotos como fondo difuminado del hero, rotando
//  cada varios segundos. Las fotos se administran desde /admin.html
//  (colección Firestore "heroCarousels"); mientras no se carguen,
//  se usan las fotos de referencia de carrusel-fotos.js.
// ============================================================
import { escucharCarrusel } from './firebase.js';
import { FOTOS_CARRUSEL_POR_DEFECTO } from './carrusel-fotos.js';

const ROTATE_MS = 6000;

function initHeroCarousel() {
  const container = document.getElementById('heroCarousel');
  if (!container) return;

  const seccion = document.body.dataset.heroSection || 'home';
  const fallback = FOTOS_CARRUSEL_POR_DEFECTO[seccion] || [];
  let timer = null;

  function renderSlides(images) {
    const list = (images && images.length ? images : fallback).slice(0, 3);
    container.innerHTML = list
      .map((url, i) => `<div class="hero-carousel-slide${i === 0 ? ' active' : ''}" style="background-image:url('${url.replace(/'/g, "\\'")}')"></div>`)
      .join('');

    if (timer) clearInterval(timer);
    if (list.length > 1) {
      let idx = 0;
      timer = setInterval(() => {
        const slides = container.querySelectorAll('.hero-carousel-slide');
        if (!slides.length) return;
        slides[idx].classList.remove('active');
        idx = (idx + 1) % slides.length;
        slides[idx].classList.add('active');
      }, ROTATE_MS);
    }
  }

  renderSlides(fallback);
  escucharCarrusel(seccion, renderSlides);
}

initHeroCarousel();
