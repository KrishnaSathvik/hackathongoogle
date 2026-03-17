"""
Trail Narrator - Core Narration Agent
Handles: image analysis → narration generation → time-travel image creation
"""

import base64
import json
from io import BytesIO
from typing import Optional

from google import genai
from google.genai import types
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


def _extract_gps(image: Image.Image) -> str:
    """Extract GPS coordinates from EXIF data and return a context string."""
    try:
        exif = image.getexif()
        gps_ifd = exif.get_ifd(34853)  # GPS IFD tag
        if not gps_ifd:
            return ""
        # Tags: 2=Latitude, 1=LatRef, 4=Longitude, 3=LonRef
        lat_dms = gps_ifd.get(2)
        lat_ref = gps_ifd.get(1, "N")
        lon_dms = gps_ifd.get(4)
        lon_ref = gps_ifd.get(3, "W")
        if not lat_dms or not lon_dms:
            return ""

        def dms_to_decimal(dms, ref):
            d, m, s = [float(x) for x in dms]
            decimal = d + m / 60 + s / 3600
            return -decimal if ref in ("S", "W") else decimal

        lat = dms_to_decimal(lat_dms, lat_ref)
        lon = dms_to_decimal(lon_dms, lon_ref)
        return f"GPS coordinates: {lat:.4f}, {lon:.4f}"
    except Exception:
        return ""


async def _identify_location(
    image: Image.Image,
    gps_context: str,
    trail_context: Optional[str] = None,
) -> dict:
    """
    Step 1: Identify the location using Google Search grounding for accuracy.
    Returns a dict with location_name, rock_types, geological_era, etc.
    """
    context_parts = []
    if gps_context:
        context_parts.append(f"The photo has embedded {gps_context}. Use this to help identify the exact location.")
    if trail_context:
        context_parts.append(f"The user says this is from: {trail_context}")
    extra_context = "\n".join(context_parts)

    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            image,
            f"""You are an expert geologist and naturalist. Identify this location precisely.

{extra_context}

Use Google Search to verify your identification. Cross-reference visual features with known landmarks.

Respond with ONLY a JSON object:
{{"location_name": "Specific Name, Park, State/Country",
 "location_type": "e.g. rocky coastline, canyon, alpine meadow",
 "rock_types": ["granite", "sandstone"],
 "geological_era": "Devonian (400 MYA)",
 "key_features": ["glacial scouring", "sea stacks"],
 "flora": ["Douglas fir", "manzanita"],
 "fauna_signs": ["osprey nest"],
 "fun_fact": "One surprising, specific, numbers-driven fact about this place",
 "confidence": "high/medium/low"}}""",
        ],
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
        ),
    )

    # Extract grounding sources
    web_sources = []
    try:
        gm = response.candidates[0].grounding_metadata
        if gm and gm.grounding_chunks:
            for chunk in gm.grounding_chunks:
                if chunk.web:
                    web_sources.append({"title": chunk.web.title, "uri": chunk.web.uri})
        if gm and gm.web_search_queries:
            print(f"[Grounding] Search queries: {gm.web_search_queries}")
    except Exception:
        pass
    if web_sources:
        print(f"[Grounding] Sources: {[s['title'] for s in web_sources]}")

    # Parse identification JSON
    raw = response.text.strip().replace("```json", "").replace("```", "").strip()
    try:
        identification = json.loads(raw)
    except Exception:
        identification = {"location_name": "Unknown Location", "confidence": "low", "raw_response": raw}

    identification["web_sources"] = web_sources
    return identification


async def _generate_narration(
    image: Image.Image,
    identification: dict,
    previous_narration: Optional[str] = None,
) -> str:
    """
    Step 2: Generate narration using verified identification as context.
    The model doesn't need to guess — it has confirmed facts.
    """
    id_context = json.dumps(identification, indent=2)

    continuation = ""
    if previous_narration:
        continuation = f"\n\nYou are continuing a trail story. Previous narration (connect naturally, don't repeat): {previous_narration[-400:]}"

    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            image,
            f"""{RANGER_SYSTEM_PROMPT}

Here is the VERIFIED identification for this location (use these facts, do not guess):
{id_context}
{continuation}

Write the narration following the structure above (2 short paragraphs + closing line, MAX 150 words).
Do NOT include any identification tags or JSON — just the narration text.""",
        ],
    )
    return response.text.strip()


def _open_and_prepare_image(image_bytes: bytes) -> Image.Image:
    """Open image bytes, handle HEIC, convert modes, and resize for API."""
    try:
        image = Image.open(BytesIO(image_bytes))
    except Exception:
        try:
            import pillow_heif
            heif_file = pillow_heif.read_heif(image_bytes)
            image = Image.frombytes(
                heif_file.mode, heif_file.size, heif_file.data,
                "raw", heif_file.mode, heif_file.stride,
            )
        except Exception:
            raise ValueError("Unsupported image format")

    if image.mode in ("RGBA", "P", "LA"):
        image = image.convert("RGB")

    max_dim = 1536
    if max(image.size) > max_dim:
        image.thumbnail((max_dim, max_dim), Image.LANCZOS)

    return image


async def identify_and_narrate(
    image_bytes: bytes,
    trail_context: Optional[str] = None,
    previous_narration: Optional[str] = None,
) -> dict:
    """
    Fast path: Single Gemini call with Search grounding to identify AND narrate.
    Returns narration + identification (~15-25s instead of ~50-60s).
    """
    import asyncio

    image = _open_and_prepare_image(image_bytes)

    gps_context = _extract_gps(image)
    if gps_context:
        print(f"[GPS] Extracted: {gps_context}")

    context_parts = []
    if gps_context:
        context_parts.append(f"The photo has embedded {gps_context}.")
    if trail_context:
        context_parts.append(f"The user says this is from: {trail_context}")
    extra_context = "\n".join(context_parts)

    continuation = ""
    if previous_narration:
        continuation = f"\nYou are continuing a trail story. Previous narration (connect naturally, don't repeat): {previous_narration[-400:]}"

    # Single combined call with Google Search grounding
    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            image,
            f"""{RANGER_SYSTEM_PROMPT}

{extra_context}
{continuation}

Use Google Search to verify the location. Then do TWO things:

1. IDENTIFY: Figure out exactly what and where this is.
2. NARRATE: Write the Ranger narration (2 short paragraphs + closing line, MAX 150 words).

Respond with ONLY this JSON (no markdown, no code fences):
{{"location_name": "Specific Name, Park, State/Country",
 "location_type": "e.g. rocky coastline, canyon, alpine meadow",
 "rock_types": ["granite", "sandstone"],
 "geological_era": "Devonian (400 MYA)",
 "key_features": ["glacial scouring", "sea stacks"],
 "flora": ["Douglas fir", "manzanita"],
 "fauna_signs": ["osprey nest"],
 "fun_fact": "One surprising, specific, numbers-driven fact about this place",
 "confidence": "high/medium/low",
 "narration": "Your full Ranger narration here. Two paragraphs + closing line."}}""",
        ],
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
        ),
    )

    # Extract grounding sources
    web_sources = []
    try:
        gm = response.candidates[0].grounding_metadata
        if gm and gm.grounding_chunks:
            for chunk in gm.grounding_chunks:
                if chunk.web:
                    web_sources.append({"title": chunk.web.title, "uri": chunk.web.uri})
        if gm and gm.web_search_queries:
            print(f"[Grounding] Search queries: {gm.web_search_queries}")
    except Exception:
        pass
    if web_sources:
        print(f"[Grounding] Sources: {[s['title'] for s in web_sources]}")

    # Parse combined response
    raw = response.text.strip().replace("```json", "").replace("```", "").strip()
    try:
        result = json.loads(raw)
    except Exception:
        # Fallback: run the old two-step pipeline
        print("[Combined] JSON parse failed, falling back to two-step pipeline", flush=True)
        identification = await _identify_location(image, gps_context, trail_context)
        narration_text = await _generate_narration(image, identification, previous_narration)
        identification["web_sources"] = web_sources
        return {
            "narration": narration_text,
            "identification": json.dumps(identification),
            "era": identification.get("geological_era", ""),
        }

    narration_text = result.pop("narration", "")
    result["web_sources"] = web_sources
    identification_json = json.dumps(result)
    era = result.get("geological_era", "")

    print(f"[Combined] {result.get('location_name', 'Unknown')} — confidence: {result.get('confidence', '?')}", flush=True)
    print("[Narration] Done", flush=True)

    return {
        "narration": narration_text,
        "identification": identification_json,
        "era": era,
    }


async def generate_past_image(narration: str, identification: str) -> dict:
    """Generate the time-travel (past) image for a narration."""
    image_b64, caption = await _generate_time_travel_image(narration, identification)
    print(f"[Past Image] {'OK' if image_b64 else 'FAILED'}", flush=True)
    return {"image": image_b64, "caption": caption}


async def generate_future_image(narration: str, identification: str) -> dict:
    """Generate the future projection image for a narration."""
    try:
        image_b64, caption = await _generate_future_image(narration, identification)
    except Exception as e:
        print(f"[Future Image] Top-level error: {e}", flush=True)
        image_b64, caption = None, "Future visualization unavailable for this scene."
    print(f"[Future Image] {'OK' if image_b64 else 'FAILED'}", flush=True)
    return {"image": image_b64, "caption": caption}


async def analyze_and_narrate(
    image_bytes: bytes,
    trail_context: Optional[str] = None,
    previous_narration: Optional[str] = None,
) -> dict:
    """
    Core pipeline: Analyze trail photo → Generate narration → Create time-travel image
    """
    # Open image with HEIC fallback
    try:
        image = Image.open(BytesIO(image_bytes))
    except Exception:
        # Try HEIC/HEIF format
        try:
            import pillow_heif
            heif_file = pillow_heif.read_heif(image_bytes)
            image = Image.frombytes(
                heif_file.mode, heif_file.size, heif_file.data,
                "raw", heif_file.mode, heif_file.stride,
            )
        except Exception:
            raise ValueError("Unsupported image format")

    # Convert RGBA/palette images to RGB for Gemini compatibility
    if image.mode in ("RGBA", "P", "LA"):
        image = image.convert("RGB")

    # Resize large images to avoid API timeouts
    max_dim = 1536
    if max(image.size) > max_dim:
        image.thumbnail((max_dim, max_dim), Image.LANCZOS)

    # Step 0: Extract GPS from EXIF
    gps_context = _extract_gps(image)
    if gps_context:
        print(f"[GPS] Extracted: {gps_context}")

    # Step 1: Identify location with Google Search grounding
    identification = await _identify_location(image, gps_context, trail_context)
    identification_json = json.dumps(identification)
    era = identification.get("geological_era", "")
    print(f"[Identification] {identification.get('location_name', 'Unknown')} — confidence: {identification.get('confidence', '?')}", flush=True)

    # Step 2: Generate narration using verified identification
    narration_text = await _generate_narration(image, identification, previous_narration)
    print("[Narration] Done", flush=True)

    # Step 3: Generate past image
    time_travel_image_b64, time_travel_caption = await _generate_time_travel_image(
        narration_text, identification_json
    )
    print(f"[Past Image] {'OK' if time_travel_image_b64 else 'FAILED'}", flush=True)

    # Step 4: Generate future image (sequential to avoid rate limits)
    try:
        future_image_b64, future_caption = await _generate_future_image(
            narration_text, identification_json
        )
    except Exception as e:
        print(f"[Future Image] Top-level error: {e}", flush=True)
        future_image_b64, future_caption = None, "Future visualization unavailable for this scene."
    print(f"[Future Image] {'OK' if future_image_b64 else 'FAILED'}", flush=True)

    return {
        "narration": narration_text,
        "identification": identification_json,
        "time_travel_image": time_travel_image_b64,
        "time_travel_caption": time_travel_caption,
        "future_image": future_image_b64,
        "future_caption": future_caption,
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

    # Try models in order of quality — location must be 'global' for these
    image_models = [
        "gemini-3-pro-image-preview",
        "gemini-3.1-flash-image",
        "gemini-2.5-flash-image",
    ]

    for model_name in image_models:
        try:
            img_response = await client.aio.models.generate_content(
                model=model_name,
                contents=image_prompt,
                config=GenerateContentConfig(
                    response_modalities=[Modality.TEXT, Modality.IMAGE],
                ),
            )

            for part in img_response.candidates[0].content.parts:
                if part.inline_data:
                    time_travel_image_b64 = base64.b64encode(
                        part.inline_data.data
                    ).decode("utf-8")

            if time_travel_image_b64:
                print(f"Time-travel image generated with model: {model_name}", flush=True)
                break
        except Exception as e:
            print(f"Image model {model_name} failed: {e}", flush=True)
            continue

    if not time_travel_image_b64:
        caption = "Time-travel visualization unavailable for this scene."

    return time_travel_image_b64, caption


async def _generate_future_image(narration: str, identification: str) -> tuple[str | None, str]:
    """
    Two-step future projection image generation:
    1. Text model picks the most scientifically plausible future scenario
    2. Image model generates from the clean prompt
    """

    # Step 1: Get a clean visual prompt for the future
    future_response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"""You are a climate scientist and geological futurist planning a National Geographic illustration.

Given this geological context about a location:
{identification}

Narration excerpt: {narration[:400]}

Choose the SINGLE most scientifically plausible and visually dramatic FUTURE scenario for this
specific location. Base your choice on real climate projections, geological trends, and ecological science.

Priority order by location type:
1. Coastal/low-elevation → sea level rise (flooded landscapes, submerged trails, new coastlines)
2. Glacial/alpine → glacier retreat, new lakes, treeline advancing uphill
3. Desert/arid → further desertification OR greening depending on latitude
4. Mountain ranges → continued erosion smoothing peaks over millions of years
5. Forest/temperate → species migration, new dominant tree species, subtropical shift
6. Volcanic regions → future eruption reshaping the landscape

Pick a specific, concrete timeframe — NOT vague. Use 10,000 years for geological changes,
200-500 years for climate-driven changes, or millions of years for erosion/tectonic scenarios.

Respond with ONLY a JSON object, nothing else:
{{"era_name": "Post-Glacial Warming",
  "years_from_now": "10,000 years from now",
  "scene_description": "The granite coast of what was once Acadia National Park, now 30 feet underwater. Waves lap against submerged cliff tops. A new shoreline has formed a mile inland, with subtropical vegetation — palms and broadleaf evergreens — growing where spruce forests once stood. Coral formations are beginning to colonize the drowned granite boulders.",
  "caption": "10,000 years from now — Rising seas submerge Acadia's granite coast as subtropical forests reclaim the new shoreline"}}""",
    )

    # Parse the future response
    try:
        future_text = future_response.text.strip()
        future_text = future_text.replace("```json", "").replace("```", "").strip()
        future_data = json.loads(future_text)
    except Exception:
        future_data = {
            "era_name": "Distant Future",
            "years_from_now": "thousands of years from now",
            "scene_description": "A dramatically transformed version of this landscape shaped by climate change, erosion, and ecological succession — no signs of modern civilization remain.",
            "caption": "The distant future — this landscape reshaped by time and climate"
        }

    # Step 2: Generate image with a CLEAN prompt
    image_prompt = f"""Create a photorealistic landscape image:

{future_data['scene_description']}

Style: National Geographic illustration, cinematic wide-angle composition, dramatic lighting,
sense of vast geological scale. Include sky and horizon. NO text or labels in the image.
This is a FUTURE projection — the landscape should look plausible and scientifically grounded, not apocalyptic or sci-fi."""

    future_image_b64 = None
    caption = future_data.get("caption", "")

    image_models = [
        "gemini-3-pro-image-preview",
        "gemini-3.1-flash-image",
        "gemini-2.5-flash-image",
    ]

    for model_name in image_models:
        try:
            img_response = await client.aio.models.generate_content(
                model=model_name,
                contents=image_prompt,
                config=GenerateContentConfig(
                    response_modalities=[Modality.TEXT, Modality.IMAGE],
                ),
            )

            for part in img_response.candidates[0].content.parts:
                if part.inline_data:
                    future_image_b64 = base64.b64encode(
                        part.inline_data.data
                    ).decode("utf-8")

            if future_image_b64:
                print(f"Future image generated with model: {model_name}", flush=True)
                break
        except Exception as e:
            print(f"Future image model {model_name} failed: {e}", flush=True)
            continue

    if not future_image_b64:
        caption = "Future visualization unavailable for this scene."

    return future_image_b64, caption
