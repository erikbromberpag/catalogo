# catalogo
Catalogo mayorista

## Páginas

- `index.html`: catálogo mayorista (precios por cantidad, pedido mínimo, envío gratis, recargo de Mercado Pago). Precios y productos dentro del mismo archivo, en `CONFIGURACIÓN` y `PRODUCTOS`.
- `stock/index.html`: stock en casa para clientes de la zona y clientes viejos (https://erikbromberpag.github.io/catalogo/stock/). Sin descuentos, mínimo ni envío gratis: el carrito arma una consulta por WhatsApp. Es independiente del catálogo mayorista (no se linkean).
  - Productos y precios: `stock/productos.json`, uno por renglón. `n` número · `r` rubro (posición en `rubros`, desde 0) · `t` nombre · `d` detalle · `p` precio en pesos (`null` = muestra "Consultar precio") · `foto` imagen en `stock/fotos/`.
  - Para probarla en la compu: `python3 -m http.server` en esta carpeta y abrí http://localhost:8000/stock/
