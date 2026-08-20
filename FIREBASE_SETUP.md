# Integración Firebase - Global Importados

La web quedó preparada para usar **Cloud Firestore** como fuente de productos.

## 1. Crear Firestore

En Firebase Console, proyecto `globalimportados-ec4cb`:

1. Ir a **Build → Firestore Database**.
2. Crear la base de datos.
3. Elegir la región más conveniente para el proyecto.
4. Para la primera prueba se puede iniciar en modo de prueba, pero antes de publicar conviene reemplazar las reglas.

## 2. Colección utilizada

La colección es:

`productos`

Cada documento representa un producto. Ejemplo:

```text
productos/
  <id automático>
    name: "Whisky Jack Daniel's Honey"
    brand: "Jack Daniel's"
    category: "Whisky"
    price: 64990
    oldPrice: 0
    size: "700 cc"
    badge: ""
    emoji: "🥃"
    image: ""
    active: true
    featured: false
    order: 1
```

### Campos principales

| Campo | Tipo | Uso |
|---|---|---|
| `name` | string | Nombre del producto |
| `brand` | string | Marca |
| `category` | string | Categoría: Whisky, Vino, Cerveza, etc. |
| `price` | number | Precio actual |
| `oldPrice` | number | Precio anterior opcional |
| `size` | string | 700 cc, 750 cc, 1 L, etc. |
| `badge` | string | Oferta, Premium, NEW, etc. |
| `emoji` | string | Imagen de respaldo |
| `image` | string | URL de imagen del producto |
| `active` | boolean | Si es `false`, no aparece en la tienda |
| `featured` | boolean | Reservado para destacados |
| `order` | number | Orden de aparición |

## 3. Importante sobre seguridad

El frontend solo debe tener permisos de **lectura** para productos. El futuro panel administrador será el que tenga autenticación y permisos de escritura.

Una base inicial de reglas para producción puede ser:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /productos/{productoId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

Cuando se cree el panel admin, se reemplazará `allow write: if false` por una condición basada en Firebase Authentication y usuarios administradores.

## 4. Cómo funcionará después

- `index.html` lee `productos` y muestra las categorías/productos.
- `whisky.html` lee la misma colección y muestra solamente `category == "Whisky"`.
- Las futuras páginas (`vino.html`, `gin.html`, `cerveza.html`, etc.) solo tendrán que reutilizar `firebase.js` y cambiar el nombre de la categoría.
- `onSnapshot()` mantiene el catálogo sincronizado en tiempo real con Firestore.
- El panel administrador podrá agregar, editar, activar/desactivar y ordenar productos sin modificar el código de cada sección.
