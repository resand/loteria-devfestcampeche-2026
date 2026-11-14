#!/usr/bin/env bash
# Despliega en Cloud Run con Gemini vía Vertex AI (lo cubren los créditos de Google Cloud).
set -euo pipefail
cd "$(dirname "$0")/.."
# Lee .env sin \`source\`: ignora comentarios y líneas vacías; los valores pueden llevar espacios (sin comillas).
load_env() { while IFS= read -r line || [ -n "$line" ]; do line="${line%%#*}"; line="${line%"${line##*[![:space:]]}"}"; [[ "$line" == *=* ]] || continue; export "$line"; done < .env; }
load_env
PROJECT=${PROJECT:-$(gcloud config get-value project 2>/dev/null)}; REGION=${REGION:-us-central1}
grep -q '^SESSION_SECRET=' .env || { echo "SESSION_SECRET=$(openssl rand -hex 24)" >> .env; load_env; }

# ponytail: 1 sola instancia porque el estado del juego vive en memoria; 1000 conexiones alcanzan para ~400 personas.
y() { [ -n "${!1:-}" ] && printf '%s: "%s"\n' "$1" "${!1}"; true; }
{
  printf 'GOOGLE_GENAI_USE_VERTEXAI: "true"\nGOOGLE_CLOUD_PROJECT: "%s"\nGOOGLE_CLOUD_LOCATION: "global"\nBUCKET: "%s"\n' "$PROJECT" "$PROJECT-loteria"
  for v in CREDITS_URL CREDITS_URL_BACKUP REPO_URL GOOGLE_CLIENT_ID HOST_EMAILS HOST_KEY SESSION_SECRET MAX_CARDS CONCURRENCY MODEL_IMAGE MODEL_TEXT MODEL_TTS VOICE TTS_STYLE ALLOW_GUEST MOCK; do y $v; done
} > /tmp/loteria-env.yaml

gcloud run deploy loteria --source . --project "$PROJECT" --region "$REGION" \
  --service-account "loteria@$PROJECT.iam.gserviceaccount.com" --allow-unauthenticated \
  --min-instances "${MIN_INSTANCES:-0}" --max-instances 1 --concurrency 1000 --timeout 3600 \
  --cpu 2 --memory 2Gi --no-cpu-throttling --env-vars-file /tmp/loteria-env.yaml
rm /tmp/loteria-env.yaml

URL=$(gcloud run services describe loteria --region "$REGION" --format='value(status.url)')
echo
echo "✅ App:      $URL"
echo "   Pantalla: $URL/screen"
echo "   Host:     $URL/host${HOST_KEY:+?key=$HOST_KEY}"
