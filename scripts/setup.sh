#!/usr/bin/env bash
# Prepara el proyecto una sola vez: APIs, bucket y cuenta de servicio con permisos mínimos.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || cp .env.example .env
# Lee .env sin \`source\`: ignora comentarios y líneas vacías; los valores pueden llevar espacios (sin comillas).
load_env() { while IFS= read -r line || [ -n "$line" ]; do line="${line%%#*}"; line="${line%"${line##*[![:space:]]}"}"; [[ "$line" == *=* ]] || continue; export "$line"; done < .env; }
load_env
PROJECT=${PROJECT:-$(gcloud config get-value project 2>/dev/null)}
[ -n "$PROJECT" ] || { echo "❌ Pon PROJECT=tu-proyecto en .env"; exit 1; }
REGION=${REGION:-us-central1}; BUCKET=$PROJECT-loteria; SA=loteria@$PROJECT.iam.gserviceaccount.com
gcloud config set project "$PROJECT" >/dev/null

# El proyecto necesita facturación activa. Si pones BILLING_ACCOUNT (el ID de “GDP Event Credit:
# DevFest Campeche 2026”, visible con: gcloud billing accounts list), lo ligamos; si no, usa la que ya tenga.
if [ -n "${BILLING_ACCOUNT:-}" ]; then
  echo "⓪ Ligando la cuenta de facturación del crédito…"
  gcloud billing projects link "$PROJECT" --billing-account "$BILLING_ACCOUNT" >/dev/null && echo "   ✅ ligada" || echo "   ⚠️  no se pudo ligar (revisa el ID y que seas administrador de esa cuenta)"
fi

echo "① Activando APIs (1–2 min)…"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  aiplatform.googleapis.com storage.googleapis.com

echo "② Bucket gs://$BUCKET (cartas y estado del juego)"
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 || \
  gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access

echo "③ Cuenta de servicio con permisos mínimos"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 || \
  gcloud iam service-accounts create loteria --display-name="Lotería (Cloud Run)"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" --role=roles/storage.objectAdmin >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role=roles/aiplatform.user --condition=None >/dev/null

echo "④ Probando Gemini…"
TOKEN=$(gcloud auth print-access-token)
curl -sf -o /dev/null -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "https://aiplatform.googleapis.com/v1/projects/$PROJECT/locations/global/publishers/google/models/${MODEL_TEXT:-gemini-3.5-flash-lite}:generateContent" \
  -d '{"contents":[{"role":"user","parts":[{"text":"di hola"}]}]}' && echo "   ✅ Gemini responde" || echo "   ⚠️  Gemini no respondió: revisa facturación/créditos del proyecto"

echo "✅ Listo. Ahora: ./scripts/deploy.sh"
