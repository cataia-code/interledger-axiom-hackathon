# Prompts — payments

Instrucciones dadas en Cursor para armar `payments/` y su documentación. Van redactadas de nuevo, con el pedido y el resultado. No incluyen claves ni el contenido de `.env`.

## Cliente de prueba

Pedir un ejercicio mínimo contra la wallet de pruebas de Interledger: recorrer un pago y dejar claro qué se envía y qué responde cada paso.

Cuando ese pago ya funcione, preparar el mismo flujo para un ecommerce de pruebas, de punta a punta, y escribir la instrucción para integrarlo en el backend.

Crear la carpeta `payments/` con ese cliente y enlazarla desde el README de la raíz, igual que `api/`.

Las wallets del buyer y del seller no van en `.env`. Cada usuario trae la suya en el pago. En el entorno solo queda la identidad de la app que firma.

Limitar el trabajo a `payments/` y a su documentación. No modificar `api/`.

Dejar la integración del cobro fácil de seguir. El esquema de wallets ya se pasó por otro canal, así que no hace falta repetirlo.

## Checkout

Explicar el pago con un caso concreto: el buyer escanea el QR de un comercio por 20000 COP. El QR trae la wallet del vendedor, el monto y la moneda. La wallet del buyer ya está guardada en la app, así que la persona no tiene que copiarla en cada compra.

Actualizar `payments/INTEGRACION.md` para que ese recorrido quede cerrado y el backend pueda implementarlo sin detenerse.

Mantener el cobro en un solo paso para la persona. Las consultas de wallet, cotización e historial pueden existir, pero no son pantallas previas al pago.

No convertir `payments/` en un microservicio. El flujo vive en el backend que ya existe. En la misma pantalla del pago se muestra el fee de la red, con un solo botón hacia la aprobación.

Usar los nombres que ya tienen el backend y el front: `buyer`, `store`, `order`, `payment`, `amount`, `currency` y `debitAmount`. El texto de la interfaz sigue en español. `commissionAmount` es la comisión de Lokora, distinta del fee de la red.

Dejar `payments/` documentado y comentado para que el backend lo consuma. Agregar `AI_USAGE.md` y este registro, como pide la política de IA de la hackathon.
