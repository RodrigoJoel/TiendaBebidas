// ============================================================
//  Sucursales de Andreani — para el retiro en sucursal.
//  Andreani publica la lista completa, sin clave, en
//  apis.andreani.com/v2/sucursales. Se guarda en memoria unas horas.
//  La lista mezcla varios sistemas internos de Andreani (plantas,
//  depósitos, etc.): al cliente se le ofrecen solo las sucursales
//  del canal B2C que atienden al público y entregan envíos.
// ============================================================
const URL_SUCURSALES = 'https://apis.andreani.com/v2/sucursales';
const DURACION_CACHE = 6 * 60 * 60 * 1000;
const TIPOS_PARA_RETIRO = ['SUCURSAL', 'CENTRO DE DISTRIBUCION'];

let cache = null; // { cuando, lista }

async function listaDeAndreani() {
  if (cache && Date.now() - cache.cuando < DURACION_CACHE) return cache.lista;
  try {
    const resp = await fetch(URL_SUCURSALES, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    });
    if (!resp.ok) throw new Error(`Andreani respondió ${resp.status}`);
    const lista = await resp.json();
    if (!Array.isArray(lista) || !lista.length) throw new Error('Andreani devolvió la lista vacía');
    cache = { cuando: Date.now(), lista };
    return lista;
  } catch (err) {
    // Si Andreani no responde, sirve la última lista que se trajo.
    if (cache) return cache.lista;
    throw err;
  }
}

function sinAcentos(t) {
  return String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Andreani escribe CABA de varias formas.
function claveProvincia(p) {
  const t = sinAcentos(p);
  return ['caba', 'capital federal', 'ciudad autonoma de buenos aires'].includes(t) ? 'caba' : t;
}

// "NEUQUEN INTEGRAL" → "Neuquen Integral"
function tipoTitulo(t) {
  return String(t ?? '').trim().toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
}

function numeroCP(cp) {
  return (String(cp ?? '').match(/\d{4}/) || [])[0] || null;
}

function coordenadas(s) {
  const lat = Number(s.coordenadas?.latitud);
  const lon = Number(s.coordenadas?.longitud);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat && lon ? { lat, lon } : null;
}

function distanciaKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function mediana(numeros) {
  const orden = [...numeros].sort((a, b) => a - b);
  return orden[Math.floor(orden.length / 2)];
}

function esParaRetiro(s) {
  const d = s.datosAdicionales || {};
  return s.canal === 'B2C' && d.seHaceAtencionAlCliente && d.entregaEnvios
    && TIPOS_PARA_RETIRO.includes(d.tipo) && !/no usar/i.test(s.descripcion) && coordenadas(s);
}

// Dónde queda el cliente, aproximado. Primero, con las oficinas de
// Andreani (de cualquier tipo) que están en su código postal o lo
// reparten. Si ninguna lo nombra, con la de su provincia que tenga el
// código postal más parecido.
function ubicarCliente(lista, cp, provincia) {
  const n = numeroCP(cp);
  if (!n) return null;
  const buscar = (cumple) => lista.filter((s) => coordenadas(s) && cumple(s)).map(coordenadas);
  let puntos = buscar((s) => s.direccion?.codigoPostal === n);
  if (!puntos.length) puntos = buscar((s) => (s.codigosPostalesAtendidos || []).includes(n));
  if (puntos.length) {
    return { lat: mediana(puntos.map((p) => p.lat)), lon: mediana(puntos.map((p) => p.lon)) };
  }

  const prov = claveProvincia(provincia);
  let mejor = null;
  for (const s of lista) {
    const cpSucursal = Number(s.direccion?.codigoPostal);
    if (!cpSucursal || !coordenadas(s) || claveProvincia(s.direccion?.provincia) !== prov) continue;
    const diferencia = Math.abs(cpSucursal - Number(n));
    if (!mejor || diferencia < mejor.diferencia) mejor = { diferencia, punto: coordenadas(s) };
  }
  return mejor ? mejor.punto : null;
}

// Algunas calles vienen en mayúsculas ("ALBERDI 488").
function sinMayusculas(t) {
  const limpio = String(t ?? '').trim().replace(/\s+/g, ' ');
  return limpio === limpio.toUpperCase() ? tipoTitulo(limpio) : limpio;
}

// Lo que se le muestra al cliente y se guarda en el pedido.
function resumen(s) {
  const dir = s.direccion || {};
  const numero = /^(0|s\/?n)?$/i.test(String(dir.numero ?? '').trim()) ? '' : String(dir.numero).trim();
  const caba = /^c\.?\s?a\.?\s?b\.?\s?a\.?$/i.test(String(dir.localidad ?? '').trim()) || claveProvincia(dir.provincia) === 'caba';
  return {
    id: s.id,
    nombre: tipoTitulo(s.descripcion),
    direccion: sinMayusculas([String(dir.calle ?? '').trim(), numero].filter(Boolean).join(' ')),
    localidad: caba ? 'CABA' : tipoTitulo(dir.localidad),
    provincia: caba ? 'CABA' : tipoTitulo(dir.provincia),
    cp: String(dir.codigoPostal ?? ''),
    horario: String(s.horarioDeAtencion ?? '').trim()
  };
}

// Las sucursales más cercanas al código postal del cliente.
async function sucursalesCercanas(cp, provincia, cantidad = 5) {
  const lista = await listaDeAndreani();
  const cliente = ubicarCliente(lista, cp, provincia);
  if (!cliente) return [];
  return lista
    .filter(esParaRetiro)
    .map((s) => ({ s, km: distanciaKm(cliente, coordenadas(s)) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, cantidad)
    .map(({ s, km }) => ({ ...resumen(s), km: Math.round(km) }));
}

// La sucursal con ese id, o null si no existe o no sirve para retirar.
async function buscarSucursal(id) {
  const lista = await listaDeAndreani();
  const s = lista.find((x) => x.id === Number(id));
  return s && esParaRetiro(s) ? resumen(s) : null;
}

module.exports = { sucursalesCercanas, buscarSucursal };
