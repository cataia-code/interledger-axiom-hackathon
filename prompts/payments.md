# Prompts — payments

Texto enviado en Cursor para la carpeta `payments/` y su documentación. No incluye claves ni el contenido de `.env`.

## Cliente y contrato con el backend

quiero hacer un ejercicio de implementacion, algo muy simple, donde pueda simular un pago con la wallet de pruebas de ellos y todo eso, solo como para ver que se requiere y que se retorna en cada paso

si ya quisiera enviarle este ejercicio a mi compañero para que lo integre en el back... alguna instruccion para el agente... la idea es que podamos hacer crecer esto para un ecommerce... todo sera de pruebas... flujo end to end

Listos, ya la logramos, ahora agreguemos una carpeta que sea como payments... dejale ahi todo lo que hicimos y lo mapeas en el readme asi como el lo colocó con api

pero quiero que esto sea de utilidad... si dejamos las wallets de buyer y seller en el .env... cada usuario tenga como su wallet y sea dinamico, no podriamos dejar eso quemado

nonono, no toques nada de codigo de la api por que el esta trabajando alli, solo trabaja en lo de payments y documentacion

no es necesario, yoya le pase el create a el por interno, mejor enfoquemonos en que les queden faciles las indicaciones de integracion del pago y ya

## Alcance del cobro

pero por favor, me ayudas a actualizar ese payments/INTEGRACION.md por que el agente de mi compañero le estaba consultando de eso y se quedó varado.

explicame un poco mas acerca de la forma de pago, si mi usuario comprador quiere pagar en un comercio, con bancolombia, por medio de interledger, como hace?

osea el escanea el qr del comercio para pagar por ejemplo 20000 pesos colombianos, ahi ya se tendria el id de la wallet del vendedor, y el monto y la moneda. ahora como usuario o desde el front que ve el usuario de su app, como envia el id de su wallet?

como mejoramos ahora ese payments?, quiero que ya cambie de ser un solo test a darle mas opciones a mi compañero para que podamos sacarle el provecho a la api de interledger

La idea es simplificar lo que mas podamos el proceso, no quiero que se vuelva en una cosa de valide y valide , si no que entre mas rapido y sencillo sea el pago mejor, asi podemos vender como facilitarle la vida a los usuarios sin tantos pasos

de que manera blindamos esto(que seria payments?, un microservicio?) la idea tambien es ser transparentes de que el usuario sepa cuanto se le va a cobrar de fee por su transaccion , pero que sea algo muy lite y no tan traumaatico para el dar tantos clicks

sabes que nomenclatura y eso estan usando en el back y el front?, y revisa si estan usando todo en ingles , la idea seria tambien acogernos a esas nomenclaturas para que todo quede uniforme y bien hecho

si, esta bien, la idea es que nuestra parte se comunica con el backend, entonces basta con que tengamos bien definido , documentado y comentariado lo nuestro para que fluya entre ambos lados. de acuerdo a los lineamientos de la hackathon tenemos que agregar cierta documentacion, podrias ayudarme a revisar y si algo adicionar ese tema del ai policy
