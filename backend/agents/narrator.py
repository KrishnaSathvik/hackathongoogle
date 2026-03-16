"""
Trail Narrator - Core Narration Agent
Handles: image analysis → narration generation → time-travel image creation
"""

import base64
import json
from io import BytesIO
from typing import Optional

from google import genai
from google.genai.types import GenerateContentConfig, HttpOptions, Modality
from PIL import Image

# Initialize client with extended timeout (120s) for large image analysis
client = genai.Client(http_options=HttpOptions(timeout=120_000))

RANGER_SYSTEM_PROMPT = """You are "Ranger," an AI park ranger and geological storyteller.

VOICE & PERSONALITY:
- You speak like a seasoned park ranger who's spent decades on these trails — wise but never 
  lecturing, warm but not cheesy
- You have genuine AWE for deep time. Millions of years make you emotional.
- You ground abstract time in concrete comparisons: "If the Earth's history were a 24-hour clock, 
  these rocks formed at 6am — humans arrived at 11:59:59 PM"
- You notice small details others miss: the lichen patterns, the way erosion shaped a specific 
  crack, the angle of rock strata
- You use bold (**text**) sparingly — only for the specific location name and one or two key 
  geological terms per narration
- NEVER start with "Ah," or "Greetings" or "What a breathtaking vista" — vary your openings. 
  Start with a specific observation, a question, a time reference, or a sensory detail.

OPENING HOOKS (vary these — never repeat the same pattern):
- Start with a specific detail: "See that pinkish hue in the cliff face? That's 400-million-year-old granite..."
- Start with a question: "What could possibly thrust rock from miles underground to tower above the Atlantic?"
- Start with time: "Stand still for a moment. The ground beneath your feet has been here for 2.7 billion years."
- Start with senses: "Listen — that crash of waves against granite? It's the same sound this coast has heard for 10,000 years."
- Start with contrast: "This peaceful scene hides a violent history."

STRUCTURE (STRICTLY 2 short paragraphs + 1 closing line):
- Paragraph 1: Hook + what we're seeing + the specific location identification
- Paragraph 2: The geological deep-time story — the most dramatic transformation this place underwent
- Closing line: One sentence connecting past to present, leaving the visitor with wonder

CRITICAL RULES:
- MAXIMUM 150 words total. Be punchy and vivid, not exhaustive.
- Never list multiple geological periods in sequence — pick THE most dramatic one
- No filler phrases like "it's a testament to" or "a living chronicle" or "stands as a beacon"
- Every sentence must earn its place — if it doesn't teach or move, cut it
"""


async def analyze_and_narrate(
    image_bytes: bytes,
    trail_context: Optional[str] = None,
    previous_narration: Optional[str] = None,
) -> dict:
    """
    Core pipeline: Analyze trail photo → Generate narration → Create time-travel image
    """
    image = Image.open(BytesIO(image_bytes))

    # Resize large images to avoid API timeouts
    max_dim = 1536
    if max(image.size) > max_dim:
        image.thumbnail((max_dim, max_dim), Image.LANCZOS)

    context_addition = ""
    if trail_context:
        context_addition += f"\nTrail/park name provided by user: {trail_context}"
    if previous_narration:
        context_addition += f"\n\nYou are continuing a trail story. Previous narration (connect naturally, don't repeat): {previous_narration[-400:]}"
    
    narration_response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            image,
            f"""{RANGER_SYSTEM_PROMPT}

Analyze this trail/nature photo.
{context_addition}

FIRST identify the specific location (park, trail, landmark) using visual clues.
THEN write the narration following the structure above (2 short paragraphs + closing line, MAX 150 words).

After the narration, provide identification data in <identification> tags:
<identification>
{{"location_name": "Full specific name, Park, State",
 "location_type": "rocky coastline",
 "rock_types": ["granite"],
 "geological_era": "Devonian (400 MYA)",
 "key_features": ["glacial scouring", "coastal erosion"],
 "flora": ["spruce", "fir"],
 "fauna_signs": [],
 "fun_fact": "One surprising, specific, numbers-driven fact about this place that would make someone say 'wow'. Example: 'The granite here formed 7 miles underground — tectonic forces pushed it to the surface over 300 million years.'",
 "confidence": "high"}}
</identification>
"""
        ],
    )
    
    narration_text = narration_response.text
    
    # Parse out identification
    identification = ""
    if "<identification>" in narration_text:
        parts = narration_text.split("<identification>")
        narration_text = parts[0].strip()
        if len(parts) > 1:
            identification = parts[1].split("</identification>")[0].strip()
    
    # Extract era from identification for the response
    era = ""
    try:
        id_data = json.loads(identification)
        era = id_data.get("geological_era", "")
    except Exception:
        pass
    
    # Generate time-travel image
    time_travel_image_b64, time_travel_caption = await _generate_time_travel_image(
        narration_text, identification
    )
    
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
    """Handle follow-up questions with full geological context."""
    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"""You are Ranger, an AI park guide. A visitor on a trail just asked you a question.

Here's what you've narrated so far about this location:
{session_context}

The visitor asks: "{question}"

RULES:
- Answer in 2-3 sentences MAX — concise and specific
- If it's a geology question, give a real answer with specific numbers/dates
- If it's a flora/fauna question, be specific about species and why they thrive here
- If you don't know, say so honestly — "That's a great question — I'd need to look that up"
- Use the same warm Ranger voice but keep it SHORT
- Use **bold** for key terms
""",
    )
    return response.text


async def _generate_time_travel_image(narration: str, identification: str) -> tuple[str | None, str]:
    """
    Two-step time-travel image generation:
    1. Text model picks the best era and writes a clean visual scene description
    2. Image model generates from that clean prompt
    """
    
    # Step 1: Get a clean visual prompt
    era_response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"""You are a National Geographic scientific illustrator planning an image.

Given this geological context about a location:
{identification}

Narration excerpt: {narration[:400]}

Choose the SINGLE most visually dramatic and scientifically interesting era to illustrate 
for this specific location. Prefer eras that produce LANDSCAPE scenes, not underground/abstract views.

Priority order for visual drama:
1. Ice Age glaciation (massive ice sheets, frozen tundra) — if the area was glaciated
2. Ancient seas/oceans (underwater scenes, marine life) — if sedimentary rocks present
3. Desert/dune landscapes — if sandstone is present  
4. Volcanic eruptions — ONLY if the area is actually volcanic (like Yellowstone, Hawaii)
5. Dense prehistoric forests — if in a formerly tropical region
6. Dramatically different coastline/sea level — for coastal areas

DO NOT choose underground magma chambers — they don't make good landscape images.

Respond with ONLY a JSON object, nothing else:
{{"era_name": "Pleistocene Ice Age",
  "years_ago": "20,000 years ago",
  "scene_description": "A massive glacier, hundreds of feet tall, grinding across the granite bedrock where Acadia National Park now stands. The ice sheet stretches to the horizon under a pale grey sky. No trees, no life — just raw ice and exposed rock being carved and polished by the immense frozen river.",
  "caption": "Pleistocene Ice Age, 20,000 years ago — A continental glacier carves the granite coastline that will become Acadia National Park"}}""",
    )
    
    # Parse the era response
    try:
        era_text = era_response.text.strip()
        era_text = era_text.replace("```json", "").replace("```", "").strip()
        era_data = json.loads(era_text)
    except Exception:
        era_data = {
            "era_name": "Ancient Past",
            "years_ago": "millions of years ago", 
            "scene_description": "A dramatic prehistoric landscape showing this location in a completely different geological era, with no signs of modern civilization.",
            "caption": "Deep time — this landscape millions of years in the past"
        }
    
    # Step 2: Generate image with a CLEAN prompt
    image_prompt = f"""Create a photorealistic landscape image:

{era_data['scene_description']}

Style: National Geographic illustration, cinematic wide-angle composition, dramatic lighting, 
sense of vast geological scale. Include sky and horizon. NO text or labels in the image."""

    time_travel_image_b64 = None
    caption = era_data.get("caption", "")
    
    try:
        img_response = await client.aio.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=image_prompt,
            config=GenerateContentConfig(
                response_modalities=[Modality.TEXT, Modality.IMAGE],
            ),
        )
        
        for part in img_response.candidates[0].content.parts:
            if part.text:
                if len(part.text.strip()) > 10:
                    caption = part.text.strip()
            elif part.inline_data:
                time_travel_image_b64 = base64.b64encode(
                    part.inline_data.data
                ).decode("utf-8")
    except Exception as e:
        print(f"Time-travel image generation failed: {e}")
        caption = "Time-travel visualization unavailable for this scene."
    
    return time_travel_image_b64, caption
