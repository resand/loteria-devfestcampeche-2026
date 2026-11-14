# { Lotería DevFest Campeche }

Tu selfie → carta de lotería hecha con **Gemini** → juego en vivo con todo el auditorio.
Corre en **Cloud Run** con tus créditos de Google Cloud.

| Ruta | Quién | Qué |
|---|---|---|
| `/` | Asistentes (celular) | Login → créditos → selfie → carta → tabla 4×4 → ¡Lotería! |
| `/screen` | Proyector | QR, muro en vivo, carta cantada con voz, ganadores y resumen |
| `/host` | Presentador | Avanza las fases, arma el mazo, canta, modera. Trae el guion |

- **¿Quieres desplegarlo tú?** → [TALLER.md](TALLER.md) (15 min, paso a paso)
- **¿Vas a presentarlo?** → [MANUAL.md](MANUAL.md)

```bash
make run      # local en modo ensayo (sin Gemini, no gasta)
make rehearsal   # simula 400 jugadores de principio a fin
make deploy   # Cloud Run (gasta créditos)
```

**Stack:** Node + Express (un solo servidor) · Server-Sent Events para el tiempo real · Gemini Nano Banana 2.1 (arte),
Gemini 3.5 Flash-Lite (versos), Gemini 3.8 Flash TTS (el gritón) vía Vertex AI · Cloud Storage · Sign in with Google (opcional).

```
server.js     API, tiempo real, cola de cartas, juego
gemini.js     las 3 llamadas a Gemini (+ modo ensayo)
game.js       mazo, tablas, cantar y validar (con pruebas en game.test.js)
store.js      archivos: ./data en local, Cloud Storage en la nube
public/       las 3 vistas (HTML + JS sin build)
scripts/      setup.sh, deploy.sh, load.js
```
