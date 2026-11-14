# Taller · Despliega tu propia Lotería en Cloud Run

Tiempo: ~15 min · Costo: centavos de tus créditos · Necesitas: Gmail personal y los créditos del DevFest canjeados.

## 0. Canjea tus créditos
Con una cuenta **@gmail.com** (no sirven las de Workspace, escuela o trabajo; un canje por cuenta): abre el link → **Claim Credit** → crea tu perfil de Google Developer → reCAPTCHA → **Claim Credit**. La cuenta de facturación **GDP Event Credit: DevFest Campeche 2026** aparece en hasta 5 min (es la que eliges al crear el proyecto). [Guía con capturas](public/guia-creditos.pdf).

> **Tu crédito y su cuenta de facturación.** En <https://me.developers.google.com/benefits> verás tu tarjeta **$5 Codelab Credit** con el **ID de la cuenta** (`billingAccounts/XXXXXX-XXXXXX-XXXXXX`) y tu **saldo restante**. Guarda ese ID (la parte `XXXXXX-XXXXXX-XXXXXX`): es el que va en `BILLING_ACCOUNT`.

Los créditos cubren Google Cloud (Cloud Run, Storage, Gemini por Vertex AI), **no** AI Studio: por eso este proyecto usa Vertex y no una API key.

## 1. Crea tu proyecto con los créditos
1. Abre <https://console.cloud.google.com> con el **mismo Gmail** con el que canjeaste los créditos.
2. Arriba: selector de proyectos → **Proyecto nuevo** → nombre `loteria-devfest`.
3. Menú → **Facturación** → arriba, **Sus cuentas de facturación** → elige **GDP Event Credit: DevFest Campeche 2026** y vincúlala al proyecto. (El crédito NO se suma a tu cuenta normal; es una cuenta aparte.)
4. Recomendado: **Facturación → Presupuestos y alertas** → crea un presupuesto de $10 USD con alerta.

## 2. Abre Cloud Shell y clona
**No necesitas instalar nada en tu computadora.** Cloud Shell es una terminal en el navegador que ya trae `gcloud`, `git` y `node`; funciona igual en Mac, Windows, Linux o hasta en una tablet. Botón `>_` arriba a la derecha de la consola.
```bash
git clone https://github.com/resand/loteria-devfestcampeche-2026
cd loteria-devfestcampeche-2026
cp .env.example .env
```
Edita `.env` (`cloudshell edit .env`) y pon como mínimo:
```
PROJECT=loteria-devfest-xxxx          # el ID que aparece en la consola
BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX   # el de tu crédito (me.developers.google.com/benefits); así setup.sh lo liga solo
HOST_KEY=una-clave-que-inventes       # para abrir /host
```

## 3. Prepara y despliega
```bash
./scripts/setup.sh    # activa APIs, crea bucket y cuenta de servicio, prueba Gemini
./scripts/deploy.sh   # sube a Cloud Run (3–5 min la primera vez)
```
Al final verás tres links: **App**, **Pantalla** y **Host**.

## 4. Juega
1. Abre **Host** (`/host?key=TU_HOST_KEY`) y **Pantalla** en otra pestaña.
2. En el host pasa a **Fábrica de cartas** y desde tu celular abre la **App**: haz tu carta.
3. Invita a 15 amigos (se necesitan 16 cartas para armar tablas 😉), arma el mazo y ¡a cantar!

## 5. Hazlo tuyo (ideas)
- `gemini.js` → cambia el prompt: estilo de las cartas, los lugares de tu ciudad (`CAMPECHE`), el tono de los versos.
- `gemini.js` → `ARCHETYPES`: las cartas que se pueden elegir.
- `VOICE=Kore` en `.env` → otra voz para el gritón.

## Opcional: hacerlo desde tu propia computadora
Si prefieres tu terminal en vez de Cloud Shell, instala antes:
- **gcloud CLI**: <https://cloud.google.com/sdk/docs/install> (Mac, Windows y Linux). Luego `gcloud init` e inicia sesión con tu Gmail personal.
- **git**: en Mac y Linux ya viene (en Mac, la primera vez que lo usas instala las herramientas de Xcode); en Windows instálalo de <https://git-scm.com/downloads>. Si no quieres git, descarga el ZIP del repo desde GitHub (botón *Code → Download ZIP*).
- **Node.js 22 o más nuevo**: <https://nodejs.org>
Y sigue los mismos pasos 2–4. Nota: si tienes `gcloud` con la cuenta del trabajo, crea una configuración aparte: `gcloud config configurations create devfest` y `gcloud auth login`.

## Opcional: login con Google
**Sin esto la Lotería funciona completa**: la gente entra escribiendo su nombre, hace su carta, juega y gana igual. Lo que da el login es control: una carta **por cuenta de Google** (sin él, es por sesión del navegador), y abrir `/host` con tu correo en vez de con la llave. Vale la pena para un evento grande; para probar con amigos, sáltatelo.
Para activarlo, en la consola busca **Google Auth Platform** (es el nuevo nombre de la “Pantalla de consentimiento de OAuth”):
1. Si es la primera vez, botón **Comenzar** y llena: **Información de la marca** (nombre de la app, por ejemplo “Lotería DevFest”, y tu correo de asistencia) → **Público: Externo** → tu correo de contacto → acepta la política → **Crear**.
2. En **Información de la marca → Dominio de la app** llena lo que Google exige para publicar: **Página principal** = la URL de tu app (`https://loteria-…run.app`) y **Política de privacidad** = `https://loteria-…run.app/privacy` (la app ya la sirve; edítala en `public/privacy.html` con tu correo). En **Dominios autorizados** debe estar `loteria-…run.app`. **No subas logotipo**: con logo Google pide una verificación que tarda semanas. Guardar.
3. En **Público**, pulsa **Publicar app** (estado “En producción”). Mientras diga “En prueba”, solo entran los usuarios de prueba que agregues a mano y el límite es de 100.
4. En **Clientes → + Crear cliente → Aplicación web**, ponle nombre (“Lotería web”) y en *Orígenes autorizados de JavaScript* agrega la URL de tu app tal cual (`https://loteria-…run.app`, sin barra al final). No necesita URIs de redirección. **Crear** y copia el **ID de cliente** (termina en `.apps.googleusercontent.com`).
   *Acceso a los datos* no requiere nada: el correo y el perfil básicos vienen por defecto.
5. En `.env`: `GOOGLE_CLIENT_ID=…` y `HOST_EMAILS=tu@gmail.com` → `./scripts/deploy.sh` de nuevo. Para probar en local, agrega también `http://localhost:8080` como origen autorizado, o entra como invitado (`make run` lo permite).

## Al terminar: no gastes de más
```bash
gcloud run services delete loteria --region us-central1
gcloud storage rm -r gs://$PROJECT-loteria
```
O borra el proyecto completo desde la consola (**IAM y administración → Configuración → Cerrar**).

## Problemas comunes
| Síntoma | Solución |
|---|---|
| `setup.sh` dice que Gemini no respondió | El proyecto no tiene facturación ligada a tus créditos (paso 1.3) |
| “No se pudo hornear tu carta” | Filtro de seguridad de la foto: intenta con otra selfie. Revisa `gcloud run services logs read loteria` |
| Error 404 del modelo | Cambia `MODEL_IMAGE` en `.env` por uno vigente (<https://ai.google.dev/gemini-api/docs/models>) |
| El login de Google no aparece | Abre la app en Chrome/Safari, no dentro de WhatsApp/Instagram |
