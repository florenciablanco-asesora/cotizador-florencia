# Cotizador de Florencia Blanco · Prevención Salud

Página de una sola pantalla para que los interesados que llegan desde los anuncios de Meta completen sus datos y se los envíen a Flor por WhatsApp, ya ordenados para cotizar. Cliente del estudio de Gonza.

## Cómo está armada
- HTML + CSS + JavaScript sin frameworks. Se publica con GitHub Pages desde la rama `main`, carpeta raíz.
- `index.html`: estructura y textos fijos.
- `styles.css`: diseño (magenta #E20172, ciruela #3A2030, Poppins).
- `app.js`: arma las tarjetas de planes y maneja el formulario de 4 pasos; al final arma el mensaje y abre `https://wa.me/<numero>?text=...`.
- `config.json`: número de WhatsApp, tope de sueldo bruto, categorías de monotributo, provincias, límites.
- `planes.json`: planes visibles (A2, A2 CP, A4, A5), destacados, detalle y comparación A2 vs A2 CP.
- `assets/`: foto de Flor, logo, imagen para compartir (`og.jpg`), favicon.
- No hay servidor ni base de datos: la página no guarda datos personales.
- La página lee los JSON con `fetch`: para probarla en la PC hay que levantar un servidor local (`python -m http.server`), no sirve abrir `index.html` con doble clic.

## Reglas del negocio (no cambiar sin confirmar con Gonza)
- Relación de dependencia o monotributo = origen OBLIGATORIO. Responsable inscripto o sin aportes = VOLUNTARIO.
- Dependencia pide sueldo bruto (tope en `config.json`). Monotributo pide solo la categoría (no monotributo social).
- Pareja: siempre nombre y DNI. En Obligatorio se pregunta si suma aportes (trabajo + sueldo o categoría).
- Hijos: solo cantidad (hasta 25 años; de 21 a 25 con certificado de alumno regular). Familiares a cargo: solo en Obligatorio, hasta 3.
- Plan de interés: hasta 2, o "No sé, asesorame".
- Referido: nombre (obligatorio) y celular (opcional) de quien recomendó, para asignarle la giftcard.
- Orden del mensaje: titular → origen → grupo familiar → plan → referido (igual que el cotizador oficial).
- Nunca inventar coberturas, precios ni opiniones. Los datos de planes salen de prevencionsalud.com.ar/planes.

## Cambios frecuentes
- Tope de sueldo: `config.json` → `sueldo_bruto_tope` (número sin puntos).
- Número de WhatsApp: `config.json` → `whatsapp.numero` (54 9 + característica + número, sin 0 ni 15).
- Ocultar un plan: `planes.json` → `"visible": false`.
- Después de cada cambio: validar que los JSON sigan siendo válidos, probar con servidor local, commit y push a `main`.

## Medición
`app.js` tiene la función `track(evento)` (eventos: paso-1..4, paso-listo, envio-whatsapp, hablar-directo, cotizar-plan-XX, click-cotizar-portada). Se conecta a la herramienta de medición en el paso 10.
