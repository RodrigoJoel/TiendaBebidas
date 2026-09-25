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
    // Pedidos: solo el administrador los ve y les cambia el estado.
    // Crearlos y borrarlos no está permitido desde el navegador: los
    // crean las funciones de /api con la cuenta de servicio.
    match /pedidos/{pedidoId} {
      allow read, update: if request.auth != null
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
    stockDescontado: [{ id, cantidad }]     // lo que se repone si se cancela
    mercadoPago: { preferenciaId, pagoAprobadoId, pago: { id, estado, detalle, monto, fecha } }   // solo Mercado Pago
    motivoRevision: "..."                   // solo si quedó en "revisar_pago"
    notaAdmin: "..."                        // nota interna del panel
    creadoEn / actualizadoEn / pagadoEn / enviadoEn / canceladoEn: timestamp
```

### Estados

| Estado | Cuándo |
|---|---|
| `esperando_transferencia` | Pedido por transferencia: falta que el cliente transfiera y mande el comprobante |
| `pendiente_pago` | Pedido con Mercado Pago que todavía no se pagó (o que el cliente abandonó) |
| `pagado` | Pago confirmado (Mercado Pago lo aprobó, o el admin marcó que llegó la transferencia): hay que enviarlo |
| `revisar_pago` | Algo no cierra y hay que mirarlo antes de enviar; el motivo queda en `motivoRevision` (monto distinto, stock que no alcanzó, pago devuelto o con contracargo, cobrado dos veces, pagado después de cancelado) |
| `enviado` | El admin lo marcó como despachado |
| `cancelado` | El admin lo canceló; el stock que había descontado ya se repuso |

### Stock

- **Transferencia:** se descuenta al crear el pedido (queda reservado mientras el cliente transfiere).
- **Mercado Pago:** se descuenta cuando se aprueba el pago. Si mientras tanto se agotó, se descuenta lo que haya (nunca queda negativo) y el pedido pasa a `revisar_pago`.
- **Cancelar** desde el panel repone lo descontado. Los productos con stock ilimitado (vacío) no se tocan.
- Todo se hace en transacciones de Firestore: dos compras al mismo tiempo no se pueden llevar la misma unidad.

### Flujo y funciones

- `api/crear-pedido-transferencia.js`: guarda el pedido, reserva el stock y manda los mails (aviso al dueño + datos para transferir al cliente).
- `api/crear-preferencia.js`: guarda el pedido como `pendiente_pago` y crea el link de pago de Mercado Pago, con `notification_url` apuntando al webhook.
- `api/confirmar-pago.js`: cuando Mercado Pago devuelve al cliente al checkout, verifica el pago con Mercado Pago.
- `api/webhook-mercadopago.js`: Mercado Pago avisa cada pago acá, aunque el cliente cierre la pestaña. No hace falta configurar nada en el panel de Mercado Pago: la dirección va en cada link de pago. Opcionalmente se puede cargar `MP_WEBHOOK_SECRET` para exigir la firma.
- Las dos últimas usan la misma lógica (`api/_lib/pagos.js`): si el pago está aprobado, descuentan el stock, marcan el pedido `pagado` y mandan los mails. Da igual cuál llegue primero; nada se repite.
- `api/_lib/`: código común (Firebase Admin, validaciones, stock, pagos, mails). Vercel no publica como endpoint lo que empieza con `_`.

### Panel de administración

`admin.html → Pedidos` muestra los pedidos en tiempo real (los últimos 300), con filtros por estado y buscador. "Para atender" junta los que esperan transferencia, los pagados sin enviar y los que hay que revisar; los `pendiente_pago` abandonados quedan aparte en "Sin pagar". Desde el detalle se marca que llegó la transferencia, que se envió, o se cancela (reponiendo stock), y se puede dejar una nota interna.

### Mails

Salen por SMTP desde una cuenta de Gmail (gratis, hasta ~500 mails por día), a nombre de "Reserva Global Importados". Se configuran en Vercel con:

- `SMTP_USER`: la dirección de Gmail que manda los mails. Conviene una cuenta propia de la tienda y no la personal.
- `SMTP_PASS`: una **contraseña de aplicación** de esa cuenta, no la contraseña normal. Se crea en *Cuenta de Google → Seguridad → Verificación en 2 pasos* (tiene que estar activada) *→ Contraseñas de aplicaciones*.
- `AVISO_PEDIDOS_EMAIL` (opcional): a qué casilla llega el aviso de cada pedido nuevo. Si falta, llega al mail del administrador.
- `SMTP_HOST` / `SMTP_PORT` (opcionales): solo para usar otro proveedor en lugar de Gmail.

Después de cargar o cambiar una variable en Vercel hay que hacer un deploy nuevo para que la tome. Si faltan las variables o el envío falla, el pedido se guarda igual y el error queda en los logs de Vercel ("Faltan SMTP_USER / SMTP_PASS" o "Error de SMTP").

### Reglas

Para que el panel pueda ver y actualizar los pedidos hace falta publicar la regla de `pedidos` de la sección 3 (solo lectura y actualización, y solo para el administrador). Las funciones del servidor usan la cuenta de servicio, que no pasa por las reglas. Nadie más puede leer ni escribir pedidos desde el navegador, y ni siquiera el admin puede crearlos o borrarlos.

Mientras la regla no esté publicada, la tienda y el resto del panel funcionan igual; la sección Pedidos muestra un aviso.
