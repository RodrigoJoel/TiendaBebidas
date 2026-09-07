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
    stock: 12
    badge: ""
    emoji: "🥃"
    image: ""
    description: ""
    active: true
    order: 1
    createdAt: 1737400000000
```

### Campos principales

| Campo | Tipo | Uso |
|---|---|---|
| `name` | string | Nombre del producto |
| `brand` | string | Marca. Se autocompleta en el panel admin con las marcas ya cargadas en la categoría, y una marca nueva queda disponible como filtro apenas se guarda el producto |
| `category` | string | Una de: Whisky, Ron, Vodka, Tequila, Gin, Licores, Aguardiente, Espumante, Cerveza, Vino, Energizante, Combos |
| `price` | number | Precio actual |
| `oldPrice` | number \| null | Precio anterior (tachado) — se muestra solo si es mayor a 0 |
| `size` | string | Tamaño/presentación. Igual que `brand`: autocompleta y alimenta el filtro lateral |
| `stock` | number \| null | Unidades disponibles. `null`/vacío = stock ilimitado. En 0 el sitio muestra "Sin stock" y bloquea el agregado al carrito |
| `badge` | string \| null | Ej: NEW, Oferta, Premium, Hot |
| `emoji` | string | Ícono de respaldo cuando no hay `image` |
| `image` | string | URL de imagen del producto |
| `description` | string | Descripción que se muestra en la ficha/modal del producto |
| `active` | boolean | Si es `false`, no aparece en la tienda |
| `order` | number | Orden de aparición dentro de su categoría |
| `createdAt` | number | Timestamp usado por el panel admin para mostrar "últimos productos agregados" |

## 3. Panel de administración

El panel vive en `admin.html` (protegido por `admin-login.html`) y permite cargar, editar, ocultar y borrar productos de cada categoría desde una sola colección `productos`. Para dejarlo operativo hace falta, en Firebase Console (proyecto `globalimportados-ec4cb`):

1. **Habilitar el proveedor Email/Password**: *Build → Authentication → Sign-in method → Email/Password → Habilitar*.
2. **Crear el usuario administrador**: *Build → Authentication → Users → Add user*, con el email `rodrigoatatat@gmail.com` y una contraseña. Ese email es el único autorizado a entrar al panel (está hardcodeado como whitelist en `admin-login.js` y `admin.html`).
3. **Actualizar las reglas de Firestore** para permitir escritura solo a ese administrador autenticado (*Build → Firestore Database → Rules*):

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /productos/{productoId} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.token.email == 'rodrigoatatat@gmail.com';
    }
    match /heroCarousels/{seccion} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.token.email == 'rodrigoatatat@gmail.com';
    }
  }
}
```

Mientras las reglas sigan en `allow write: if false`, el panel se va a poder abrir y navegar, pero cualquier alta/edición/borrado va a fallar con un error de permisos. Lo mismo pasa con `heroCarousels`: si no se agrega su regla, el sitio sigue mostrando las fotos de referencia (las que ya vienen cargadas por defecto) pero nunca va a leer las que se carguen desde el panel, y el panel va a fallar al guardar con "Missing or insufficient permissions".

## 4. Cómo funciona

- `index.html` lee `productos` y muestra los destacados de todas las categorías.
- `whisky.html`, `vino.html`, `gin.html`, etc. leen la misma colección filtrando por `category`.
- `onSnapshot()` mantiene el catálogo sincronizado en tiempo real con Firestore, tanto en el sitio como en el panel admin.
- Desde `admin.html`, cada categoría tiene su propia vista con buscador, filtro por marca/tamaño, alta de productos y edición/borrado/ocultado individual — sin tocar código.

## 5. Carruseles de portada (fotos de fondo del hero)

Cada página (home + las 12 categorías) muestra hasta 3 fotos como fondo difuminado detrás del título, rotando solas. Se administran desde `admin.html → Carruseles de portada`, sin tocar código.

Colección:

`heroCarousels`

Un documento por sección, con el nombre de la sección como ID:

`home`, `whisky`, `ron`, `vodka`, `tequila`, `gin`, `licores`, `aguardiente`, `espumante`, `cerveza`, `vino`, `energizante`, `combos`

```text
heroCarousels/
  whisky
    images: ["https://...", "https://...", "https://..."]
```

- `images`: array de hasta 3 URLs. Con 1 sola foto queda fija (no rota); con 0 el sitio usa una foto de referencia hardcodeada en `hero-carousel.js` hasta que se cargue algo real.
- El panel guarda con "merge", así que cada sección se puede guardar por separado sin pisar las demás.
- Hace falta la regla de Firestore de la sección 3 para que el sitio pueda leer `heroCarousels` y el panel pueda escribirlo.
