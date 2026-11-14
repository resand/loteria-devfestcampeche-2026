# Manual del presentador · Lotería DevFest Campeche

Taller de 60 min · 14 nov 2026 · ~400 personas. La consola `/host` trae este mismo guion en cada paso.

## Antes del evento

**Dos semanas antes**
- [ ] Pide al contacto de Google el **link de canje de créditos** y confirma: ¿cuántos canjes permite?, ¿piden tarjeta?, ¿sirve con Gmail personal?
- [ ] Crea un proyecto **personal** (no el del trabajo) con créditos → `TALLER.md` pasos 1–3.
- [ ] En `.env`: `CREDITS_URL`, `REPO_URL`, `GOOGLE_CLIENT_ID`, `HOST_EMAILS=tu@gmail.com`.
  El `GOOGLE_CLIENT_ID` se crea después del primer deploy (necesita la URL): pasos en `TALLER.md` → “Opcional: login con Google”.
  En la nube **no hace falta clave de Gemini**: `setup.sh` da permiso de Vertex AI a la cuenta de servicio. `GEMINI_API_KEY` es solo para probar en local.
- [ ] La **Lotería en vivo corre en TU cuenta** (tu facturación normal), no en el crédito del evento. Costo ~$16 para 400 cartas; baja `MAX_CARDS` si quieres gastar menos (400 ≈ $16, 200 ≈ $8).
- [ ] **Presupuesto con alerta de $50 USD** en la consola.
- [ ] El crédito de $5 (cuenta **GDP Event Credit**) es para que cada asistente despliegue SU propia Lotería en el paso “Ahora hazlo tú”; eso va en `TALLER.md`, no en tu deploy.
- [ ] Haz 3–4 cartas reales y revisa que el arte y los versos te gusten. Ajusta el prompt en `gemini.js`.
- [ ] Verifica los modelos (`MODEL_IMAGE`, `MODEL_TEXT`, `MODEL_TTS`) en Vertex AI y la **cuota por minuto de imágenes**.
  Si la cuota es baja, pide aumento o sube/baja `CONCURRENCY` (por defecto 6 cartas en paralelo).
- [ ] Repo público en GitHub con `TALLER.md`.

**Una semana antes**
- [ ] `make rehearsal` en local: 400 jugadores falsos de principio a fin.
- [ ] Prueba de carga en la nube (con `MOCK=1` y `ALLOW_GUEST=1` en `.env`, sin gastar Gemini):
  `./scripts/deploy.sh && node scripts/load.js https://TU-URL 400`. **Luego quita ambas variables y vuelve a desplegar.**
- [ ] Ensayo completo con 5–10 amigos reales y celulares distintos (iPhone/Android).

**El día (antes de abrir puertas)**
- [ ] `MIN_INSTANCES=1 ./scripts/deploy.sh` → evita arranque en frío y mantiene el juego en memoria.
- [ ] Laptop 1 (proyector): `/screen` en pantalla completa → **clic para activar sonido**.
- [ ] Laptop 1 o celular: `/host` con tu cuenta.
- [ ] Audio de la laptop conectado al audio del recinto (la voz del gritón).
- [ ] Wi‑Fi del recinto o datos: la app pesa poco, las tablas usan miniaturas de ~15 KB.
- [ ] En `/host` → **Reiniciar juego** si quedaron datos del ensayo (o borra `state.json` del bucket).

## Guion (60 min)

| Min | Paso en `/host` | Qué pasa |
|---|---|---|
| 0–5 | 1 · Bienvenida + QR | Todos entran con Gmail personal. “Desde la cámara, no desde WhatsApp.” |
| 5–7 | 2 · Créditos: ¿quién falta? | La mayoría ya canjeó en la keynote (QR directo a Google): aquí solo marcan “Ya los canjeé”. Quien falte, lo hace desde la app. |
| 7–12 | 3 · Canje paso a paso | Tutorial en el proyector: “Paso siguiente” en el host cambia paso y captura. |
| 12–17 | 4 · Así se despliega | Pasos (proyecto, Google Auth Platform, .env, setup.sh, deploy.sh) + diagrama de arquitectura. Sin código. |
| 17–19 | 5 · Tiempo real: SSE | Qué es (estándar web, no de Google), quién lo usa (ChatGPT, Gemini, Claude), SSE vs WebSockets. |
| 19–21 | 6 · SSE en vivo | El código (10 líneas) y la simulación: “📡 Enviar mensaje a todos” → el proyector anima el mensaje y todos los celulares vibran. |
| 21–30 | 7 · Fábrica de cartas | Selfies. Muro en vivo. Lee versos chistosos. Modera. |
| 30–33 | 8 · Mazo y tablas | “Armar mazo” → 54 cartas de ellos; cada quien ve su tabla. |
| 33–48 | 9 · ¡A cantar! | Tras la 1.ª carta: 1 min sobre Gemini TTS (enlaza con la charla de Eduardo) y muestra `tts()` en gemini.js. Línea primero, luego tabla llena. |
| 48–53 | 8 · Ganadores | Podio + resumen + premios + foto. |
| 53–60 | 11 · Ahora hazlo tú | QR del repo y créditos. Preguntas. |

**Teclas en `/host`:** `→`/`←` cambiar paso · `espacio` cantar una carta. “Auto-cantar 8 s” se pausa solo cuando hay ganador.

## Cómo funciona el juego
- **Mazo:** todas las cartas de la sala, barajadas (así la de cada quien puede salir). Con 400 cartas, la primera línea cae a las ~50 cantadas.
- **Tablas:** cada celular recibe 4×4 = 16 cartas del mazo. También juegan quienes no hicieron carta.
- **Ganar:** primero *línea* (fila, columna o diagonal), después *tabla llena* (botón “Gana: … (cambiar)”).
- **Validación:** el servidor revisa cada “¡LOTERÍA!” contra las cartas cantadas. El orden de llegada define el ranking.
- **Tu carta cantada:** si sale la carta de alguien, su celular vibra y le avisa. Momento estelar 🎉
- **Límites:** 1 carta + 1 reintento por cuenta; tope global `MAX_CARDS` (600).

## Créditos de Google Cloud
- Solo cuentas **@gmail.com** (no Workspace, escuela ni trabajo). Un canje por cuenta.
- Links del 14 nov: principal `…-campeche-1` y respaldo `…-campeche-1-bkp` (450 c/u, 8:00–20:00). Después de las 20:00: `…-campeche-2` y `…-campeche-2-bkp` (hasta las 8:00).
- Antes de las 8:00 del 14 nov la página dice “claim window has not opened yet”: es normal, el link funciona pero la ventana aún no abre.
- En la app, quien ya canjeó marca “Ya los canjeé ✅” para pasar a su carta. No llevamos contador en vivo: el total exacto de canjes lo tiene Google (pídelo a tu contacto).
- Si se acaba el principal: `/host` → Más… → **Créditos: cambiar al link de respaldo** (al instante, sin redesplegar). En la keynote, tecla **U** en la diapositiva de créditos.
- Para quienes canjeen de noche: cambia `CREDITS_URL` por el `-2` y redespliega.

## Si algo falla
| Problema | Qué hacer |
|---|---|
| Fila larga de cartas (“lugar 120”) | Normal: avanza ~6 a la vez. Sigue hablando; abre el paso 8 cuando haya ≥ 16 cartas. |
| Fila lenta o “Gemini está muy ocupado” | Cuota de imágenes llena: la app reintenta sola cada carta hasta 6 veces (≈ 2 min) sin gastar intentos. Si persiste, baja `CONCURRENCY` y redespliega. |
| Gemini caído por completo | `MOCK=1 ./scripts/deploy.sh`: las cartas salen con la selfie en azul y el juego sigue. |
| No suena la voz | Clic en la pantalla para activar sonido. Si la voz de Gemini no está lista, usa la del navegador. |
| Alguien no puede iniciar sesión | Que abra en Chrome/Safari (no WhatsApp/Instagram) y use Gmail personal. |
| Carta inapropiada | `/host` paso 7 → clic en la carta para ocultarla (sale del muro y del mazo). |
| Se reinició el servidor | El estado se respalda en Cloud Storage cada segundo y se recupera solo. |

## Después del evento
- [ ] `/host` → paso 10: toma captura del resumen para el reporte del DevFest.
- [ ] Borra las cartas: `/host` → Más… → **Borrar todo** (borra jugadores, cartas, imágenes y voces del bucket). Para borrar el bucket completo: `gcloud storage rm -r gs://PROYECTO-loteria`.
- [ ] `gcloud run services delete loteria` o `MIN_INSTANCES=0` para no gastar.

## Privacidad (dilo en el paso 7)
La selfie solo se envía a Gemini para dibujar la carta y **no se guarda**. La carta sí se muestra en la pantalla y se borra al terminar el evento.
