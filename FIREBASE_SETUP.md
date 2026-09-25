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

## 6. Pedidos

Cada compra queda guardada en la colección:

`pedidos`

El ID de cada documento es el número de pedido (`GI-XXXXXXXX-XXXX`). Los crean **solo las funciones del servidor** (`/api`, con la cuenta de servicio de Firebase), nunca el navegador: ahí se validan los datos del cliente y se leen precio y stock de `productos`, así nadie puede alterar el total desde el carrito.

```text
pedidos/
  GI-MFZ1K2AB-7F3A
    numero: "GI-MFZ1K2AB-7F3A"
    estado: "esperando_transferencia"
    medioPago: "transferencia"            // o "mercadopago"
    cliente: { nombre, dni, email, celular, direccion, piso, ciudad, provincia, cp, mensaje }
    items: [{ id, nombre, marca, tamano, precio, cantidad, subtotal }]
    subtotal: 112600
    envio: 20000
    total: 132600
    mercadoPago: { preferenciaId, pago: { id, estado, detalle, monto, fecha } }   // solo Mercado Pago
    creadoEn / actualizadoEn: timestamp
```

### Estados

| Estado | Cuándo |
|---|---|
| `esperando_transferencia` | Pedido por transferencia: falta que el cliente mande el comprobante |
| `pendiente_pago` | Pedido con Mercado Pago que todavía no se pagó (o que el cliente abandonó) |
| `pagado` | Mercado Pago confirmó el pago (se consulta directo a Mercado Pago, no se confía en la URL) |
| `revisar_pago` | Mercado Pago aprobó un monto distinto al total del pedido: revisarlo antes de enviar |

### Flujo y funciones

- `api/crear-pedido-transferencia.js`: guarda el pedido y manda los mails (aviso al dueño + datos para transferir al cliente).
- `api/crear-preferencia.js`: guarda el pedido como `pendiente_pago` y crea el link de pago de Mercado Pago.
- `api/confirmar-pago.js`: cuando Mercado Pago devuelve al cliente al checkout, verifica el pago con Mercado Pago; si está aprobado marca el pedido `pagado` y manda los mails (una sola vez).
- `api/_lib/`: código común (Firebase Admin, validaciones, mails). Vercel no publica como endpoint lo que empieza con `_`.

### Mails

Salen desde Resend con las variables `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (opcional) y `AVISO_PEDIDOS_EMAIL` (opcional; si falta, el aviso llega al mail del administrador). Ver `.env.example`.

Mientras no haya un dominio propio verificado en Resend, Resend solo entrega mails a la casilla con la que se creó la cuenta: el aviso al dueño llega, pero la confirmación al cliente no. Para producción hay que verificar un dominio y cargar `RESEND_FROM_EMAIL` con una dirección de ese dominio.

### Reglas

No hace falta agregar reglas para que funcione: las funciones del servidor usan la cuenta de servicio, que no pasa por las reglas, y como `pedidos` no tiene regla propia, desde el navegador nadie puede leerla ni escribirla (Firestore niega todo lo que no está permitido explícitamente).
