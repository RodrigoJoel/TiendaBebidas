// ============================================================
//  BOTELLAS 3D DE LA PORTADA — GLOBAL IMPORTADOS
//  Botellas reales girando al costado del título, una por categoría.
//  Cada botella es la foto del producto (recortada, en /botellas/)
//  envuelta sobre un volumen con la silueta de esa misma botella
//  (botellas/perfiles.json). De frente se ve igual que la foto; al
//  girar, la parte de atrás repite el frente.
//  Al pasar el mouse gira más rápido y al tocarla lleva a su categoría.
//  Three.js dibuja; GSAP anima la entrada y el hover.
//  Las librerías se piden recién cuando la página terminó de cargar,
//  así no demoran lo demás. Sin WebGL, la portada queda como siempre.
// ============================================================

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.186.1/+esm';
const GSAP_URL = 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/+esm';

// Qué botella va en cada categoría y su alto relativo (las fotos
// vienen todas del mismo alto; esto respeta el tamaño real).
const BOTELLAS = {
  vodka: { pagina: 'vodka.html', alto: 1 },
  gin: { pagina: 'gin.html', alto: 0.84 },
  whisky: { pagina: 'whisky.html', alto: 0.86 },
  espumante: { pagina: 'espumante.html', alto: 0.93 },
  tequila: { pagina: 'tequila.html', alto: 1.02 },
  licores: { pagina: 'licores.html', alto: 0.76 },
};

// Orden de izquierda a derecha según el espacio disponible.
const FILA_6 = ['vodka', 'gin', 'whisky', 'espumante', 'tequila', 'licores'];
const FILA_5 = ['vodka', 'gin', 'whisky', 'espumante', 'tequila'];
const FILA_3 = ['gin', 'whisky', 'espumante'];
const ALTO_BASE = 3.2; // alto en unidades 3D de una botella de alto 1
const SEPARACION = 0.32;

// ---------- Carga diferida ----------
function cuandoEsteLibre(fn) {
  const correr = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 300));
  if (document.readyState === 'complete') correr();
  else window.addEventListener('load', correr, { once: true });
}

function hayWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

// ---------- Volumen de la botella ----------
// Media botella (de -90° a 90°) con la foto proyectada de frente: cada
// punto toma el píxel que la cámara de la foto veía ahí. Se usa dos
// veces (la segunda girada 180°) para cerrar la botella.
function geometriaMitad(THREE, perfil, aspecto, alto) {
  const n = perfil.length;
  const lados = 36;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i < n; i++) {
    const y = (i / (n - 1)) * alto;
    const r = perfil[i] * alto;
    for (let j = 0; j <= lados; j++) {
      const t = -Math.PI / 2 + (Math.PI * j) / lados;
      const s = Math.sin(t);
      pos.push(r * s, y, r * Math.cos(t));
      uv.push(0.5 + (perfil[i] / aspecto) * s, i / (n - 1));
    }
  }
  const fila = lados + 1;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < lados; j++) {
      const a = i * fila + j;
      const b = a + fila;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Tapa de arriba: un disco con el color de la punta de la foto.
function geometriaTapa(THREE, perfil, alto) {
  const r = perfil[perfil.length - 1] * alto;
  const g = new THREE.CircleGeometry(Math.max(r, 0.01), 24);
  g.rotateX(-Math.PI / 2);
  g.translate(0, alto, 0);
  const uv = g.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, 0.5, 0.985);
  return g;
}

function crearBotella(THREE, clave, datos, textura) {
  const conf = BOTELLAS[clave];
  const alto = ALTO_BASE * conf.alto;
  const { perfil, aspecto } = datos;

  const raiz = new THREE.Group(); // posición en la fila y entrada
  const giro = new THREE.Group(); // giro continuo, flotación y hover
  raiz.add(giro);

  // La foto ya trae su luz; el brillo propio la mantiene fiel y la
  // luz del entorno le suma volumen al girar.
  const material = new THREE.MeshStandardMaterial({
    map: textura,
    emissiveMap: textura,
    emissive: 0xffffff,
    emissiveIntensity: 0.62,
    roughness: 0.4,
    metalness: 0,
    transparent: true,
    alphaTest: 0.02,
    side: THREE.DoubleSide,
  });
  const geo = geometriaMitad(THREE, perfil, aspecto, alto);
  const frente = new THREE.Mesh(geo, material);
  const dorso = new THREE.Mesh(geo, material);
  dorso.rotation.y = Math.PI;
  const tapa = new THREE.Mesh(geometriaTapa(THREE, perfil, alto), material);
  giro.add(frente, dorso, tapa);

  // Capa de reflejos: suma las líneas de luz del estudio sobre el vidrio.
  const puntos = perfil.map((r, i) => new THREE.Vector2(r * alto * 1.004, (i / (perfil.length - 1)) * alto));
  const reflejo = new THREE.Mesh(
    new THREE.LatheGeometry(puntos, 48),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 1,
      roughness: 0.06,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  reflejo.renderOrder = 10;
  giro.add(reflejo);

  const radio = Math.max(...perfil) * alto;
  const zona = new THREE.Mesh(new THREE.CylinderGeometry(radio * 1.1, radio * 1.1, alto, 12), new THREE.MeshBasicMaterial({ visible: false }));
  zona.position.y = alto / 2;
  zona.userData.clave = clave;
  raiz.add(zona);

  return { clave, pagina: conf.pagina, raiz, giro, frente, dorso, zona, alto, radio, angulo: 0, extra: 0, vel: 0, fase: Math.random() * Math.PI * 2 };
}

// Sombra suave debajo de cada botella.
function texturaSombra(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Entorno de estudio para los reflejos: fondo oscuro con dos
// paneles de luz verticales (dan las líneas de brillo en el vidrio).
function crearEntorno(THREE, renderer) {
  const escena = new THREE.Scene();
  escena.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x0b0e13, side: THREE.BackSide })));
  const panel = (w, h, color, intensidad, x, y, z) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensidad), side: THREE.DoubleSide })
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    escena.add(m);
  };
  panel(2, 14, '#ffffff', 5, -7, 0, 5);
  panel(1.2, 14, '#bcd9ff', 3.2, 7, 0, 3);
  panel(9, 3, '#ffffff', 1.4, 0, 8, 0);
  panel(12, 12, '#1b2c44', 1, 0, 0, -10);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(escena, 0.03).texture;
  pmrem.dispose();
  return tex;
}

// ---------- Ubicación en la portada ----------
// En celulares van en una tira debajo de los botones (el lugar lo
// reserva styles.css). En pantallas más anchas buscan el espacio
// libre a la derecha del texto: todo el alto si entra, si no solo al
// costado del título.
const MEDIA_TIRA = '(max-width: 640px)';

function medirTexto(el) {
  const r = document.createRange();
  r.selectNodeContents(el);
  return r.getBoundingClientRect();
}

function filaPara(ancho) {
  if (ancho >= 640) return FILA_6;
  if (ancho >= 300) return FILA_5;
  return FILA_3;
}

function calcularZona(hero, contenedor) {
  if (window.matchMedia(MEDIA_TIRA).matches) {
    const w = contenedor.clientWidth;
    return { tira: true, width: w, height: contenedor.clientHeight, fila: filaPara(w) };
  }

  const hr = hero.getBoundingClientRect();
  const padDer = parseFloat(getComputedStyle(hero).paddingRight) || 0;
  const tag = hero.querySelector('.hero-tag');
  const h1 = hero.querySelector('h1');
  const sub = hero.querySelector('.hero-sub');
  const acciones = hero.querySelector('.hero-actions');
  if (!h1) return null;

  const derTitulo = Math.max(...[...h1.querySelectorAll('span')].map((s) => medirTexto(s).right));
  const derBotones = acciones ? Math.max(...[...acciones.children].map((b) => b.getBoundingClientRect().right)) : 0;
  const derTexto = Math.max(derTitulo, sub ? medirTexto(sub).right : 0, derBotones, tag ? tag.getBoundingClientRect().right : 0);
  const derecha = hr.width - padDer;

  const izqAncha = derTexto - hr.left + 32;
  if (derecha - izqAncha >= 260) {
    const arriba = (tag || h1).getBoundingClientRect().top - hr.top;
    const abajo = (acciones || sub || h1).getBoundingClientRect().bottom - hr.top;
    const ancho = derecha - izqAncha;
    return { left: izqAncha, top: arriba, width: ancho, height: abajo - arriba, fila: filaPara(ancho) };
  }

  const h1r = h1.getBoundingClientRect();
  const izqAngosta = derTitulo - hr.left + 12;
  if (derecha - izqAngosta < 110) return null;
  return { left: izqAngosta, top: h1r.top - hr.top - 8, width: derecha - izqAngosta, height: h1r.height + 16, fila: FILA_3 };
}

// ---------- Escena ----------
async function iniciar() {
  const hero = document.querySelector('.hero');
  const contenedor = document.getElementById('heroBotellas');
  if (!hero || !contenedor) return;
  // Si no se pueden mostrar, se saca el lugar reservado en celulares.
  if (!hayWebGL()) return contenedor.remove();

  let THREE, gsap, perfiles;
  try {
    const [t, g, p] = await Promise.all([import(THREE_URL), import(GSAP_URL), fetch('botellas/perfiles.json').then((r) => r.json())]);
    THREE = t;
    gsap = g.gsap || g.default;
    perfiles = p;
  } catch (err) {
    console.warn('No se pudieron cargar las botellas 3D:', err);
    return contenedor.remove();
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) {
    return contenedor.remove();
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;

  const claves = FILA_6.filter((c) => perfiles[c]);
  const cargador = new THREE.TextureLoader();
  let texturas;
  try {
    texturas = await Promise.all(claves.map((c) => cargador.loadAsync(`botellas/${c}.webp`)));
  } catch (err) {
    console.warn('No se pudieron cargar las fotos de las botellas:', err);
    return contenedor.remove();
  }
  texturas.forEach((tx) => {
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = renderer.capabilities.getMaxAnisotropy();
  });
  contenedor.appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  escena.environment = crearEntorno(THREE, renderer);
  const luz = new THREE.DirectionalLight(0xffffff, 0.6);
  luz.position.set(-3, 5, 6);
  escena.add(luz);

  const camara = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  const fila = new THREE.Group();
  escena.add(fila);

  const texSombra = texturaSombra(THREE);
  const botellas = claves.map((clave, i) => {
    const b = crearBotella(THREE, clave, perfiles[clave], texturas[i]);
    b.sombra = new THREE.Mesh(
      new THREE.PlaneGeometry(b.radio * 3.4, b.radio * 3.4),
      new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false, opacity: 0 })
    );
    b.sombra.rotation.x = -Math.PI / 2;
    b.sombra.position.y = 0.005;
    b.sombra.renderOrder = -1;
    fila.add(b.raiz, b.sombra);
    return b;
  });
  const porClave = Object.fromEntries(botellas.map((b) => [b.clave, b]));

  // Acomoda la fila visible y encuadra la cámara.
  let filaActual = null;
  let anchoFila = 0;
  let altoFila = 0;
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

    if (filaActual !== z.fila) {
      filaActual = z.fila;
      const visibles = z.fila.map((c) => porClave[c]).filter(Boolean);
      botellas.forEach((b) => (b.raiz.visible = b.sombra.visible = visibles.includes(b)));
      // Una al lado de la otra según su ancho real, centradas; la del
      // medio un poco más adelante.
      anchoFila = visibles.reduce((s, b) => s + b.radio * 2, 0) + SEPARACION * (visibles.length - 1);
      altoFila = Math.max(...visibles.map((b) => b.alto));
      let x = -anchoFila / 2;
      visibles.forEach((b, i) => {
        x += b.radio;
        const zPos = 0.3 - Math.abs(i - (visibles.length - 1) / 2) * 0.22;
        b.raiz.position.x = b.sombra.position.x = x;
        b.raiz.position.z = b.sombra.position.z = zPos;
        x += b.radio + SEPARACION;
      });
    }

    // Encuadre: que entren todas a lo ancho y a lo alto.
    const aspecto = z.width / z.height;
    const tan = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
    const dist = Math.max((altoFila + 0.4) / (2 * tan), (anchoFila + 0.5) / (2 * tan * aspecto)) + 0.6;
    camara.aspect = aspecto;
    camara.position.set(0, altoFila * 0.6, dist);
    camara.lookAt(0, altoFila * 0.47, 0);
    camara.updateProjectionMatrix();
    dibujar();
  }

  function dibujar() {
    botellas.forEach((b) => {
      const a = b.angulo + b.extra;
      b.giro.rotation.y = a;
      // La mitad que mira a la cámara se dibuja última, así el vidrio
      // transparente deja ver la de atrás.
      const frenteAdelante =
        Math.sin(a) * (camara.position.x - b.raiz.position.x) + Math.cos(a) * (camara.position.z - b.raiz.position.z) >= 0;
      b.frente.renderOrder = frenteAdelante ? 2 : 1;
      b.dorso.renderOrder = frenteAdelante ? 1 : 2;
    });
    renderer.render(escena, camara);
  }

  // Mouse: hover acelera el giro y agranda; click lleva a la categoría.
  const raycaster = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  let enHover = null;
  const lienzo = renderer.domElement;
  function botellaBajo(ev) {
    const r = lienzo.getBoundingClientRect();
    puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(puntero, camara);
    const zonas = botellas.filter((b) => b.raiz.visible).map((b) => b.zona);
    const hit = raycaster.intersectObjects(zonas, false)[0];
    return hit ? porClave[hit.object.userData.clave] : null;
  }

  const mm = gsap.matchMedia();
  mm.add({ reducir: '(prefers-reduced-motion: reduce)', normal: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
    const { reducir } = ctx.conditions;
    acomodar();

    if (reducir) {
      // Sin movimiento: quedan quietas de frente.
      botellas.forEach((b) => {
        b.angulo = 0;
        b.extra = 0;
        b.vel = 0;
        b.sombra.material.opacity = 1;
      });
      gsap.set(contenedor, { autoAlpha: 1 });
      dibujar();
      return;
    }

    botellas.forEach((b, i) => {
      b.angulo = 0;
      b.vel = 0.4 + (i % 3) * 0.05;
    });

    // Entrada: suben desde abajo, de a una, frenando el giro al llegar.
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to(contenedor, { autoAlpha: 1, duration: 0.4 })
      .fromTo(botellas.map((b) => b.raiz.position), { y: -4.5 }, { y: 0, duration: 1.3, stagger: 0.1 }, 0)
      .fromTo(botellas, { extra: -Math.PI * 1.5 }, { extra: 0, duration: 1.6, stagger: 0.1 }, 0)
      .fromTo(botellas.map((b) => b.sombra.material), { opacity: 0 }, { opacity: 1, duration: 0.8, stagger: 0.1 }, 0.5);

    let t = 0;
    const tick = (_time, deltaMs) => {
      const dt = Math.min(deltaMs, 50) / 1000;
      t += dt;
      botellas.forEach((b) => {
        b.angulo += b.vel * dt;
        b.giro.position.y = Math.sin(t * 1.3 + b.fase) * 0.045;
      });
      dibujar();
    };

    // Solo dibuja mientras la portada está a la vista.
    let activo = false;
    const prender = (si) => {
      if (si === activo) return;
      activo = si;
      if (si) gsap.ticker.add(tick);
      else gsap.ticker.remove(tick);
    };
    const io = new IntersectionObserver(([en]) => prender(en.isIntersecting));
    io.observe(hero);

    const alMover = (ev) => {
      const b = botellaBajo(ev);
      if (b === enHover) return;
      if (enHover) {
        gsap.to(enHover, { vel: 0.42, duration: 0.8, overwrite: 'auto' });
        gsap.to(enHover.giro.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
      }
      enHover = b;
      lienzo.style.cursor = b ? 'pointer' : '';
      if (b) {
        gsap.to(b, { vel: 2.4, duration: 0.5, overwrite: 'auto' });
        gsap.to(b.giro.scale, { x: 1.07, y: 1.07, z: 1.07, duration: 0.45, ease: 'back.out(2)', overwrite: 'auto' });
      }
    };
    const alSalir = () => alMover({ clientX: -9999, clientY: -9999 });
    lienzo.addEventListener('pointermove', alMover);
    lienzo.addEventListener('pointerleave', alSalir);

    return () => {
      io.disconnect();
      prender(false);
      lienzo.removeEventListener('pointermove', alMover);
      lienzo.removeEventListener('pointerleave', alSalir);
    };
  });

  lienzo.addEventListener('click', (ev) => {
    const b = botellaBajo(ev);
    if (b) window.location.href = b.pagina;
  });

  // Reacomoda si cambia el tamaño de la portada (girar el celular,
  // achicar la ventana, o cuando termina de cargar la tipografía).
  new ResizeObserver(() => acomodar()).observe(hero);
}

cuandoEsteLibre(iniciar);
