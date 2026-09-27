// ============================================================
//  Firebase Admin compartido por las funciones de /api.
//  Vercel no publica como endpoint los archivos de /api que
//  empiezan con "_", así que esta carpeta es solo código común.
// ============================================================
const admin = require('firebase-admin');

function iniciar() {
  if (!admin.apps.length) {
    const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
    if (!raw) throw new Error('Falta configurar FIREBASE_SERVICE_ACCOUNT_KEY');

    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(json))
    });
  }
}

function getDb() {
  iniciar();
  return admin.firestore();
}

function getAuth() {
  iniciar();
  return admin.auth();
}

module.exports = { getDb, getAuth };
