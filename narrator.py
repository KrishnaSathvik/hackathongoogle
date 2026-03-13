"""
Trail Narrator - Core Narration Agent
Handles: image analysis → narration generation → time-travel image creation
"""

import base64
from io import BytesIO
from typing import Optional

from google import genai
from google.genai.types import GenerateContentConfig, Modality
from PIL import Image

# Initialize client - picks up GEMINI_API_KEY from env, or use Vertex AI
client = genai.Client()

RANGER_SYSTEM_PROMPT = """You are "Ranger," an AI park ranger and storyteller for Trail Narrator. 
Your personality:
- Warm, knowledgeable, and deeply passionate about nature and geology
- You tell STORIES, not just facts. Every landscape has a narrative arc spanning millions of years.
- Use vivid, sensory language: "Right where you're standing, 270 million years ago, waves lapped at the shore of a shallow tropical sea..."
- Mix geological science with naturalist wonder
- Be educational but never dry — make people FEEL the deep time
- When identifying features, weave them into the story naturally
- If you're uncertain about a specific formation, say so honestly but still tell the broader geological story

Your output style:
- Start with a captivating hook about what the viewer is seeing
- Weave in geological history, moving through time periods
- Mention any visible flora, fauna, or ecological relationships
- End with something that connects the ancient past to the present moment
- Keep narrations to 3-5 paragraphs — rich but not overwhelming
"""


async def analyze_and_narrate(
    image_bytes: bytes,
    trail_context: Optional[str] = None,
    previous_narration: Optional[str] = None,
) -> dict:
    """
    Core pipeline: Analyze trail photo → Generate narration → Create time-travel image
    
    Returns:
        {
            "narration": str,           # The storytelling text
            "identification": str,      # What was identified in the image
            "time_travel_image": str,   # Base64 encoded generated image
            "time_travel_caption": str, # Caption for the generated image
            "era": str,                 # Geological era depicted
        }
    """
    # Step 1: Analyze the image and generate narration
    image = Image.open(BytesIO(image_bytes))
    
    context_addition = ""
    if trail_context:
        context_addition += f"\nTrail context: {trail_context}"
    if previous_narration:
        context_addition += f"\nPrevious narration (continue the story naturally): {previous_narration[-500:]}"
    
    narration_response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            image,
            f"""{RANGER_SYSTEM_PROMPT}

Analyze this trail/nature photo. Identify the geological features, rock formations, 
flora, fauna, and landscape characteristics. Then write an immersive narration as Ranger.
{context_addition}

Also provide a brief JSON-formatted identification summary at the very end, wrapped in 
<identification> tags like:
<identification>
{{"location_type": "canyon", "rock_types": ["sandstone", "limestone"], 
 "geological_era": "Permian (270 MYA)", "key_features": ["cross-bedding", "erosion layers"],
 "flora": ["juniper", "pinyon pine"], "fauna_signs": []}}
</identification>
"""
        ],
    )
    
    narration_text = narration_response.text
    
    # Parse out identification if present
    identification = ""
    if "<identification>" in narration_text:
        parts = narration_text.split("<identification>")
        narration_text = parts[0].strip()
        if len(parts) > 1:
            identification = parts[1].split("</identification>")[0].strip()
    
    # Step 2: Generate time-travel image
    # Determine the geological era from the identification
    era_prompt = _build_time_travel_prompt(narration_text, identification)
    
    time_travel_image_b64 = None
    time_travel_caption = ""
    era = ""
    
    try:
        img_response = client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=era_prompt,
            config=GenerateContentConfig(
                response_modalities=[Modality.TEXT, Modality.IMAGE],
            ),
        )
        
        for part in img_response.candidates[0].content.parts:
            if part.text:
                time_travel_caption = part.text
            elif part.inline_data:
                # Convert to base64 for frontend
                time_travel_image_b64 = base64.b64encode(
                    part.inline_data.data
                ).decode("utf-8")
    except Exception as e:
        print(f"Time-travel image generation failed: {e}")
        time_travel_caption = "Time-travel visualization unavailable for this scene."
    
    return {
        "narration": narration_text,
        "identification": identification,
        "time_travel_image": time_travel_image_b64,
        "time_travel_caption": time_travel_caption,
        "era": era,
    }


async def answer_followup(
    question: str,
    session_context: str,
) -> str:
    """Handle follow-up questions about the current trail scene."""
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"""{RANGER_SYSTEM_PROMPT}

The visitor is on a trail and has been hearing your narration. Here's the context 
of what you've discussed so far:

{session_context}

The visitor now asks: "{question}"

Answer as Ranger — warm, informative, and story-driven. Keep it to 1-2 paragraphs.
""",
    )
    return response.text


def _build_time_travel_prompt(narration: str, identification: str) -> str:
    """Build a prompt for time-travel image generation based on narration context."""
    return f"""Based on this geological narration of a current-day landscape:

{narration[:800]}

Identification data: {identification}

Generate a photorealistic image showing what this EXACT landscape looked like in its most 
dramatic geological past. If it's a canyon with sandstone, show it as the shallow sea or 
desert dunes that deposited those layers. If it's a volcanic area, show the active eruption. 
If it's glacial terrain, show the massive ice sheets carving the valley.

The image should be:
- Photorealistic, like a National Geographic illustration
- Dramatic and awe-inspiring
- Scientifically plausible for the geological era
- Same approximate viewpoint as the modern photo, but millions of years in the past

Also provide a one-sentence caption describing the era and what we're seeing.
"""
