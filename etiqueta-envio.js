/* ============================================================
   ETIQUETAS DE ENVÍO — Reserva Global Importados
   Desde el panel se imprime la etiqueta para pegar en la caja:
   destinatario, forma de entrega y remitente (la tienda). Va una
   etiqueta por caja, con las mismas cajas que se cobraron en el envío
   (envio.js). No lleva productos ni precios: la caja viaja sin anunciar
   lo que tiene adentro.
   Se abre en una pestaña nueva, lista para imprimir en hoja A4 y
   recortar (10 × 15 cm) o para guardar como PDF.
   Usa esc() y aFecha() de admin-script.js.
   ============================================================ */

// Datos de la tienda que salen como remitente.
const REMITENTE = {
  nombre: 'Reserva Global Importados',
  calle: 'Sarmiento',
  altura: '322',
  localidad: 'Resistencia',
  provincia: 'Chaco',
  cp: '3500'
};

const TEXTO_ENTREGA = {
  sucursal: 'Retiro en sucursal Andreani',
  domicilio: 'Entrega a domicilio'
};

// Capacidad de cada caja de cada bulto del pedido, p. ej. 8 botellas → [6, 2].
function bultosDe(p) {
  const botellas = (p.items || []).reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
  if (!window.Envio) return [botellas];
  return window.Envio.cajasPara(botellas).map(i => window.Envio.CAJAS[i]);
}

function htmlEtiqueta(p, capacidad, n, total) {
  const c = p.cliente || {};
  const fecha = aFecha(p.creadoEn);
  const logo = new URL('logo-emblema.webp', location.href).href;
  return `
    <section class="etiqueta">
      <header class="marca">
        <img src="${logo}" alt="" />
        <div>
          <strong>Reserva Global</strong>
          <span>Importados</span>
        </div>
        <div class="pedido">
          Pedido
          <b>${esc(p.numero)}</b>
          ${fecha ? fecha.toLocaleDateString('es-AR') : ''}
        </div>
      </header>

      <div class="bloque dest">
        <h2>Destinatario</h2>
        <p class="nombre">${esc(c.nombre)}</p>
        <p class="dir">${esc(c.direccion)}${c.piso ? `, ${esc(c.piso)}` : ''}</p>
        <p class="loc">${esc(c.ciudad)}, ${esc(c.provincia)}</p>
        <p class="cp"><small>CP</small> ${esc(c.cp)}</p>
        <p class="datos">DNI ${esc(c.dni)} · Cel. ${esc(c.celular)}</p>
      </div>

      <div class="entrega">${esc(TEXTO_ENTREGA[c.entrega] || 'Envío por Andreani')}</div>
      ${c.entrega === 'sucursal' ? `<p class="sucursal">${c.sucursal
        ? `<b>${esc(c.sucursal.nombre)}</b> · ${esc(c.sucursal.direccion)}, ${esc(c.sucursal.localidad)} (${esc(c.sucursal.provincia)})`
        : 'Sucursal a coordinar con el cliente'}</p>` : ''}

      <div class="bloque rem">
        <h2>Remitente</h2>
        <p><b>${esc(REMITENTE.nombre)}</b></p>
        <p>${esc(REMITENTE.calle)} ${esc(REMITENTE.altura)}</p>
        <p>CP ${esc(REMITENTE.cp)} · ${esc(REMITENTE.localidad)}, ${esc(REMITENTE.provincia)}</p>
      </div>

      <footer class="pie">
        <div class="fragil">
          <b>Frágil · Vidrio</b>
          <span>↑ Este lado arriba ↑</span>
        </div>
        <div class="bulto">
          <b>Bulto ${n} de ${total}</b>
          <span>${capacidad === 1 ? '1 botella' : `${capacidad} botellas`}</span>
        </div>
      </footer>
    </section>`;
}

const ESTILO_ETIQUETA = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', Arial, sans-serif; color: #000; background: #e9e9e9;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .barra { display: flex; gap: 12px; align-items: center; justify-content: center; flex-wrap: wrap;
           padding: 14px 16px; background: #fff; border-bottom: 1px solid #ccc; font-size: 14px; }
  .barra button { font: 600 15px 'DM Sans', Arial, sans-serif; padding: 10px 22px; border: 0;
                  border-radius: 6px; background: #000; color: #fff; cursor: pointer; }
  .hojas { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 16px; }
  .etiqueta { width: 100mm; height: 150mm; background: #fff; border: 0.4mm dashed #777;
              padding: 5mm; display: flex; flex-direction: column; gap: 3.5mm; overflow: hidden; }
  .marca { display: flex; align-items: center; gap: 3mm; padding-bottom: 3mm; border-bottom: 0.7mm solid #000; }
  .marca img { width: 14mm; height: 14mm; object-fit: contain; }
  .marca strong { display: block; font: 17pt/1 'Anton', Impact, sans-serif; letter-spacing: 0.3pt; }
  .marca span { font-size: 8.5pt; letter-spacing: 2.5pt; }
  .pedido { margin-left: auto; text-align: right; font-size: 7.5pt; line-height: 1.3; }
  .pedido b { display: block; font: 11pt/1.2 'Anton', Impact, sans-serif; letter-spacing: 0.3pt; }
  .bloque h2 { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.4pt; margin-bottom: 1mm; color: #333; }
  .dest .nombre { font: 19pt/1.05 'Anton', Impact, sans-serif; letter-spacing: 0.2pt; margin-bottom: 1.5mm; }
  .dest .dir { font-size: 12.5pt; font-weight: 700; line-height: 1.25; }
  .dest .loc { font-size: 12.5pt; line-height: 1.25; }
  .dest .cp { font: 26pt/1.1 'Anton', Impact, sans-serif; margin-top: 1mm; }
  .dest .cp small { font-size: 12pt; }
  .dest .datos { font-size: 9.5pt; margin-top: 1mm; }
  .entrega { background: #000; color: #fff; text-align: center; padding: 2.2mm 2mm;
             font: 14pt/1.1 'Anton', Impact, sans-serif; letter-spacing: 0.4pt; }
  .sucursal { font-size: 9.5pt; line-height: 1.3; margin-top: -1.5mm; text-align: center; }
  .rem { font-size: 9pt; line-height: 1.35; }
  .pie { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end;
         padding-top: 2.5mm; border-top: 0.7mm solid #000; }
  .pie b { display: block; font: 14pt/1.1 'Anton', Impact, sans-serif; letter-spacing: 0.3pt; }
  .pie span { font-size: 8.5pt; }
  .bulto { text-align: right; }
  @media print {
    body { background: none; }
    .barra { display: none; }
    .hojas { display: block; padding: 0; }
    .etiqueta { break-after: page; }
    .etiqueta:last-child { break-after: auto; }
  }`;

// Abre una pestaña con las etiquetas de los pedidos indicados y abre
// el diálogo de impresión.
function imprimirEtiquetas(numeros) {
  const pedidos = (window.DATA.pedidos || []).filter(p => numeros.includes(p.numero));
  if (!pedidos.length) return;
  const etiquetas = pedidos.flatMap(p => {
    const bultos = bultosDe(p);
    return bultos.map((capacidad, i) => htmlEtiqueta(p, capacidad, i + 1, bultos.length));
  });

  const ventana = window.open('', '_blank');
  if (!ventana) {
    showToast('❌ El navegador bloqueó la pestaña de la etiqueta. Permití las ventanas emergentes para este sitio.', 'err');
    return;
  }
  const titulo = pedidos.length === 1 ? `Etiqueta ${pedidos[0].numero}` : `Etiquetas de ${pedidos.length} pedidos`;
  ventana.document.open();
  ventana.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(titulo)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=DM+Sans:wght@400;700&display=swap" rel="stylesheet">
  <style>${ESTILO_ETIQUETA}</style>
</head>
<body>
  <div class="barra">
    <span>${etiquetas.length === 1 ? '1 etiqueta' : `${etiquetas.length} etiquetas`} · hoja A4, recortá por la línea punteada</span>
    <button type="button" onclick="print()">🖨 Imprimir</button>
  </div>
  <main class="hojas">${etiquetas.join('')}</main>
  <script>
    addEventListener('load', () => {
      const listo = document.fonts ? document.fonts.ready : Promise.resolve();
      listo.then(() => setTimeout(print, 150));
    });
  </script>
</body>
</html>`);
  ventana.document.close();
}
window.imprimirEtiquetas = imprimirEtiquetas;
