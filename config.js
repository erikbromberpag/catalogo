/* =====================================================================
   CONFIGURACIÓN — la usan las dos páginas (index.html y a-pedido.html)
   Los productos y sus precios NO van acá: están en productos.json.
   ===================================================================== */
window.CONFIG = {
  NEGOCIO:   'Catálogo mayorista DYN',        // nombre que se muestra arriba y en el mensaje
  SUBTITULO: 'Lista de precios ',
  WHATSAPP:  '5492984227160',             // TU número: código de país + código de área + número, sin + ni espacios (ej. Argentina celular: 549 + área + número)
  // Los productos 001-411 están en dólares (US$) y del 412 en adelante en pesos ($).
  // Si cargás un tipo de cambio mayor a 0, aparece el selector $ / US$ y todo se convierte.
  // Si lo dejás en 0, cada precio se muestra en su moneda y el total se separa por moneda.
  TIPO_CAMBIO: 1600,                         // pesos por 1 US$ con el que se pasan a pesos los precios en dólares (no se muestra en la página)
  DOLAR_MOSTRADO: 1550,                      // dólar con el que se muestran los US$ y el que figura en el mensaje. Los pesos no cambian: US$ mostrado = pesos ÷ este valor
  MONEDA_INICIAL: 'ARS',                  // 'ARS' o 'USD' (solo se usa si TIPO_CAMBIO > 0)
  SALUDO:    'Hola, quiero hacer este pedido:',
  PIE:       'Precios por unidad para pago por transferencia. Disponibilidad y total sujetos a confirmación. Las imágenes son ilustrativas.',
  CLAVE_GUARDADO: 'carrito-mayorista-v1', // cambiá este texto si renovás precios y querés que los carritos viejos se descarten (cada página guarda su propio carrito)

  // ---------- PRECIOS POR CANTIDAD ----------
  // El nivel sale de las unidades del MISMO producto en el pedido. El descuento es % sobre el precio de lista.
  // desde: unidades mínimas, o 'bulto' = caja cerrada del importador (nunca menos que CAJA_MINIMA).
  NIVELES: [
    { nombre: 'Lista',        desde: 1,       descuento: 0  },
    { nombre: 'Pack',         desde: 3,       descuento: 5  },
    { nombre: 'Mayorista',    desde: 6,       descuento: 10 },
    { nombre: 'Caja cerrada', desde: 'bulto', descuento: 15 }
  ],
  CAJA_MINIMA: 12,                // unidades de la caja cerrada si el producto no tiene bulto cargado (o si es menor)
  // Productos con precio de lista menor a este monto en pesos: sin descuento y se venden solo en packs.
  SIN_DESCUENTO_MENOR_A: 1500,
  PACK_SIN_DESCUENTO: 20,         // unidades del pack de esos productos
  PACKS: {},                     // excepciones al pack (N° de producto: unidades)
  RECARGO_MP: 9,                  // % que se suma al total si pagan con Mercado Pago (los precios de la página son de transferencia)
  PEDIDO_MINIMO: 100000,          // en pesos, por pedido (cada página arma su pedido). 0 = sin mínimo
  PEDIDO_MINIMO_BLOQUEA: false,   // true = no deja enviar el pedido hasta llegar al mínimo
  ENVIO_GRATIS_DESDE: 350000,     // en pesos. 0 = no se muestra

  // ---------- LAS DOS PÁGINAS (independientes: ninguna tiene links a la otra) ----------
  // Cada producto de productos.json dice en "stock" a qué página va: "propio" o "pedido".
  PAGINAS: {
    propio: {
      TITULO:  'Stock propio – Entrega inmediata',
      AVISO:   ''                                     // texto que se muestra en la página y va en el mensaje de WhatsApp ('' = nada)
    },
    pedido: {
      TITULO:  'A pedido',
      AVISO:   'Los productos a pedido se reservan con pago total.'
    }
  }
};
