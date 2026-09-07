// ============================================================
//  API — Enviar mail de confirmación de pedido (Resend)
//  Función serverless (Vercel). Se llama después de un pago
//  aprobado por Mercado Pago o de confirmar una transferencia.
//
//  Mientras no haya un dominio propio verificado en Resend, solo
//  puede enviar a la casilla del dueño de la cuenta de Resend
//  (limitación del servicio, no del código). Cuando se verifique
//  un dominio, cambiar RESEND_FROM_EMAIL y empieza a llegarle a
//  cualquier cliente sin tocar más código.
// ============================================================
const FROM_EMAIL_DEFAULT = 'Reserva Global Importados <onboarding@resend.dev>';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'El envío de mails no está configurado (falta RESEND_API_KEY)' });
      return;
    }

    const { email, orderNumber, items, total, metodoPago } = req.body || {};

    if (!email || !orderNumber || !Array.isArray(items) || !items.length) {
      res.status(400).json({ error: 'Faltan datos del pedido' });
      return;
    }

    const esTransferencia = metodoPago === 'transferencia';

    const filas = items.map(i => `
      <tr>
        <td style="padding:6px 0;">${i.qty}× ${i.name}</td>
        <td style="padding:6px 0; text-align:right;">${i.subtotal}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width:520px; margin:0 auto; color:#1c2530;">
        <h2 style="color:#0a3560;">¡Gracias por tu compra!</h2>
        <p>Tu pedido <strong>${orderNumber}</strong> fue registrado correctamente${esTransferencia ? ' y está pendiente de confirmación por transferencia.' : '.'}</p>
        <table style="width:100%; border-collapse:collapse; margin:1rem 0;">
          ${filas}
          <tr style="border-top:1px solid #ddd; font-weight:bold;">
            <td style="padding:8px 0;">Total</td>
            <td style="padding:8px 0; text-align:right;">${total}</td>
          </tr>
        </table>
        ${esTransferencia ? '<p>Recordá enviarnos el comprobante por WhatsApp para confirmar tu pedido.</p>' : '<p>En breve coordinamos el envío.</p>'}
        <p style="margin-top:2rem; font-size:0.85rem; color:#6b6252;">Reserva Global Importados</p>
      </div>
    `;

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || FROM_EMAIL_DEFAULT,
        to: email,
        subject: `Confirmación de tu pedido ${orderNumber} · Reserva Global Importados`,
        html
      })
    });

    if (!resendResp.ok) {
      const errBody = await resendResp.text();
      console.error('Error de Resend al enviar el mail:', errBody);
      res.status(502).json({ error: 'No se pudo enviar el mail' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error al enviar mail de confirmación:', err);
    res.status(500).json({ error: 'No se pudo enviar el mail' });
  }
};
