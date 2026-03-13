"""
Trail Narrator - FastAPI Backend
Main application entry point
"""

import os
import uuid
from io import BytesIO

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents.narrator import analyze_and_narrate, answer_followup

load_dotenv()

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


class FollowUpRequest(BaseModel):
    session_id: str
    question: str


class NarrationResponse(BaseModel):
    session_id: str
    narration: str
    identification: str
    time_travel_image: str | None
    time_travel_caption: str
    era: str


class FollowUpResponse(BaseModel):
    answer: str


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
    
    # Run the narration pipeline
    result = await analyze_and_narrate(
        image_bytes=image_bytes,
        trail_context=trail_context,
        previous_narration=previous_narration,
    )
    
    # Store narration in session
    if session_id in sessions:
        sessions[session_id]["narrations"].append(result["narration"])
    
    return NarrationResponse(
        session_id=session_id,
        narration=result["narration"],
        identification=result["identification"],
        time_travel_image=result["time_travel_image"],
        time_travel_caption=result["time_travel_caption"],
        era=result["era"],
    )


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
