// ============================================================
//  BOTELLAS 3D DE LA PORTADA — GLOBAL IMPORTADOS
//  Una ronda giratoria con una botella real por sección (12), como
//  un exhibidor. Debajo se lee la sección de la botella que está al
//  frente; tocar una botella (o ese nombre) lleva a su sección.
//  Se puede girar arrastrando con el dedo o el mouse.
//  Cada botella es la foto del producto (recortada, en /botellas/)
//  envuelta sobre un volumen con la silueta de esa misma botella
//  (botellas/perfiles.json). De frente se ve igual que la foto; atrás
//  repite el frente.
//  Three.js dibuja; GSAP anima la entrada, el giro y el hover.
//  Las librerías se piden recién cuando la página terminó de cargar,
//  así no demoran lo demás. Sin WebGL, la portada queda como siempre.
// ============================================================

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.186.1/+esm';
const GSAP_URL = 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/+esm';

// En el mismo orden que el menú de categorías. "alto" es el tamaño
// relativo real (las fotos vienen todas del mismo alto). Combos arma
// un conjunto: una botella en el medio y una lata a cada lado.
const SECCIONES = [
  { clave: 'whisky', nombre: 'Whisky', pagina: 'whisky.html', alto: 0.86 },
  { clave: 'ron', nombre: 'Ron', pagina: 'ron.html', alto: 0.9 },
  { clave: 'vodka', nombre: 'Vodka', pagina: 'vodka.html', alto: 1 },
  { clave: 'tequila', nombre: 'Tequila', pagina: 'tequila.html', alto: 1.02 },
  { clave: 'gin', nombre: 'Gin', pagina: 'gin.html', alto: 0.84 },
  { clave: 'licores', nombre: 'Licores', pagina: 'licores.html', alto: 0.76 },
  { clave: 'aguardiente', nombre: 'Aguardiente', pagina: 'aguardiente.html', alto: 0.62 },
  { clave: 'espumante', nombre: 'Espumante', pagina: 'espumante.html', alto: 0.93 },
  { clave: 'cerveza', nombre: 'Cerveza', pagina: 'cerveza.html', alto: 0.7 },
  { clave: 'vino', nombre: 'Vino', pagina: 'vino.html', alto: 0.95 },
  { clave: 'energizante', nombre: 'Energizante', pagina: 'energizante.html', alto: 0.5 },
  { clave: 'combos', nombre: 'Combos', pagina: 'combos.html', alto: 1, combo: { centro: 'greygoose', costados: 'monster', altoCostados: 0.52 } },
];

// Fotos que usa cada sección (en /botellas/).
const fotosDe = (s) => (s.combo ? [s.combo.centro, s.combo.costados] : [s.clave]);
const ALTO_BASE = 3.2; // alto en unidades 3D de una botella de alto 1
const HUECO = 0.55; // espacio entre botellas en la ronda
const VEL_RUEDA = 0.22; // radianes por segundo (una vuelta cada ~28 s)
const ELEVACION = 0.3; // la cámara mira la ronda un poco desde arriba
const PUNTOS_PERFIL = 64;
const ESCALA_FRENTE = 0.22; // la botella del frente se ve un 22% más grande
// Versión alternativa guardada (apagada): dos filas de seis botellas,
// cada una girando sobre su eje, en vez de la ronda. Para usarla,
// cambiar a true.
const GRILLA = false;

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

// El perfil viene con más puntos de los necesarios; se achica para
// que doce botellas anden livianas en el celular.
function remuestrear(perfil, n) {
  return Array.from({ length: n }, (_, i) => {
    const x = (i / (n - 1)) * (perfil.length - 1);
    const a = Math.floor(x);
    const b = Math.min(a + 1, perfil.length - 1);
    return perfil[a] + (perfil[b] - perfil[a]) * (x - a);
  });
}

// ---------- Volumen de la botella ----------
// Media botella (de -90° a 90°) con la foto proyectada de frente: cada
// punto toma el píxel que la cámara de la foto veía ahí. Se usa dos
// veces (la segunda girada 180°) para cerrar la botella.
function geometriaMitad(THREE, perfil, aspecto, alto) {
  const n = perfil.length;
  const lados = 28;
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
  const g = new THREE.CircleGeometry(Math.max(r, 0.01), 20);
  g.rotateX(-Math.PI / 2);
  g.translate(0, alto, 0);
  const uv = g.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, 0.5, 0.985);
  return g;
}

// Una pieza (botella o lata): la foto envuelta sobre su silueta, con
// su capa de reflejos.
function crearPieza(THREE, datos, textura, alto) {
  const perfil = remuestrear(datos.perfil, PUNTOS_PERFIL);
  const grupo = new THREE.Group();

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
  const geo = geometriaMitad(THREE, perfil, datos.aspecto, alto);
  const frente = new THREE.Mesh(geo, material);
  const dorso = new THREE.Mesh(geo, material);
  dorso.rotation.y = Math.PI;
  const tapa = new THREE.Mesh(geometriaTapa(THREE, perfil, alto), material);
  grupo.add(frente, dorso, tapa);

  // Capa de reflejos: suma las líneas de luz del estudio sobre el vidrio.
  const puntos = perfil.map((r, i) => new THREE.Vector2(r * alto * 1.004, (i / (perfil.length - 1)) * alto));
  const reflejo = new THREE.Mesh(
    new THREE.LatheGeometry(puntos, 32),
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
  grupo.add(reflejo);

  return { grupo, material, frente, dorso, tapa, reflejo, radio: Math.max(...perfil) * alto };
}

// Lo que representa a una sección: una botella, o en Combos la
// botella del medio con una lata a cada lado, un poco adelantadas.
function crearBotella(THREE, seccion, perfiles, texturas, texSombra) {
  const alto = ALTO_BASE * seccion.alto;
  const raiz = new THREE.Group(); // lugar en la ronda y entrada
  const giro = new THREE.Group(); // giro propio y hover
  raiz.add(giro);

  let piezas;
  let radio;
  if (seccion.combo) {
    const { centro, costados, altoCostados } = seccion.combo;
    const principal = crearPieza(THREE, perfiles[centro], texturas[centro], alto);
    const latas = [-1, 1].map((lado) => {
      const lata = crearPieza(THREE, perfiles[costados], texturas[costados], ALTO_BASE * altoCostados);
      lata.grupo.position.set(lado * (principal.radio + lata.radio + 0.04), 0, principal.radio * 0.35);
      return lata;
    });
    piezas = [principal, ...latas];
    radio = principal.radio + latas[0].radio * 2 + 0.04;
  } else {
    piezas = [crearPieza(THREE, perfiles[seccion.clave], texturas[seccion.clave], alto)];
    radio = piezas[0].radio;
  }
  piezas.forEach((p) => giro.add(p.grupo));

  const zona = new THREE.Mesh(new THREE.CylinderGeometry(radio * 1.1, radio * 1.1, alto, 10), new THREE.MeshBasicMaterial({ visible: false }));
  zona.position.y = alto / 2;
  zona.userData.clave = seccion.clave;
  raiz.add(zona);

  const sombra = new THREE.Mesh(
    new THREE.PlaneGeometry(radio * 3.4, radio * 3.4),
    new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false, opacity: 0 })
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.005;

  return { ...seccion, raiz, giro, piezas, zona, sombra, alto, radio, angulo: 0, extra: 0, xw: 0, zw: 0 };
}

// Sombra suave debajo de cada botella.
function texturaSombra(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
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
// En celulares van en una franja debajo de los botones (el lugar lo
// reserva styles.css). En pantallas más anchas buscan el espacio
// libre a la derecha del texto: todo el alto si entra, si no solo al
// costado del título.
const MEDIA_TIRA = '(max-width: 640px)';

function medirTexto(el) {
  const r = document.createRange();
  r.selectNodeContents(el);
  return r.getBoundingClientRect();
}

function calcularZona(hero, contenedor) {
  if (window.matchMedia(MEDIA_TIRA).matches) {
    return { tira: true, width: contenedor.clientWidth, height: contenedor.clientHeight };
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
    return { left: izqAncha, top: arriba, width: derecha - izqAncha, height: abajo - arriba };
  }

  const h1r = h1.getBoundingClientRect();
  const izqAngosta = derTitulo - hr.left + 12;
  if (derecha - izqAngosta < 140) return null;
  return { left: izqAngosta, top: h1r.top - hr.top - 8, width: derecha - izqAngosta, height: h1r.height + 40 };
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

  const secciones = SECCIONES.filter((s) => fotosDe(s).every((f) => perfiles[f]));
  const fotos = [...new Set(secciones.flatMap(fotosDe))];
  const cargador = new THREE.TextureLoader();
  const texturas = {};
  try {
    const cargadas = await Promise.all(fotos.map((f) => cargador.loadAsync(`botellas/${f}.webp`)));
    fotos.forEach((f, i) => (texturas[f] = cargadas[i]));
  } catch (err) {
    console.warn('No se pudieron cargar las fotos de las botellas:', err);
    return contenedor.remove();
  }
  Object.values(texturas).forEach((tx) => {
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  });

  const lienzo = renderer.domElement;
  contenedor.appendChild(lienzo);
  // Nombre de la sección que está al frente: es un link de verdad.
  const nombre = document.createElement('a');
  nombre.className = 'hero-botellas-nombre';
  contenedor.appendChild(nombre);

  const escena = new THREE.Scene();
  escena.environment = crearEntorno(THREE, renderer);
  const luz = new THREE.DirectionalLight(0xffffff, 0.6);
  luz.position.set(-3, 5, 6);
  escena.add(luz);

  const camara = new THREE.PerspectiveCamera(26, 1, 0.1, 200);
  const rueda = new THREE.Group();
  escena.add(rueda);

  // Arma la ronda: cada botella ocupa en la circunferencia lo que mide
  // de ancho, mirando hacia afuera.
  const texSombra = texturaSombra(THREE);
  const botellas = secciones.map((s) => crearBotella(THREE, s, perfiles, texturas, texSombra));
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
    // Orden de dibujo de atrás hacia adelante; en cada botella, la
    // mitad que mira a la cámara va última para que el vidrio
    // transparente deje ver lo que hay detrás.
    const orden = [...botellas].sort((p, q) => p.zw - q.zw);
    orden.forEach((b, k) => {
      const a = b.angulo + estado.angulo + b.extra;
      const frenteAdelante = Math.sin(a) * (camara.position.x - b.xw) + Math.cos(a) * (camara.position.z - b.zw) >= 0;
      b.piezas.forEach((p) => {
        p.frente.renderOrder = k * 4 + (frenteAdelante ? 2 : 1);
        p.dorso.renderOrder = k * 4 + (frenteAdelante ? 1 : 2);
        p.tapa.renderOrder = k * 4 + 2;
        p.reflejo.renderOrder = k * 4 + 3;
      });
    });
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
