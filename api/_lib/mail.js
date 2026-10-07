// ============================================================
//  Mails de pedidos (SMTP, por defecto una cuenta de Gmail con
//  "contraseña de aplicación"). Solo se mandan desde el servidor,
//  con datos del pedido ya guardado: el navegador no puede elegir
//  destinatario ni contenido.
//
//  Variables: SMTP_USER y SMTP_PASS (obligatorias), SMTP_HOST y
//  SMTP_PORT (opcionales, por defecto Gmail). Salen a nombre de
//  "Reserva Global Importados" desde la casilla de SMTP_USER.
// ============================================================
const nodemailer = require('nodemailer');
const { HORAS_PARA_TRANSFERIR } = require('./pedidos');

const NOMBRE_REMITENTE = 'Reserva Global Importados';
// A quién le llega el aviso de cada pedido nuevo (el admin de la tienda).
const AVISO_PEDIDOS_DEFAULT = 'rodrigoatatat@gmail.com';

const WHATSAPP_NUMERO = '5492995000000';
const DATOS_TRANSFERENCIA = [
  ['Titular', 'Rodrigo Joel Nuñez'],
  ['CUIT/CUIL', '23-37707364-9'],
  ['CVU', '0000003100033338552336'],
  ['Alias', 'reservaglobal']
];

// Forma de entrega para mostrar junto al envío. Los pedidos viejos no la tienen.
function textoEntrega(entrega) {
  if (entrega === 'sucursal') return ' (retiro en sucursal Andreani)';
  if (entrega === 'domicilio') return ' (Andreani a domicilio)';
  return '';
}

function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function precio(n) {
  return '$' + Number(n || 0).toLocaleString('es-AR');
}

function crearTransporte() {
  const user = (process.env.SMTP_USER || '').trim();
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  let pass = process.env.SMTP_PASS || '';
  // Google muestra la contraseña de aplicación con espacios ("abcd efgh ...").
  if (host === 'smtp.gmail.com') pass = pass.replace(/\s/g, '');
  if (!user || !pass) return null;

  const port = Number(process.env.SMTP_PORT) || 465;
  return {
    remitente: `"${NOMBRE_REMITENTE}" <${user}>`,
    transporte: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      // Cortos: el mail sale mientras el cliente espera la confirmación.
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000
    })
  };
}

async function enviarMail({ to, subject, html, replyTo }) {
  const smtp = crearTransporte();
  if (!smtp) {
    console.error(`Faltan SMTP_USER / SMTP_PASS: no se envió "${subject}"`);
    return false;
  }

  try {
    await smtp.transporte.sendMail({
      from: smtp.remitente,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {})
    });
    return true;
  } catch (err) {
    console.error(`Error de SMTP al enviar "${subject}":`, err.code || '', err.response || err.message);
    return false;
  }
}

// ============================================================
//  PIEZAS DE HTML
// ============================================================
function plantilla(contenido) {
  return `
    <div style="font-family: Arial, sans-serif; max-width:560px; margin:0 auto; color:#1c2530; line-height:1.5;">
      ${contenido}
      <p style="margin-top:2rem; font-size:0.85rem; color:#6b6252;">Reserva Global Importados · Venta prohibida a menores de 18 años</p>
    </div>
  `;
}

function tablaItems(pedido) {
  const filas = pedido.items.map(i => `
    <tr>
      <td style="padding:6px 0;">${i.cantidad}× ${esc(i.nombre)}${i.tamano ? ` (${esc(i.tamano)})` : ''}</td>
      <td style="padding:6px 0; text-align:right; white-space:nowrap;">${precio(i.subtotal)}</td>
    </tr>
  `).join('');

  return `
    <table style="width:100%; border-collapse:collapse; margin:1rem 0;">
      ${filas}
      <tr>
        <td style="padding:6px 0; color:#6b6252;">Envío${textoEntrega(pedido.cliente?.entrega)}</td>
        <td style="padding:6px 0; text-align:right; color:#6b6252;">${precio(pedido.envio)}</td>
      </tr>
      <tr style="border-top:1px solid #ddd; font-weight:bold;">
        <td style="padding:8px 0;">Total</td>
        <td style="padding:8px 0; text-align:right;">${precio(pedido.total)}</td>
      </tr>
    </table>
  `;
}

function tablaDatos(filas) {
  return `
    <table style="width:100%; border-collapse:collapse; margin:0.5rem 0 1rem;">
      ${filas.map(([k, v]) => `
        <tr>
          <td style="padding:4px 12px 4px 0; color:#6b6252; white-space:nowrap; vertical-align:top;">${esc(k)}</td>
          <td style="padding:4px 0;">${v}</td>
        </tr>
      `).join('')}
    </table>
  `;
}

function direccionCompleta(c) {
  return `${c.direccion}${c.piso ? `, ${c.piso}` : ''} — ${c.ciudad}, ${c.provincia} (CP ${c.cp})`;
}

function sucursalTexto(s) {
  return `${s.nombre} — ${s.direccion}, ${s.localidad} (${s.provincia})`;
}

// A dónde va el pedido, para los mails al cliente.
function destinoEnvio(c) {
  if (c.entrega !== 'sucursal') return `a: ${direccionCompleta(c)}`;
  return c.sucursal
    ? `a la sucursal de Andreani ${sucursalTexto(c.sucursal)}, para que lo retires con tu DNI`
    : 'a la sucursal de Andreani más cercana a tu código postal (te escribimos para confirmarla)';
}

function linkWhatsapp(texto) {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`;
}

// Hasta cuándo se puede transferir, en hora de Argentina (el servidor
// corre en UTC). Ej.: "jueves 8/10 a las 14:30".
function fechaLimite(venceEn) {
  const zona = { timeZone: 'America/Argentina/Buenos_Aires' };
  const d = venceEn.toDate();
  const dia = d.toLocaleDateString('es-AR', { ...zona, weekday: 'long' });
  const fecha = d.toLocaleDateString('es-AR', { ...zona, day: 'numeric', month: 'numeric' });
  const hora = d.toLocaleTimeString('es-AR', { ...zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${dia} ${fecha} a las ${hora}`;
}

// ============================================================
//  AVISO AL DUEÑO: pedido nuevo con todos los datos para enviarlo
// ============================================================
async function avisarNuevoPedido(pedido) {
  const c = pedido.cliente;
  const esTransferencia = pedido.medioPago === 'transferencia';
  const estadoPago = esTransferencia
    ? 'Transferencia — falta que el cliente mande el comprobante'
    : pedido.estado === 'revisar_pago'
      ? `⚠️ Mercado Pago — revisalo antes de enviar: ${esc(pedido.motivoRevision || 'el pago no coincide con el pedido.')}`
      : `Mercado Pago — pago aprobado${pedido.mercadoPago?.pago?.id ? ` (ID ${esc(pedido.mercadoPago.pago.id)})` : ''}`;

  const html = plantilla(`
    <h2 style="color:#0a3560; margin-bottom:0.25rem;">Nuevo pedido ${esc(pedido.numero)}</h2>
    <p style="margin-top:0;">${estadoPago}</p>

    <h3 style="color:#0a3560; margin-bottom:0;">Cliente</h3>
    ${tablaDatos([
      ['Nombre', esc(c.nombre)],
      ['DNI', esc(c.dni)],
      ['Email', `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`],
      ['Celular', esc(c.celular)]
    ])}

    <h3 style="color:#0a3560; margin-bottom:0;">Entrega</h3>
    ${tablaDatos([
      ['Dirección', esc(direccionCompleta(c))],
      ...(c.entrega === 'sucursal' ? [['Retira en', c.sucursal ? esc(sucursalTexto(c.sucursal)) : 'Sucursal a coordinar con el cliente']] : []),
      ...(c.mensaje ? [['Mensaje', esc(c.mensaje)]] : [])
    ])}

    <h3 style="color:#0a3560; margin-bottom:0;">Productos</h3>
    ${tablaItems(pedido)}
  `);

  const asunto = `${pedido.estado === 'revisar_pago' ? '⚠️ Revisar pago · ' : ''}Nuevo pedido ${pedido.numero} · ${precio(pedido.total)} · ${esTransferencia ? 'Transferencia' : 'Mercado Pago'}`;

  return enviarMail({
    to: process.env.AVISO_PEDIDOS_EMAIL || AVISO_PEDIDOS_DEFAULT,
    subject: asunto,
    html,
    replyTo: c.email
  });
}

// ============================================================
//  CONFIRMACIÓN AL CLIENTE
// ============================================================
async function confirmarAlCliente(pedido) {
  const c = pedido.cliente;
  const primerNombre = c.nombre.split(' ')[0];
  const esTransferencia = pedido.medioPago === 'transferencia';

  const cuerpo = esTransferencia
    ? `
      <h2 style="color:#0a3560;">¡Gracias por tu pedido, ${esc(primerNombre)}!</h2>
      <p>Recibimos tu pedido <strong>${esc(pedido.numero)}</strong>. Para confirmarlo, transferí el total y mandanos el comprobante por WhatsApp.</p>
      <p>Tenés tiempo hasta el <strong>${esc(fechaLimite(pedido.venceEn))}</strong>. Pasado ese plazo, el pedido se cancela y los productos vuelven a estar a la venta.</p>
      ${tablaItems(pedido)}
      <h3 style="color:#0a3560; margin-bottom:0;">Datos para transferir</h3>
      ${tablaDatos([
        ...DATOS_TRANSFERENCIA.map(([k, v]) => [k, `<strong>${esc(v)}</strong>`]),
        ['Monto', `<strong>${precio(pedido.total)}</strong>`]
      ])}
      <p>
        <a href="${linkWhatsapp(`Hola! Te mando el comprobante de transferencia del pedido ${pedido.numero}.`)}"
           style="display:inline-block; background:#25D366; color:#fff; padding:10px 18px; border-radius:24px; text-decoration:none; font-weight:bold;">
          Enviar comprobante por WhatsApp
        </a>
      </p>
      <p>Apenas verifiquemos el pago, coordinamos el envío ${esc(destinoEnvio(c))}.</p>
    `
    : `
      <h2 style="color:#0a3560;">¡Gracias por tu compra, ${esc(primerNombre)}!</h2>
      <p>Tu pago fue aprobado y tu pedido <strong>${esc(pedido.numero)}</strong> quedó confirmado.</p>
      ${tablaItems(pedido)}
      <p>Lo enviamos ${esc(destinoEnvio(c))}. Te avisamos cuando lo despachemos.</p>
    `;

  return enviarMail({
    to: c.email,
    subject: esTransferencia
      ? `Recibimos tu pedido ${pedido.numero} · Reserva Global Importados`
      : `Confirmación de tu compra ${pedido.numero} · Reserva Global Importados`,
    html: plantilla(cuerpo)
  });
}

// Los mails nunca frenan un pedido: si fallan, queda el error en los logs.
async function enviarMailsDePedido(pedido, { alCliente = true } = {}) {
  const envios = [avisarNuevoPedido(pedido)];
  if (alCliente) envios.push(confirmarAlCliente(pedido));
  const resultados = await Promise.allSettled(envios);
  resultados.forEach(r => {
    if (r.status === 'rejected') console.error('No se pudo enviar un mail del pedido', pedido.numero, r.reason);
  });
}

// ============================================================
//  PEDIDOS POR TRANSFERENCIA QUE VENCIERON SIN PAGARSE
// ============================================================
async function avisarVencimientoAlCliente(pedido) {
  const primerNombre = pedido.cliente.nombre.split(' ')[0];

  const html = plantilla(`
    <h2 style="color:#0a3560;">Tu pedido se canceló, ${esc(primerNombre)}</h2>
    <p>Pasaron ${HORAS_PARA_TRANSFERIR} horas y no registramos la transferencia del pedido <strong>${esc(pedido.numero)}</strong>, así que lo cancelamos. No tenés que hacer nada.</p>
    ${tablaItems(pedido)}
    <p><strong>¿Ya habías transferido?</strong> Mandanos el comprobante por WhatsApp y lo resolvemos.</p>
    <p>
      <a href="${linkWhatsapp(`Hola! Ya transferí el pedido ${pedido.numero} y me llegó el aviso de que se canceló. Te mando el comprobante.`)}"
         style="display:inline-block; background:#25D366; color:#fff; padding:10px 18px; border-radius:24px; text-decoration:none; font-weight:bold;">
        Enviar comprobante por WhatsApp
      </a>
    </p>
    <p>Si todavía querés los productos, podés hacer el pedido de nuevo desde la tienda.</p>
  `);

  return enviarMail({
    to: pedido.cliente.email,
    subject: `Tu pedido ${pedido.numero} se canceló · Reserva Global Importados`,
    html
  });
}

async function avisarVencidosAlDueno(pedidos) {
  const filas = pedidos.map(p => `
    <tr style="border-top:1px solid #ddd;">
      <td style="padding:6px 12px 6px 0; white-space:nowrap;"><strong>${esc(p.numero)}</strong></td>
      <td style="padding:6px 12px 6px 0;">${esc(p.cliente.nombre)} · ${esc(p.cliente.celular)}</td>
      <td style="padding:6px 0; text-align:right; white-space:nowrap;">${precio(p.total)}</td>
    </tr>
  `).join('');

  const html = plantilla(`
    <h2 style="color:#0a3560;">Pedidos cancelados por falta de pago</h2>
    <p>Pasaron ${HORAS_PARA_TRANSFERIR} horas sin que se marcaran como pagados. El stock ya volvió a estar disponible y a cada cliente le avisamos por mail.</p>
    <table style="width:100%; border-collapse:collapse; margin:1rem 0;">${filas}</table>
    <p>Si alguno sí te había transferido, escribile: un pedido cancelado no se puede reactivar, hay que hacerlo de nuevo.</p>
  `);

  return enviarMail({
    to: process.env.AVISO_PEDIDOS_EMAIL || AVISO_PEDIDOS_DEFAULT,
    subject: pedidos.length === 1
      ? `Se canceló el pedido ${pedidos[0].numero} por falta de pago`
      : `Se cancelaron ${pedidos.length} pedidos por falta de pago`,
    html
  });
}

async function enviarMailsDeVencimiento(pedidos) {
  const resultados = await Promise.allSettled([
    avisarVencidosAlDueno(pedidos),
    ...pedidos.map(avisarVencimientoAlCliente)
  ]);
  resultados.forEach(r => {
    if (r.status === 'rejected') console.error('No se pudo enviar un aviso de vencimiento:', r.reason);
  });
}

module.exports = { enviarMailsDePedido, enviarMailsDeVencimiento };
