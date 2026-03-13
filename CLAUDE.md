# Trail Narrator - CLAUDE.md

## Project Overview
Trail Narrator is an AI-powered national parks storytelling agent for the Gemini Live Agent Challenge hackathon (Creative Storyteller track). Users upload trail photos, and the agent produces immersive mixed-media narratives — weaving voice narration, AI-generated "time-travel" imagery (what the landscape looked like millions of years ago), and interactive Q&A into a single cohesive flow.

**Deadline:** March 16, 2026 @ 5:00 PM PDT

## Tech Stack
- **Backend:** Python 3.11+ / FastAPI / Google GenAI SDK (`google-genai`)
- **Frontend:** Next.js 14 (App Router) / React 18 / Tailwind CSS
- **AI Models:**
  - `gemini-2.5-flash` — landscape identification, narration generation, conversational Q&A
  - `gemini-3-pro-image-preview` — "time-travel" image generation (interleaved TEXT + IMAGE output)
  - Gemini Live API (`gemini-2.5-flash-native-audio-preview-12-2025`) — voice interaction
- **Google Cloud:** Cloud Run (backend hosting), Firestore (session data), Cloud Storage (media cache)
- **IaC:** gcloud deploy scripts or Terraform

## Architecture

```
Frontend (Next.js on Vercel/Cloud Run)
  ↓ REST/WebSocket
Backend (FastAPI on Cloud Run)
  ├── /api/narrate — POST image → returns narration text + time-travel image
  ├── /api/followup — POST question + session_id → returns answer
  ├── /api/live — WebSocket for voice interaction via Live API
  ├── Firestore — session state, trail context
  └── Cloud Storage — cached generated images
```

## Key SDK Patterns

### Image Analysis + Narration (Gemini 2.5 Flash)
```python
from google import genai
from PIL import Image

client = genai.Client()  # picks up GEMINI_API_KEY from env

image = Image.open("trail_photo.jpg")
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[image, "Identify the geological features, flora, fauna, and landscape in this photo. Then write a rich, engaging narration as a warm park ranger storyteller."],
)
print(response.text)
```

### Time-Travel Image Generation (Gemini 3 Pro Image - Interleaved Output)
```python
from google import genai
from google.genai.types import GenerateContentConfig, Modality
from PIL import Image
from io import BytesIO

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents="Generate an image showing what the Grand Canyon area looked like 270 million years ago as a shallow tropical sea with marine life. Photorealistic style.",
    config=GenerateContentConfig(
        response_modalities=[Modality.TEXT, Modality.IMAGE],
    ),
)

for part in response.candidates[0].content.parts:
    if part.text:
        print(part.text)
    elif part.inline_data:
        image = Image.open(BytesIO(part.inline_data.data))
        image.save("time_travel.png")
```

### Live API Voice Interaction
```python
from google import genai
from google.genai.types import Content, LiveConnectConfig, Modality, Part

client = genai.Client()

async with client.aio.live.connect(
    model="gemini-2.5-flash-native-audio-preview-12-2025",
    config=LiveConnectConfig(response_modalities=[Modality.TEXT]),
) as session:
    await session.send_client_content(
        turns=Content(role="user", parts=[Part(text="What kind of rock is that sandstone layer?")])
    )
    async for response in session.receive():
        if response.text:
            print(response.text)
```

### For Vertex AI (production deployment)
```python
from google import genai
from google.genai.types import HttpOptions

client = genai.Client(
    vertexai=True,
    project="your-project-id",
    location="us-central1"
)
# Same API calls work with Vertex AI backend
```

## Agent Persona: "Ranger"
- Warm, knowledgeable storytelling voice
- Mix of geological science + naturalist wonder
- Think David Attenborough meets a campfire park ranger talk
- Uses vivid language: "270 million years ago, right where you're standing was the floor of a shallow tropical sea..."
- Educational but never dry — always tells a story, never just lists facts

## Project Structure
```
trail-narrator/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── agents/
│   │   ├── narrator.py      # Narration pipeline (identify → narrate → generate image)
│   │   ├── time_travel.py   # Time-travel image generation
│   │   └── live_session.py  # Live API voice interaction handler
│   ├── models/
│   │   └── schemas.py       # Pydantic models
│   ├── services/
│   │   ├── firestore.py     # Session management
│   │   └── storage.py       # Cloud Storage for media
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # Main trail narrator interface
│   │   ├── layout.tsx
│   │   └── components/
│   │       ├── PhotoUpload.tsx
│   │       ├── StoryDisplay.tsx    # Mixed-media narrative viewer
│   │       ├── VoiceInput.tsx      # Microphone capture
│   │       └── TimeTravelImage.tsx # Generated image display
│   ├── package.json
│   └── tailwind.config.ts
├── infra/
│   ├── deploy.sh            # gcloud deployment script (bonus points)
│   └── cloudbuild.yaml
├── CLAUDE.md                # This file
├── README.md
└── architecture.png         # Architecture diagram for submission
```

## Development Commands
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev

# Deploy to Cloud Run
cd infra
./deploy.sh
```

## Submission Checklist
- [ ] Working demo: photo → narration + time-travel image + voice follow-up
- [ ] Devpost text description
- [ ] Public GitHub repo with README + spin-up instructions
- [ ] GCP deployment proof (screen recording)
- [ ] Architecture diagram
- [ ] Demo video (< 4 min)
- [ ] Medium post with #GeminiLiveAgentChallenge
- [ ] IaC deployment scripts
- [ ] GDG membership link

## Phase References
- Phase 1: Backend foundation + core AI pipeline (narrate endpoint)
- Phase 2: Frontend UI + photo upload + story display
- Phase 3: Voice interaction via Live API
- Phase 4: Cloud Run deployment + IaC
- Phase 5: Polish, demo video, submission
