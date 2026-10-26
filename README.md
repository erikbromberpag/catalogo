# catalogo

Catálogo mayorista con carrito y pedido por WhatsApp. Son dos páginas independientes (ninguna tiene links a la otra):

| Página | Archivo | Qué muestra |
|---|---|---|
| Stock propio – Entrega inmediata | `index.html` | productos con `"stock": "propio"` |
| A pedido | `a-pedido.html` | productos con `"stock": "pedido"`; el mensaje de WhatsApp aclara que se reservan con pago total |

## Dónde se cambia cada cosa

- **Precios y productos:** `productos.json`, un producto por renglón. Las dos páginas leen este mismo archivo.
  - `n` número · `r` rubro (posición en la lista `rubros`, empezando en 0) · `t` nombre · `d` descripción · `m` modelo
  - `p` precio de lista · `c` moneda (`"USD"` o `"ARS"`) · `b` unidades del bulto
  - `stock`: `"propio"` (sale en la página de stock propio) o `"pedido"` (sale en la de a pedido)
- **Niveles de descuento, tipo de cambio, dólar mostrado, pedido mínimo, recargo de Mercado Pago, envío gratis, WhatsApp y textos de cada página:** `config.js`.
- **Fotos:** `imagenes.json` (se generó del catálogo anterior; no hace falta tocarlo).

## Probar en la compu

Las páginas cargan `productos.json`, así que abiertas con doble clic no funcionan. Desde esta carpeta:

```
python3 -m http.server
```

y abrí http://localhost:8000 (stock propio) o http://localhost:8000/a-pedido.html (a pedido).
