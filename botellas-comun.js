// ============================================================
//  BOTELLAS 3D — PARTE COMÚN — GLOBAL IMPORTADOS
//  Lo que comparten la ronda de la portada (botellas-3d.js) y la
//  botella de cada categoría (botella-categoria.js): qué botella va en
//  cada sección, cómo se arma cada una y la escena donde se dibujan.
//  Cada botella es la foto del producto (recortada, en /botellas/)
//  envuelta sobre un volumen con la silueta de esa misma botella
//  (botellas/perfiles.json). De frente se ve igual que la foto; atrás
//  repite el frente.
// ============================================================

export const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.186.1/+esm';
export const GSAP_URL = 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/+esm';

// En el mismo orden que el menú de categorías. "alto" es el tamaño
// relativo real (las fotos vienen todas del mismo alto). Combos arma
// un conjunto: una botella en el medio y una lata a cada lado.
export const SECCIONES = [
  { clave: 'whisky', nombre: 'Whisky', pagina: 'whisky.html', alto: 0.9 },
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
export const fotosDe = (s) => (s.combo ? [s.combo.centro, s.combo.costados] : [s.clave]);
export const ALTO_BASE = 3.2; // alto en unidades 3D de una botella de alto 1
const PUNTOS_PERFIL = 64;

// ---------- Carga diferida ----------
export function cuandoEsteLibre(fn) {
  const correr = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 300));
  if (document.readyState === 'complete') correr();
  else window.addEventListener('load', correr, { once: true });
}

export function hayWebGL() {
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
export function crearBotella(THREE, seccion, perfiles, texturas, texSombra) {
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
export function texturaSombra(THREE) {
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

// Mide el texto de un elemento (no su caja, que puede ser más ancha).
export function medirTexto(el) {
  const r = document.createRange();
  r.selectNodeContents(el);
  return r.getBoundingClientRect();
}

// Carga Three.js, GSAP, las siluetas y las fotos de las secciones
// pedidas, y arma el renderer y la escena con su luz. Si algo falla,
// tira un error y quien llama deja la página como estaba.
export async function prepararEscena(claves) {
  if (!hayWebGL()) throw new Error('Sin WebGL');
  const [t, g, perfiles] = await Promise.all([import(THREE_URL), import(GSAP_URL), fetch('botellas/perfiles.json').then((r) => r.json())]);
  const THREE = t;
  const gsap = g.gsap || g.default;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;

  const secciones = SECCIONES.filter((s) => claves.includes(s.clave) && fotosDe(s).every((f) => perfiles[f]));
  const fotos = [...new Set(secciones.flatMap(fotosDe))];
  const cargador = new THREE.TextureLoader();
  const cargadas = await Promise.all(fotos.map((f) => cargador.loadAsync(`botellas/${f}.webp`)));
  const texturas = {};
  fotos.forEach((f, i) => {
    const tx = cargadas[i];
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    texturas[f] = tx;
  });

  const escena = new THREE.Scene();
  escena.environment = crearEntorno(THREE, renderer);
  const luz = new THREE.DirectionalLight(0xffffff, 0.6);
  luz.position.set(-3, 5, 6);
  escena.add(luz);

  const texSombra = texturaSombra(THREE);
  const botellas = secciones.map((s) => crearBotella(THREE, s, perfiles, texturas, texSombra));
  return { THREE, gsap, renderer, escena, botellas };
}

// Orden de dibujo de una botella (k = su lugar de atrás hacia
// adelante): la mitad que mira a la cámara va última, así el vidrio
// transparente deja ver lo que hay detrás. "a" es hacia dónde mira.
export function ordenarMitades(b, k, a, camara) {
  const frenteAdelante = Math.sin(a) * (camara.position.x - b.xw) + Math.cos(a) * (camara.position.z - b.zw) >= 0;
  b.piezas.forEach((p) => {
    p.frente.renderOrder = k * 4 + (frenteAdelante ? 2 : 1);
    p.dorso.renderOrder = k * 4 + (frenteAdelante ? 1 : 2);
    p.tapa.renderOrder = k * 4 + 2;
    p.reflejo.renderOrder = k * 4 + 3;
  });
}
