// ============================================================
//  Solo el administrador del panel: el navegador manda el token
//  de Firebase Auth de la sesión del panel (Authorization:
//  Bearer ...) y acá se valida con Firebase antes de hacer nada.
// ============================================================
const { getAuth } = require('./firebase-admin');
const { ErrorPedido } = require('./pedidos');

// Los mismos mails que en admin.html y admin-login.js
const ADMIN_EMAILS = ['rodrigoatatat@gmail.com'];

async function verificarAdmin(req) {
  const [tipo, token] = String(req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    throw new ErrorPedido('Iniciá sesión en el panel para usar esta función.', 401);
  }

  const auth = getAuth();
  let usuario;
  try {
    usuario = await auth.verifyIdToken(token);
  } catch (err) {
    throw new ErrorPedido('La sesión del panel venció. Volvé a iniciar sesión.', 401);
  }

  if (!ADMIN_EMAILS.includes(usuario.email)) {
    throw new ErrorPedido('Esta cuenta no tiene permisos de administrador.', 403);
  }
  return usuario;
}

module.exports = { verificarAdmin };
