"""
Trail Narrator - FastAPI Backend
Main application entry point
"""

import os
import json
import uuid
from io import BytesIO
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import storage as gcs

from agents.narrator import analyze_and_narrate, answer_followup, identify_and_narrate, generate_past_image, generate_future_image

load_dotenv()

# ─── GCS-backed story persistence ─────────────────────────────
STORIES_BUCKET = os.getenv("STORIES_BUCKET", "trail-narrator-stories")
STORIES_BLOB = "public_stories.json"

_gcs_client = None

def _get_gcs_bucket():
    global _gcs_client
    try:
        if _gcs_client is None:
            _gcs_client = gcs.Client()
        return _gcs_client.bucket(STORIES_BUCKET)
    except Exception as e:
        print(f"[GCS] Could not connect to bucket: {e}")
        return None

def _load_stories_from_gcs() -> list:
    bucket = _get_gcs_bucket()
    if not bucket:
        return []
    blob = bucket.blob(STORIES_BLOB)
    try:
        data = blob.download_as_text()
        return json.loads(data)
    except Exception:
        return []

def _save_stories_to_gcs(stories: list):
    bucket = _get_gcs_bucket()
    if not bucket:
        return
    blob = bucket.blob(STORIES_BLOB)
    try:
        blob.upload_from_string(json.dumps(stories), content_type="application/json")
    except Exception as e:
        print(f"[GCS] Failed to save stories: {e}")

app = FastAPI(
    title="Trail Narrator",
    description="AI-powered national parks storytelling agent",
    version="0.1.0",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store (swap for Firestore in production)
sessions: dict = {}

# Public story gallery (loaded from GCS on startup, most recent first)
public_stories: list = _load_stories_from_gcs()


class FollowUpRequest(BaseModel):
    session_id: str
    question: str


class NarrationResponse(BaseModel):
    session_id: str
    narration: str
    identification: str
    era: str


class ImageGenerationRequest(BaseModel):
    session_id: str
    narration: str
    identification: str


class ImageResponse(BaseModel):
    image: str | None
    caption: str


class FollowUpResponse(BaseModel):
    answer: str


class PublishStoryRequest(BaseModel):
    trail_name: str
    narration: str
    identification: str
    era: str
    past_image: str | None = None
    past_caption: str = ""
    future_image: str | None = None
    future_caption: str = ""


@app.get("/")
async def root():
    return {
        "app": "Trail Narrator",
        "version": "0.1.0",
        "status": "running",
        "description": "Upload a trail photo to /api/narrate to begin your journey",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/api/narrate", response_model=NarrationResponse)
async def narrate_trail_photo(
    image: UploadFile = File(...),
    session_id: str = Form(default=None),
    trail_name: str = Form(default=None),
):
    """
    Upload a trail photo and receive an immersive narration with a time-travel visualization.
    
    - Send a photo from your hike
    - Get back a rich storytelling narration from "Ranger"
    - See what the landscape looked like millions of years ago
    - Continue uploading photos to build a continuous trail story
    """
    # Read image
    image_bytes = await image.read()
    
    if not image_bytes:
        raise HTTPException(status_code=400, detail="No image data received")
    
    # Create or continue session
    if not session_id:
        session_id = str(uuid.uuid4())
        sessions[session_id] = {
            "narrations": [],
            "trail_name": trail_name,
        }
    
    # Get previous narration for story continuity
    previous_narration = None
    if session_id in sessions and sessions[session_id]["narrations"]:
        previous_narration = sessions[session_id]["narrations"][-1]
    
    trail_context = None
    if trail_name:
        trail_context = f"Trail: {trail_name}"
    
    # Run the fast narration pipeline (no image generation)
    try:
        result = await identify_and_narrate(
            image_bytes=image_bytes,
            trail_context=trail_context,
            previous_narration=previous_narration,
        )
    except Exception as e:
        print(f"Narration pipeline error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Narration failed: {str(e)}")

    # Store narration in session
    if session_id in sessions:
        sessions[session_id]["narrations"].append(result["narration"])

    return NarrationResponse(
        session_id=session_id,
        narration=result["narration"],
        identification=result["identification"],
        era=result["era"],
    )


@app.post("/api/generate-past-image", response_model=ImageResponse)
async def generate_past_image_endpoint(request: ImageGenerationRequest):
    """Generate a time-travel (past) image based on narration context."""
    try:
        result = await generate_past_image(
            narration=request.narration,
            identification=request.identification,
        )
    except Exception as e:
        print(f"Past image generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Past image generation failed: {str(e)}")

    return ImageResponse(image=result["image"], caption=result["caption"])


@app.post("/api/generate-future-image", response_model=ImageResponse)
async def generate_future_image_endpoint(request: ImageGenerationRequest):
    """Generate a future projection image based on narration context."""
    try:
        result = await generate_future_image(
            narration=request.narration,
            identification=request.identification,
        )
    except Exception as e:
        print(f"Future image generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Future image generation failed: {str(e)}")

    return ImageResponse(image=result["image"], caption=result["caption"])


@app.post("/api/followup", response_model=FollowUpResponse)
async def followup_question(request: FollowUpRequest):
    """
    Ask a follow-up question about the current trail scene.
    
    Examples: "What kind of rock is that?", "What animals lived here?", 
    "How old are those layers?"
    """
    session = sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Build context from session narrations
    session_context = "\n\n---\n\n".join(session["narrations"][-3:])  # Last 3 narrations
    
    answer = await answer_followup(
        question=request.question,
        session_context=session_context,
    )
    
    return FollowUpResponse(answer=answer)


class TTSRequest(BaseModel):
    text: str
    voice: str = "Kore"  # Warm, storytelling voice


@app.post("/api/tts")
async def text_to_speech(request: TTSRequest):
    """
    Convert narration text to natural speech using Gemini TTS.
    Returns WAV audio as base64.
    """
    from google import genai
    from google.genai import types
    import wave
    import io
    import base64

    client = genai.Client()

    try:
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash-preview-tts",
            contents=f"Read the following in a warm, engaging park ranger storytelling voice. Speak naturally with gentle pacing, as if narrating a nature documentary by a campfire:\n\n{request.text}",
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=request.voice,
                        )
                    )
                ),
            ),
        )

        # Extract audio data
        audio_data = None
        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.mime_type.startswith("audio/"):
                audio_data = part.inline_data.data
                break

        if not audio_data:
            raise HTTPException(status_code=500, detail="No audio generated")

        # Convert PCM to WAV
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(24000)
            wf.writeframes(audio_data)

        wav_bytes = wav_buffer.getvalue()
        audio_b64 = base64.b64encode(wav_bytes).decode("utf-8")

        return {"audio": audio_b64, "mime_type": "audio/wav"}

    except Exception as e:
        print(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


@app.get("/api/stories")
async def get_public_stories():
    """Return all publicly shared trail stories for the gallery."""
    return public_stories[:50]


@app.delete("/api/stories")
async def clear_public_stories():
    """Clear all public stories (also clears GCS)."""
    public_stories.clear()
    _save_stories_to_gcs(public_stories)
    return {"status": "cleared"}


@app.post("/api/stories")
async def publish_story(request: PublishStoryRequest):
    """Save a completed story to the public gallery (persisted to GCS)."""
    # Parse location name from identification
    location_name = request.trail_name
    try:
        id_data = json.loads(request.identification)
        location_name = id_data.get("location_name", request.trail_name) or request.trail_name
    except Exception:
        pass

    story = {
        "id": str(uuid.uuid4()),
        "trail_name": request.trail_name,
        "location_name": location_name,
        "narration": request.narration,
        "identification": request.identification,
        "era": request.era,
        "past_image": request.past_image,
        "past_caption": request.past_caption,
        "future_image": request.future_image,
        "future_caption": request.future_caption,
        "created_at": datetime.utcnow().isoformat(),
    }
    public_stories.insert(0, story)
    # Keep max 50 stories
    if len(public_stories) > 50:
        public_stories.pop()
    # Persist to GCS
    _save_stories_to_gcs(public_stories)
    return {"id": story["id"], "status": "published"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
