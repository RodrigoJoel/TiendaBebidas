// ============================================================
//  CARRUSEL DE FONDO DEL HERO — GLOBAL IMPORTADOS
//  Muestra hasta 3 fotos como fondo difuminado del hero, rotando
//  cada varios segundos. Las fotos se administran desde /admin.html
//  (colección Firestore "heroCarousels"); mientras no se carguen,
//  se usan estas fotos de referencia.
// ============================================================
import { escucharCarrusel } from './firebase.js';

const DEFAULTS = {
  home: [
    'https://images.ctfassets.net/waruwpig3jxu/7HLalsdiPXEwFJEuSDmHJq/c34bf73b20d8811956427770d22fee79/Barrells__1_.jpg',
    'https://eldescorchediario.com/wp-content/uploads/2026/07/TRIV-4-Portfolio-Argentina.jpg',
    'https://media.biobiochile.cl/wp-content/uploads/2020/01/beers-2447512_960_720-750x400.jpg'
  ],
  whisky: ['https://images.ctfassets.net/waruwpig3jxu/7HLalsdiPXEwFJEuSDmHJq/c34bf73b20d8811956427770d22fee79/Barrells__1_.jpg'],
  ron: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSe8HtJGvCwK6lfz_BKRJxrLmglzlE_4KsA0CsSBMRDf1cb7xX27-jC54c&s=10'],
  vodka: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRmHiF8_t-aTaUZ0DPrvj5zyUANU_KwmjXpA3nlMgkbkH4xK62c3pYKs3-s&s=10'],
  tequila: ['https://elceo.com/wp-content/uploads/2024/03/don_julio_.jpg'],
  gin: ['https://i.pinimg.com/736x/3a/3e/e8/3a3ee87cb955f1e5776651a4c91fe3d5.jpg'],
  licores: ['https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=800&q=80'],
  aguardiente: ['https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR9wQeW4mS6BMR7WeFFeeDRVSpug6Ka2tKIdR74JAVU0u-FHiz53b4zHho&s=10'],
  espumante: ['https://acdn-us.mitiendanube.com/stores/001/400/953/products/161-ea1c94747eb3e83ddf16812413215993-480-0.webp'],
  cerveza: ['https://media.biobiochile.cl/wp-content/uploads/2020/01/beers-2447512_960_720-750x400.jpg'],
  vino: ['https://eldescorchediario.com/wp-content/uploads/2026/07/TRIV-4-Portfolio-Argentina.jpg'],
  energizante: ['https://images.unsplash.com/photo-1622543925917-763c34d1a86e?auto=format&fit=crop&w=800&q=85'],
  combos: ['https://images.unsplash.com/photo-1560508180-03f285f67ded?auto=format&fit=crop&w=800&q=80']
};

const ROTATE_MS = 6000;

function initHeroCarousel() {
  const container = document.getElementById('heroCarousel');
  if (!container) return;

  const seccion = document.body.dataset.heroSection || 'home';
  const fallback = DEFAULTS[seccion] || [];
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
