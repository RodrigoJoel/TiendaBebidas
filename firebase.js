// ============================================================
// FIREBASE - GLOBAL IMPORTADOS
// ============================================================
// Firebase Web SDK 12.17.0 - API modular
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDRKn7CkbwblMLohJjq7oIE73vXiWlrB70",
  authDomain: "globalimportados-ec4cb.firebaseapp.com",
  databaseURL: "https://globalimportados-ec4cb-default-rtdb.firebaseio.com",
  projectId: "globalimportados-ec4cb",
  storageBucket: "globalimportados-ec4cb.firebasestorage.app",
  messagingSenderId: "892432100057",
  appId: "1:892432100057:web:916150059c02a7363a6cc8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Escucha en tiempo real la colección de productos.
 * La misma función se puede reutilizar en index, whisky y futuras categorías.
 */
export function escucharProductos(callback, onError = console.error) {
  return onSnapshot(
    collection(db, "productos"),
    snapshot => {
      const productos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(productos);
    },
    error => {
      console.error("Error al leer productos desde Firestore:", error);
      onError(error);
    }
  );
}

export { app, db };
