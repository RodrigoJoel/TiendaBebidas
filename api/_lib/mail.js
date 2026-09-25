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
        <td style="padding:6px 0; color:#6b6252;">Envío</td>
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

function linkWhatsapp(texto) {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`;
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
      <p>Apenas verifiquemos el pago, coordinamos el envío a: ${esc(direccionCompleta(c))}.</p>
    `
    : `
      <h2 style="color:#0a3560;">¡Gracias por tu compra, ${esc(primerNombre)}!</h2>
      <p>Tu pago fue aprobado y tu pedido <strong>${esc(pedido.numero)}</strong> quedó confirmado.</p>
      ${tablaItems(pedido)}
      <p>Lo enviamos a: ${esc(direccionCompleta(c))}. Te avisamos cuando lo despachemos.</p>
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

module.exports = { enviarMailsDePedido };
