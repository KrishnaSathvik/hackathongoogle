# Trail Narrator — 4-Day Sprint Plan

## Gemini Live Agent Challenge | Creative Storyteller Track

**Deadline:** March 16, 2026 @ 5:00 PM PDT
**Track:** Creative Storyteller (Best prize: $10,000 + Google Cloud Next tickets)
**Also eligible for:** Grand Prize ($25K), Best Multimodal Integration ($5K), Best Innovation ($5K)

---

## Project Concept

Trail Narrator is an AI-powered national parks storytelling agent. Users upload trail photos or stream video, and the agent produces an immersive, mixed-media narrative — weaving together voice narration, generated "time-travel" imagery (what the landscape looked like millions of years ago), educational overlays, and interactive Q&A — all in a single cohesive flow.

**Persona:** "Ranger" — a warm, knowledgeable storyteller with the depth of a geologist and the wonder of a naturalist. Think David Attenborough meets a park ranger campfire talk.

---

## Mandatory Tech Requirements

| Requirement | How We Satisfy It |
|---|---|
| Gemini model | Gemini 2.5 Flash (Live API for voice + vision) + Gemini 3 Pro Image (time-travel imagery) |
| GenAI SDK or ADK | Google GenAI SDK (Python) for orchestration |
| Gemini interleaved/mixed output | Text narration + generated images + audio woven into single response stream |
| At least one Google Cloud service | Cloud Run (hosting) + Firestore (trail session data) + Cloud Storage (media assets) |
| Backend on Google Cloud | Cloud Run deployment |

---

## Tech Stack

- **Backend:** Python + FastAPI, Google GenAI SDK
- **Frontend:** Next.js (React) with Tailwind CSS
- **AI Models:** Gemini 2.5 Flash (Live API), Gemini 3 Pro Image generation
- **Cloud:** Google Cloud Run, Firestore, Cloud Storage
- **IaC (bonus points):** Terraform or gcloud deploy scripts in repo
- **Repo:** Public GitHub

---

## Submission Checklist

- [ ] Text description on Devpost (features, tech, data sources, learnings)
- [ ] Public GitHub repo with README + spin-up instructions
- [ ] Proof of Google Cloud deployment (screen recording of Cloud Run console)
- [ ] Architecture diagram (add to Devpost image carousel)
- [ ] Demo video (< 4 minutes, real working software, pitch the problem)
- [ ] **Bonus:** Medium post with #GeminiLiveAgentChallenge
- [ ] **Bonus:** IaC deployment scripts in repo
- [ ] **Bonus:** GDG membership link

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│              Next.js + Tailwind CSS                  │
│                                                     │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Photo     │  │ Voice    │  │ Mixed-Media      │  │
│  │ Upload /  │  │ Input /  │  │ Story Display    │  │
│  │ Camera    │  │ Output   │  │ (text+img+audio) │  │
│  └─────┬─────┘  └────┬─────┘  └────────▲─────────┘  │
│        │              │                 │            │
└────────┼──────────────┼─────────────────┼────────────┘
         │              │                 │
         ▼              ▼                 │
┌─────────────────────────────────────────┼────────────┐
│                 BACKEND (Cloud Run)      │            │
│              FastAPI + GenAI SDK         │            │
│                                         │            │
│  ┌──────────────────────────────────────┐│            │
│  │         Agent Orchestrator           ││            │
│  │                                      ││            │
│  │  1. Receive image/video + voice      ││            │
│  │  2. Gemini 2.5 Flash: Identify       ││            │
│  │     landscape, geology, flora/fauna  ││            │
│  │  3. Generate narration script        ││            │
│  │  4. Gemini 3 Pro Image: Create       ││            │
│  │     "time-travel" visuals            ││            │
│  │  5. Weave into interleaved stream    │┼────────────┘
│  │  6. Handle follow-up questions       ││
│  └──────────────┬───────────────────────┘│
│                 │                        │
│    ┌────────────┼────────────┐           │
│    ▼            ▼            ▼           │
│ Firestore   Cloud Storage  Gemini APIs   │
│ (sessions)  (media cache)  (LLM + Image) │
└──────────────────────────────────────────┘
```

---

## 4-Day Sprint

### DAY 1 — Thursday, March 12 (Today)
**Theme: Foundation + Core AI Pipeline**

**Morning (4 hrs)**
- [ ] Set up GitHub repo with README skeleton
- [ ] Set up Google Cloud project (enable APIs: Gemini, Cloud Run, Firestore, Cloud Storage)
- [ ] Request hackathon credits via the form: https://forms.gle/rKNPXA1o6XADvQGb7
- [ ] Initialize Python backend (FastAPI + GenAI SDK)
- [ ] Initialize Next.js frontend with Tailwind
- [ ] Study key resources:
  - GenAI SDK Live API examples: https://github.com/GoogleCloudPlatform/generative-ai/tree/main/gemini/multimodal-live-api
  - GenMedia Live sample app: https://github.com/GoogleCloudPlatform/generative-ai/tree/main/vision/sample-apps/genmedia-live
  - ADK bidi-streaming guide: https://google.github.io/adk-docs/streaming/dev-guide/part1/

**Afternoon (4 hrs)**
- [ ] Build core AI pipeline (no frontend yet, just test via API):
  - Image input → Gemini 2.5 Flash identifies landscape, geological features, flora/fauna
  - Generate narration text from identification results
  - Gemini 3 Pro Image generates "time-travel" visualization
  - Test with 3-4 sample national park photos
- [ ] Set up Firestore schema for session/trail data
- [ ] Get basic interleaved output working (text + image in single response)

**Day 1 Exit Criteria:** Can send a trail photo to your backend and get back a narration + generated time-travel image via API call.

---

### DAY 2 — Friday, March 13
**Theme: Frontend + Voice + Interleaved Experience**

**Morning (4 hrs)**
- [ ] Build frontend UI:
  - Photo upload / camera capture component
  - Mixed-media story display (scrolling narrative with inline images)
  - Audio playback for narration (use Gemini TTS or browser Web Speech API)
  - Loading states and transitions
- [ ] Connect frontend to backend API

**Afternoon (4 hrs)**
- [ ] Add voice interaction:
  - Voice input for follow-up questions ("What kind of rock is that?")
  - Voice output for narration
  - Use Gemini Live API for bidirectional audio if possible, or fall back to GenAI SDK + TTS
- [ ] Build the "story flow" — when user uploads multiple photos from a trail, the agent weaves them into a continuous narrative, not isolated responses
- [ ] Add the "Ranger" persona — distinct voice, warm storytelling tone, educational depth
- [ ] Test end-to-end with real national park photos (use your own if you have them)

**Day 2 Exit Criteria:** Full working flow — upload photo → see/hear narration + time-travel image → ask voice follow-up → get voice response.

---

### DAY 3 — Saturday, March 14
**Theme: Polish + Deploy + Content**

**Morning (4 hrs)**
- [ ] Deploy backend to Cloud Run
- [ ] Set up Cloud Storage for media caching
- [ ] Write Terraform/gcloud deployment scripts (bonus points)
- [ ] Test deployed version end-to-end
- [ ] Fix bugs from Day 2

**Afternoon (4 hrs)**
- [ ] Polish the UI:
  - Smooth transitions between narration segments
  - Image loading animations
  - Mobile-responsive layout
  - "Ranger" branding/theme (earthy colors, park-inspired design)
- [ ] Create architecture diagram (clean, presentable version)
- [ ] Record GCP deployment proof (screen recording of Cloud Run console)
- [ ] Start writing the Medium post:
  - Title: something like "Building Trail Narrator: An AI National Parks Storyteller with Gemini Live API"
  - Include architecture diagram, code snippets, learnings
  - Include required hackathon disclosure language
  - Add #GeminiLiveAgentChallenge

**Day 3 Exit Criteria:** Deployed and working on Cloud Run. Architecture diagram done. Medium post 70% drafted.

---

### DAY 4 — Sunday, March 15
**Theme: Demo Video + Submission + Ship**

**Morning (4 hrs)**
- [ ] Script the demo video (under 4 minutes):
  - 0:00-0:30 — Problem: National park visits are rich visual experiences but most people miss the deep story behind what they're seeing
  - 0:30-1:00 — Solution: Trail Narrator — your personal AI park ranger that sees your trail photos, tells the geological and natural story, and shows you what this place looked like millions of years ago
  - 1:00-3:00 — Live demo: Upload a photo → narration plays → time-travel image appears → ask a voice follow-up → get answer → upload second photo → continuous story weaves together
  - 3:00-3:30 — Architecture overview (show diagram)
  - 3:30-3:50 — Tech stack and what you learned
- [ ] Record demo video (OBS or screen recording + voiceover)
- [ ] Edit video (keep tight, under 4 minutes)

**Afternoon (4 hrs)**
- [ ] Finalize GitHub README:
  - Project overview
  - Architecture diagram
  - Tech stack
  - Setup/spin-up instructions (judges need to reproduce)
  - Screenshots/GIFs
- [ ] Complete Devpost submission:
  - Text description
  - Link to GitHub repo
  - Upload demo video
  - Upload architecture diagram to image carousel
  - Upload GCP proof recording
  - Select "Creative Storyteller" category
- [ ] Publish Medium post
- [ ] Share on LinkedIn and X with #GeminiLiveAgentChallenge
- [ ] Join a GDG chapter and add profile link to submission
- [ ] Final review of everything before 5 PM PDT deadline on March 16

**Day 4 Exit Criteria:** Everything submitted on Devpost. Medium post published. Social posts live.

---

## Buffer Day — Monday, March 16 (Deadline Day)

You have until 5:00 PM PDT. Use the morning for:
- [ ] Any last-minute fixes
- [ ] Re-test deployed version
- [ ] Final submission review
- [ ] Double-check all links work (GitHub, demo video, GCP proof, Medium post)

---

## Key Resources

| Resource | URL |
|---|---|
| Hackathon page | https://geminiliveagentchallenge.devpost.com/ |
| Official rules | https://geminiliveagentchallenge.devpost.com/rules |
| Resources page | https://geminiliveagentchallenge.devpost.com/resources |
| Request GCP credits | https://forms.gle/rKNPXA1o6XADvQGb7 |
| Live API examples | https://github.com/GoogleCloudPlatform/generative-ai/tree/main/gemini/multimodal-live-api |
| GenMedia Live sample | https://github.com/GoogleCloudPlatform/generative-ai/tree/main/vision/sample-apps/genmedia-live |
| Image/Video gen notebooks | https://github.com/GoogleCloudPlatform/generative-ai/tree/main/vision |
| ADK bidi-streaming guide | https://google.github.io/adk-docs/streaming/dev-guide/part1/ |
| ADK bidi-streaming demo | https://github.com/google/adk-samples/tree/main/python/agents/bidi-demo |
| Gemini Live API examples | https://github.com/google-gemini/gemini-live-api-examples |
| GenAI SDK docs | https://ai.google.dev/gemini-api/docs/models |
| GDG signup (bonus) | https://gdg.community.dev/ |

---

## Judging Optimization Notes

**Innovation & Multimodal UX (40% weight) — maximize this:**
- The "time-travel" image generation is the differentiator. No one else will show what a canyon looked like 270 million years ago.
- Give "Ranger" a distinct, warm persona — not a generic AI voice.
- Make it feel like a continuous story, not turn-based Q&A.
- Emphasize the interleaved output: text + images + audio flowing together seamlessly.

**Technical Implementation (30% weight):**
- Clean agent architecture with clear separation of concerns.
- Robust error handling (what if image identification is uncertain? Agent says "I'm not sure, but it looks like..." — graceful degradation).
- Use grounding where possible to avoid hallucinations about geological facts.
- Clean, well-documented code.

**Demo & Presentation (30% weight):**
- Lead with the problem (people miss the story behind landscapes).
- Show real software working in real-time — no mockups.
- Architecture diagram must be crystal clear.
- Keep the video tight — every second should add value.

---

## Sample National Park Photos to Test With

Use photos from parks with rich geological stories:
- Grand Canyon (layered geological history)
- Zion National Park (Navajo sandstone, cross-bedding)
- Yellowstone (geothermal features, volcanic history)
- Arches National Park (natural arch formation)
- Badlands (erosion layers, fossil beds)
- Glacier National Park (glacial carving)

If you have your own photos from trips, use those — authenticity matters for the demo.
