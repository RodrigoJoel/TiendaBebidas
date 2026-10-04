// ============================================================
//  BOTELLAS 3D DE LA PORTADA — PROPUESTA ESTILO APPLE
//  Copia de botellas-3d.js para la página de muestra: lo único que
//  cambia es dónde se ubica la ronda (centrada, debajo del texto).
//  Una ronda giratoria con una botella real por sección (12), como
//  un exhibidor. Debajo se lee la sección de la botella que está al
//  frente; tocar una botella (o ese nombre) lleva a su sección.
//  Se puede girar arrastrando con el dedo o el mouse.
//  Cómo se arma cada botella está en botellas-comun.js.
//  Three.js dibuja; GSAP anima la entrada, el giro y el hover.
//  Las librerías se piden recién cuando la página terminó de cargar,
//  así no demoran lo demás. Sin WebGL, la portada queda como siempre.
// ============================================================

import {
  SECCIONES,
  cuandoEsteLibre,
  ordenarMitades,
  prepararEscena,
} from './botellas-comun.js';

const HUECO = 0.55; // espacio entre botellas en la ronda
const VEL_RUEDA = 0.22; // radianes por segundo (una vuelta cada ~28 s)
const ELEVACION = 0.3; // la cámara mira la ronda un poco desde arriba
const ESCALA_FRENTE = 0.22; // la botella del frente se ve un 22% más grande
// Versión alternativa guardada (apagada): dos filas de seis botellas,
// cada una girando sobre su eje, en vez de la ronda. Para usarla,
// cambiar a true.
const GRILLA = false;

// ---------- Ubicación en la portada ----------
// En esta propuesta la ronda va centrada debajo del texto: ocupa el
// lugar que le reserva propuesta-apple.css.
function calcularZona(hero, contenedor) {
  return { tira: true, width: contenedor.clientWidth, height: contenedor.clientHeight };
}

// ---------- Escena ----------
async function iniciar() {
  const hero = document.querySelector('.portada');
  const contenedor = document.getElementById('heroBotellas');
  if (!hero || !contenedor) return;

  // Si no se pueden mostrar, se saca el lugar reservado en celulares.
  let base;
  try {
    base = await prepararEscena(SECCIONES.map((s) => s.clave));
  } catch (err) {
    console.warn('No se pudieron cargar las botellas 3D:', err);
    return contenedor.remove();
  }
  const { THREE, gsap, renderer, escena, botellas } = base;

  const lienzo = renderer.domElement;
  contenedor.appendChild(lienzo);
  // Nombre de la sección que está al frente: es un link de verdad.
  const nombre = document.createElement('a');
  nombre.className = 'hero-botellas-nombre';
  contenedor.appendChild(nombre);

  const camara = new THREE.PerspectiveCamera(26, 1, 0.1, 200);
  const rueda = new THREE.Group();
  escena.add(rueda);

  const porClave = Object.fromEntries(botellas.map((b) => [b.clave, b]));
  const radioMax = Math.max(...botellas.map((b) => b.radio));
  const altoMax = Math.max(...botellas.map((b) => b.alto));
  const puntosCaja = [];
  let R = 0;
  let altoTotal = altoMax;

  if (GRILLA) {
    // Dos filas de seis; cada botella gira sobre su eje a su ritmo.
    const col = radioMax * 2 + 0.35;
    const fila = altoMax + 0.55;
    botellas.forEach((b, i) => {
      const x = ((i % 6) - 2.5) * col;
      b.baseY = i < 6 ? fila : 0;
      b.raiz.position.set(x, b.baseY, 0);
      b.sombra.position.set(x, b.baseY + 0.005, 0);
      b.velBase = 0.5 + (i % 4) * 0.06;
      b.vel = b.velBase;
      b.extra = i * 0.7;
      rueda.add(b.raiz, b.sombra);
    });
    altoTotal = fila + altoMax;
    for (const x of [-3 * col, 3 * col]) for (const y of [0, altoTotal]) for (const z of [-radioMax, radioMax]) puntosCaja.push(new THREE.Vector3(x, y, z));
  } else {
    // Arma la ronda: cada botella ocupa en la circunferencia lo que mide
    // de ancho, mirando hacia afuera.
    const perimetro = botellas.reduce((t, b) => t + b.radio * 2 + HUECO, 0);
    R = perimetro / (2 * Math.PI);
    let recorrido = 0;
    botellas.forEach((b) => {
      recorrido += b.radio + HUECO / 2;
      b.angulo = (recorrido / perimetro) * Math.PI * 2;
      recorrido += b.radio + HUECO / 2;
      b.baseY = 0;
      b.raiz.position.set(R * Math.sin(b.angulo), 0, R * Math.cos(b.angulo));
      b.raiz.rotation.y = b.angulo;
      b.sombra.position.set(b.raiz.position.x, 0.005, b.raiz.position.z);
      rueda.add(b.raiz, b.sombra);
    });
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      for (const y of [0, altoMax]) puntosCaja.push(new THREE.Vector3((R + radioMax) * Math.sin(a), y, (R + radioMax) * Math.cos(a)));
    }
    // La del frente, agrandada, también tiene que entrar.
    const grande = 1 + ESCALA_FRENTE;
    for (const a of [-0.3, 0, 0.3]) {
      for (const y of [0, altoMax * grande]) puntosCaja.push(new THREE.Vector3((R + radioMax * grande) * Math.sin(a), y, (R + radioMax * grande) * Math.cos(a)));
    }
  }

  // Estado del giro: la ronda arranca con la primera botella al frente.
  const estado = { angulo: GRILLA ? 0 : -botellas[0].angulo, vel: 0, arrastrando: false };

  // Encuadre: aleja la cámara hasta que la ronda entra completa y la
  // centra, dejando lugar abajo para el nombre.
  const ancla = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  function medir() {
    camara.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of puntosCaja) {
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
    const reservaNombre = Math.min(0.3, (2 * 30) / alto); // ~30 px para el nombre
    const yMin = -1 + reservaNombre;
    const yMax = 0.97;
    ancla.set(0, altoTotal * 0.45, 0);
    let dist = 4;
    for (; dist < 120; dist *= 1.04) {
      ubicarCamara(dist);
      const m = medir();
      if (m.x1 - m.x0 <= 1.94 && m.y1 - m.y0 <= yMax - yMin) break;
    }
    // Corre el punto de mira para centrar la ronda en el espacio libre.
    for (let k = 0; k < 3; k++) {
      const m = medir();
      const desvio = (m.y0 + m.y1) / 2 - (yMin + yMax) / 2;
      const altoVisible = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
      ancla.y += (desvio * altoVisible) / 2;
      ubicarCamara(dist);
    }
  }

  function acomodar() {
    contenedor.style.display = '';
    const z = calcularZona(hero, contenedor);
    if (!z) {
      contenedor.style.display = 'none';
      return;
    }
    const px = (v) => (z.tira ? '' : `${v}px`);
    Object.assign(contenedor.style, { left: px(z.left), top: px(z.top), width: px(z.width), height: px(z.height) });
    renderer.setSize(z.width, z.height, false);
    encuadrar(z.width, z.height);
    dibujar();
  }

  // Muestra el nombre de la botella del frente (o la que tiene el mouse).
  let enHover = null;
  let alFrente = null;
  function mostrarNombre(b) {
    if (b === alFrente) return;
    alFrente = b;
    if (!b) {
      gsap.to(nombre, { autoAlpha: 0, duration: 0.2, overwrite: true });
      return;
    }
    nombre.href = b.pagina;
    nombre.textContent = b.nombre;
    nombre.setAttribute('aria-label', `Ver ${b.nombre}`);
    gsap.fromTo(nombre, { autoAlpha: 0.2, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out', overwrite: true });
  }

  function dibujar() {
    rueda.rotation.y = estado.angulo;
    botellas.forEach((b) => {
      b.giro.rotation.y = b.extra;
      if (GRILLA) {
        b.xw = b.raiz.position.x;
        b.zw = 0;
        return;
      }
      const a = b.angulo + estado.angulo;
      b.xw = R * Math.sin(a);
      b.zw = R * Math.cos(a);
      // La que pasa por el frente se agranda y vuelve a su tamaño al
      // seguir de largo, así siempre resalta la del nombre.
      const escala = 1 + ESCALA_FRENTE * Math.max(0, Math.cos(a)) ** 8;
      b.raiz.scale.setScalar(escala);
      b.sombra.scale.setScalar(escala);
      // Las de atrás, más apagadas y un poco transparentes, para que
      // manden las de adelante.
      const cerca = (b.zw / R + 1) / 2;
      const brillo = 0.4 + 0.6 * cerca;
      b.piezas.forEach((p) => {
        p.material.color.setScalar(brillo);
        p.material.emissiveIntensity = 0.62 * brillo;
        p.material.opacity = 0.3 + 0.7 * Math.min(1, cerca * 1.4);
        p.reflejo.material.opacity = 0.3 * cerca;
      });
    });
    // Se dibujan de atrás hacia adelante.
    const orden = [...botellas].sort((p, q) => p.zw - q.zw);
    orden.forEach((b, k) => ordenarMitades(b, k, b.angulo + estado.angulo + b.extra, camara));
    mostrarNombre(GRILLA ? enHover : enHover || orden[orden.length - 1]);
    renderer.render(escena, camara);
  }

  // ---------- Mouse y dedo ----------
  const raycaster = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  function botellaBajo(ev) {
    const r = lienzo.getBoundingClientRect();
    puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(puntero, camara);
    const hit = raycaster.intersectObjects(botellas.map((b) => b.zona), false)[0];
    return hit ? porClave[hit.object.userData.clave] : null;
  }

  function marcarHover(b) {
    if (b === enHover) return;
    if (enHover) {
      gsap.to(enHover.giro.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
      if (GRILLA) gsap.to(enHover, { vel: reducirMovimiento ? 0 : enHover.velBase, duration: 0.8, overwrite: 'auto' });
    }
    enHover = b;
    lienzo.style.cursor = b ? 'pointer' : GRILLA ? '' : estado.arrastrando ? 'grabbing' : 'grab';
    if (b) {
      gsap.to(b.giro.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.4, ease: 'back.out(2)', overwrite: 'auto' });
      if (GRILLA) gsap.to(b, { vel: 2.4, duration: 0.5, overwrite: 'auto' });
      // Una vuelta entera sobre sí misma para saludar.
      else gsap.to(b, { extra: '+=' + Math.PI * 2, duration: 1.1, ease: 'power2.inOut', overwrite: 'auto' });
    }
  }

  let arrastre = null;
  if (!GRILLA) lienzo.style.cursor = 'grab';
  lienzo.addEventListener('pointerdown', (ev) => {
    arrastre = { x: ev.clientX, angulo: estado.angulo, t: performance.now(), movio: false, ultimoX: ev.clientX, ultimoT: performance.now(), vel: 0 };
    lienzo.setPointerCapture(ev.pointerId);
  });
  lienzo.addEventListener('pointermove', (ev) => {
    if (arrastre) {
      const dx = ev.clientX - arrastre.x;
      if (Math.abs(dx) > 6) arrastre.movio = true;
      if (arrastre.movio && !GRILLA) {
        estado.arrastrando = true;
        const porPixel = (Math.PI * 1.6) / lienzo.clientWidth;
        estado.angulo = arrastre.angulo + dx * porPixel;
        const ahora = performance.now();
        const dt = Math.max(ahora - arrastre.ultimoT, 1);
        arrastre.vel = ((ev.clientX - arrastre.ultimoX) * porPixel * 1000) / dt;
        arrastre.ultimoX = ev.clientX;
        arrastre.ultimoT = ahora;
        marcarHover(null);
        dibujar();
      }
      return;
    }
    if (ev.pointerType === 'mouse') marcarHover(botellaBajo(ev));
  });
  const soltar = (ev) => {
    if (!arrastre) return;
    const { movio, vel } = arrastre;
    arrastre = null;
    estado.arrastrando = false;
    if (!movio) {
      const b = botellaBajo(ev);
      if (b) window.location.href = b.pagina;
      return;
    }
    if (GRILLA) return;
    // Sigue girando con el impulso del arrastre y vuelve de a poco
    // a su velocidad normal.
    estado.vel = Math.max(-6, Math.min(6, vel));
    gsap.to(estado, { vel: reducirMovimiento ? 0 : VEL_RUEDA, duration: 1.6, ease: 'power2.out', overwrite: 'auto' });
  };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', () => {
    arrastre = null;
    estado.arrastrando = false;
  });
  lienzo.addEventListener('pointerleave', (ev) => {
    if (ev.pointerType === 'mouse') marcarHover(null);
  });

  // Mientras el mouse está sobre una botella, la ronda frena para
  // poder tocarla tranquilo.
  function velocidadObjetivo() {
    if (reducirMovimiento) return 0;
    return enHover ? 0 : VEL_RUEDA;
  }

  // ---------- Animación ----------
  let reducirMovimiento = false;
  let t = 0;
  const tick = (_time, deltaMs) => {
    const dt = Math.min(deltaMs, 50) / 1000;
    t += dt;
    if (GRILLA) botellas.forEach((b) => (b.extra += b.vel * dt));
    else if (!estado.arrastrando) {
      // Acerca la velocidad a la que corresponde (frena con hover).
      const objetivo = velocidadObjetivo();
      if (!gsap.isTweening(estado)) estado.vel += (objetivo - estado.vel) * Math.min(1, dt * 3);
      estado.angulo += estado.vel * dt;
    }
    dibujar();
  };

  let activo = false;
  const prender = (si) => {
    if (si === activo) return;
    activo = si;
    if (si) gsap.ticker.add(tick);
    else gsap.ticker.remove(tick);
  };
  new IntersectionObserver(([en]) => prender(en.isIntersecting)).observe(hero);

  const mm = gsap.matchMedia();
  mm.add({ reducir: '(prefers-reduced-motion: reduce)', normal: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
    reducirMovimiento = ctx.conditions.reducir;
    acomodar();

    if (reducirMovimiento) {
      // Sin movimiento automático: queda quieta; se puede girar a mano.
      estado.vel = 0;
      botellas.forEach((b) => {
        b.vel = 0;
        b.sombra.material.opacity = 1;
      });
      gsap.set(contenedor, { autoAlpha: 1 });
      dibujar();
      return;
    }

    // Entrada: las botellas suben de a una mientras la ronda da un
    // cuarto de vuelta y frena en su velocidad normal.
    const inicio = estado.angulo;
    estado.vel = 0;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to(contenedor, { autoAlpha: 1, duration: 0.4 })
      .fromTo(
        botellas.map((b) => b.raiz.position),
        { y: (i) => botellas[i].baseY - 5 },
        { y: (i) => botellas[i].baseY, duration: 1.2, stagger: 0.06 },
        0
      )
      .fromTo(botellas.map((b) => b.sombra.material), { opacity: 0 }, { opacity: 1, duration: 0.8, stagger: 0.06 }, 0.4);
    if (!GRILLA) {
      tl.fromTo(estado, { angulo: inicio - Math.PI / 2 }, { angulo: inicio, duration: 2, ease: 'power2.out' }, 0).to(
        estado,
        { vel: VEL_RUEDA, duration: 1, ease: 'power1.in' },
        2
      );
    }
  });

  // Reacomoda si cambia el tamaño de la portada (girar el celular,
  // achicar la ventana, o cuando termina de cargar la tipografía).
  new ResizeObserver(() => acomodar()).observe(hero);
}

cuandoEsteLibre(iniciar);
