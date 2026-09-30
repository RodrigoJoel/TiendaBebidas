// ============================================================
//  COSTO DE ENVÍO — GLOBAL IMPORTADOS
//  Tarifas del servicio "Vinos" de Andreani (cajas de 1, 2, 4 y 6
//  botellas), cotizadas el 2026-09-29 desde Resistencia / Paso de los
//  Libres, sin seguro. Cuando Andreani aumente, se actualiza TARIFAS.
//  Al envío se le suma el seguro (1% + IVA del valor del pedido) y un
//  extra fijo por si hay que comprar las cajas en el correo.
//  Lo usan el checkout (navegador, window.Envio) y el servidor
//  (api/_lib/pedidos.js, con require), así el precio sale de un solo
//  lugar.
// ============================================================
(function (raiz) {
  // Precio por caja de [1, 2, 4, 6] botellas.
  const CAJAS = [1, 2, 4, 6];
  const TARIFAS = {
    general: {
      sucursal: [10656, 11543, 14206, 16636],
      domicilio: [14122, 14544, 18207, 24352]
    },
    patagonia: {
      sucursal: [11407, 13045, 17896, 21872],
      domicilio: [15383, 15889, 20399, 29007]
    },
    // Ushuaia es lo más caro: se aplica a toda Tierra del Fuego.
    ushuaia: {
      sucursal: [13592, 17212, 28414, 34414],
      domicilio: [15502, 17212, 28414, 34882]
    }
  };
  const SEGURO = 0.0121;
  const VALOR_DECLARADO_MINIMO = 30000;
  const EXTRA_CAJAS = 3000;
  const ENTREGAS = ['sucursal', 'domicilio'];
  const PATAGONIA = ['Neuquén', 'Río Negro', 'Chubut', 'Santa Cruz'];

  // Para Andreani, el sur de Buenos Aires (CP 8000 a 8999: Bahía
  // Blanca, Patagones) también es Patagonia.
  function zonaDe(provincia, cp) {
    if (provincia === 'Tierra del Fuego') return 'ushuaia';
    if (PATAGONIA.includes(provincia)) return 'patagonia';
    const numero = Number((String(cp || '').match(/\d{4}/) || [])[0]);
    if (provincia === 'Buenos Aires' && numero >= 8000 && numero <= 8999) return 'patagonia';
    return 'general';
  }

  // Cajas de 6 hasta que queden 6 o menos; el resto va en la caja
  // más chica donde entre. Devuelve el índice de cada caja en CAJAS.
  function cajasPara(botellas) {
    const cajas = [];
    let resto = Math.max(1, Math.floor(botellas) || 1);
    while (resto > 6) {
      cajas.push(3);
      resto -= 6;
    }
    cajas.push(CAJAS.findIndex((capacidad) => capacidad >= resto));
    return cajas;
  }

  // Devuelve el costo redondeado para arriba a $100, o null si falta
  // la provincia o la forma de entrega.
  function costoEnvio({ provincia, cp, entrega, botellas, subtotal }) {
    if (!provincia || !ENTREGAS.includes(entrega)) return null;
    const precios = TARIFAS[zonaDe(provincia, cp)][entrega];
    const flete = cajasPara(botellas).reduce((suma, caja) => suma + precios[caja], 0);
    const seguro = Math.max(Number(subtotal) || 0, VALOR_DECLARADO_MINIMO) * SEGURO;
    return Math.ceil((flete + seguro + EXTRA_CAJAS) / 100) * 100;
  }

  const Envio = { CAJAS, ENTREGAS, zonaDe, cajasPara, costoEnvio };
  if (typeof module !== 'undefined' && module.exports) module.exports = Envio;
  else raiz.Envio = Envio;
})(typeof globalThis !== 'undefined' ? globalThis : this);
