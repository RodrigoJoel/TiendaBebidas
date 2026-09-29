// ============================================================
//  BOTELLA 3D DE CADA CATEGORÍA — GLOBAL IMPORTADOS
//  Al lado del título de la categoría gira, sobre su propio eje, la
//  misma botella que la representa en la ronda de la portada (en
//  Combos, el vodka con sus latas). Al pasar el mouse gira más rápido.
//  La categoría sale de <body data-hero-section="...">.
//  Cómo se arma cada botella está en botellas-comun.js. Las librerías
//  se piden recién cuando la página terminó de cargar; sin WebGL, el
//  encabezado queda como siempre.
// ============================================================

import { cuandoEsteLibre, medirTexto, ordenarMitades, prepararEscena } from './botellas-comun.js';

const VEL = 0.55; // radianes por segundo (una vuelta cada ~11 s)
const VEL_HOVER = 2.4;
const ELEVACION = 0.12;
// En celulares categoria.css le deja al texto una columna libre a la
// derecha para la botella.
const MEDIA_CELULAR = '(max-width: 640px)';

// Espacio a la derecha del título: del texto hasta el borde, con el
// alto del encabezado. "relacion" es cuánto más ancha que alta es la
// botella (Combos es más ancho).
function calcularZona(hero, relacion) {
  const h1 = hero.querySelector('h1');
  const sub = hero.querySelector('.hero-sub');
  if (!h1) return null;
  const hr = hero.getBoundingClientRect();
  const celular = window.matchMedia(MEDIA_CELULAR).matches;

  const derTitulo = Math.max(...[...h1.querySelectorAll('span')].map((s) => medirTexto(s).right));
  const derTexto = Math.max(derTitulo, sub ? medirTexto(sub).right : 0);
  const izq = derTexto - hr.left + (celular ? 8 : 28);
  const disponible = hr.width - (celular ? 12 : 32) - izq;

  const arriba = h1.getBoundingClientRect().top - hr.top - 20;
  const abajo = hr.height - 6;
  const alto = abajo - arriba;
  const ancho = Math.min(disponible, alto * relacion);
  if (ancho < 40) return null;
  return { left: izq, top: arriba, width: ancho, height: alto };
}

async function iniciar() {
  const hero = document.querySelector('.hero');
  const clave = document.body.dataset.heroSection;
  if (!hero || !clave) return;

  let base;
  try {
    base = await prepararEscena([clave]);
  } catch (err) {
    console.warn('No se pudo cargar la botella 3D:', err);
    return;
  }
  const { THREE, gsap, renderer, escena, botellas } = base;
  const b = botellas[0];
  if (!b) return;

  const contenedor = document.createElement('div');
  contenedor.className = 'hero-botella';
  contenedor.setAttribute('aria-hidden', 'true');
  // Fuera del flujo siempre (aunque falte el CSS): si empujara el
  // encabezado, su propio alto lo haría crecer sin fin.
  contenedor.style.position = 'absolute';
  contenedor.appendChild(renderer.domElement);
  hero.appendChild(contenedor);

  b.sombra.material.opacity = 1;
  escena.add(b.raiz, b.sombra);
  const camara = new THREE.PerspectiveCamera(24, 1, 0.1, 100);

  // Encuadre: la botella girando entra completa, apoyada abajo.
  const puntos = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    for (const y of [0, b.alto]) puntos.push(new THREE.Vector3(b.radio * Math.sin(a), y, b.radio * Math.cos(a)));
  }
  const tmp = new THREE.Vector3();
  const ancla = new THREE.Vector3();
  function medir() {
    camara.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of puntos) {
      tmp.copy(p).project(camara);
      x0 = Math.min(x0, tmp.x); x1 = Math.max(x1, tmp.x);
      y0 = Math.min(y0, tmp.y); y1 = Math.max(y1, tmp.y);
    }
    return { x0, x1, y0, y1 };
  }
  function ubicarCamara(dist) {
    camara.position.set(0, ancla.y + dist * Math.sin(ELEVACION), dist * Math.cos(ELEVACION));
    camara.lookAt(ancla);
  }
  function encuadrar(ancho, alto) {
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    ancla.set(0, b.alto * 0.5, 0);
    let dist = 3;
    for (; dist < 80; dist *= 1.04) {
      ubicarCamara(dist);
      const m = medir();
      if (m.x1 - m.x0 <= 1.9 && m.y1 - m.y0 <= 1.9) break;
    }
    const m = medir();
    const altoVisible = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
    ancla.y += (((m.y0 + m.y1) / 2) * altoVisible) / 2;
    ubicarCamara(dist);
  }

  const relacion = (b.radio * 2 + 0.5) / (b.alto + 0.6);
  function acomodar() {
    const z = calcularZona(hero, relacion);
    if (!z) {
      contenedor.style.display = 'none';
      return;
    }
    contenedor.style.display = '';
    Object.assign(contenedor.style, { left: `${z.left}px`, top: `${z.top}px`, width: `${z.width}px`, height: `${z.height}px` });
    renderer.setSize(z.width, z.height, false);
    encuadrar(z.width, z.height);
    dibujar();
  }

  function dibujar() {
    b.giro.rotation.y = b.extra;
    ordenarMitades(b, 0, b.extra, camara);
    renderer.render(escena, camara);
  }

  // Hover: gira más rápido y se agranda un poco.
  let reducirMovimiento = false;
  const lienzo = renderer.domElement;
  lienzo.addEventListener('pointerenter', () => {
    gsap.to(b, { vel: reducirMovimiento ? 0 : VEL_HOVER, duration: 0.5, overwrite: 'auto' });
    gsap.to(b.giro.scale, { x: 1.06, y: 1.06, z: 1.06, duration: 0.4, ease: 'back.out(2)', overwrite: 'auto' });
  });
  lienzo.addEventListener('pointerleave', () => {
    gsap.to(b, { vel: reducirMovimiento ? 0 : VEL, duration: 0.8, overwrite: 'auto' });
    gsap.to(b.giro.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
  });

  const tick = (_time, deltaMs) => {
    b.extra += b.vel * (Math.min(deltaMs, 50) / 1000);
    dibujar();
  };
  let activo = false;
  const prender = (si) => {
    if (si === activo) return;
    activo = si;
    if (si) gsap.ticker.add(tick);
    else gsap.ticker.remove(tick);
  };

  const mm = gsap.matchMedia();
  mm.add({ reducir: '(prefers-reduced-motion: reduce)', normal: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
    reducirMovimiento = ctx.conditions.reducir;
    acomodar();
    if (reducirMovimiento) {
      // Quieta y de frente.
      b.vel = 0;
      b.extra = 0;
      prender(false);
      gsap.set(contenedor, { autoAlpha: 1 });
      dibujar();
      return;
    }
    // Entrada: sube girando y sigue a su ritmo.
    b.vel = VEL;
    gsap
      .timeline({ defaults: { ease: 'power3.out' } })
      .to(contenedor, { autoAlpha: 1, duration: 0.4 })
      .fromTo(b.raiz.position, { y: -4 }, { y: 0, duration: 1.1 }, 0)
      .fromTo(b, { extra: -Math.PI }, { extra: 0, duration: 1.4, immediateRender: false }, 0);
    const io = new IntersectionObserver(([en]) => prender(en.isIntersecting));
    io.observe(hero);
    return () => {
      io.disconnect();
      prender(false);
    };
  });

  // Reacomoda si cambia el tamaño del encabezado (girar el celular,
  // achicar la ventana, o cuando termina de cargar la tipografía).
  new ResizeObserver(() => acomodar()).observe(hero);
}

cuandoEsteLibre(iniciar);
