#!/bin/bash
# Trail Narrator - Cloud Run Deployment Script
# This script automates deployment to Google Cloud Run (bonus points for IaC)

set -e

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-your-project-id}"
REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
SERVICE_NAME="trail-narrator-api"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🏔️ Deploying Trail Narrator to Cloud Run..."
echo "   Project: ${PROJECT_ID}"
echo "   Region: ${REGION}"
echo "   Service: ${SERVICE_NAME}"

# Step 1: Enable required APIs
echo "📡 Enabling required APIs..."
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    aiplatform.googleapis.com \
    firestore.googleapis.com \
    --project="${PROJECT_ID}"

# Step 2: Build container image
echo "🏗️ Building container image..."
cd backend
gcloud builds submit \
    --tag "${IMAGE_NAME}" \
    --project="${PROJECT_ID}"

# Step 3: Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
    --image "${IMAGE_NAME}" \
    --platform managed \
    --region "${REGION}" \
    --project="${PROJECT_ID}" \
    --allow-unauthenticated \
    --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION}" \
    --memory=1Gi \
    --cpu=1 \
    --timeout=300 \
    --max-instances=10 \
    --min-instances=0

# Step 4: Get service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --platform managed \
    --region "${REGION}" \
    --project="${PROJECT_ID}" \
    --format="value(status.url)")

echo ""
echo "✅ Trail Narrator deployed successfully!"
echo "🌐 Service URL: ${SERVICE_URL}"
echo "📋 Health check: ${SERVICE_URL}/health"
echo "📸 Try it: curl -X POST ${SERVICE_URL}/api/narrate -F 'image=@your_photo.jpg'"
