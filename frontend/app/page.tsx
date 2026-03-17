"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Camera,
  Upload,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Mountain,
  Layers,
  Leaf,
  Clock,
  ImagePlus,
  Sparkles,
  X,
  MapPin,
  Trash2,
  Search,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ───────────────────────────────────────────────────

interface NarrationEntry {
  id: string;
  narration: string;
  identification: string;
  timeTravelImage: string | null;
  timeTravelCaption: string;
  futureImage: string | null;
  futureCaption: string;
  era: string;
  uploadedImage: string; // base64 data URL of the original photo
  timestamp: Date;
  pastImageLoading?: boolean;
  futureImageLoading?: boolean;
}

interface FollowUpEntry {
  id: string;
  question: string;
  answer: string;
  timestamp: Date;
}

type StoryEntry =
  | { type: "narration"; data: NarrationEntry }
  | { type: "followup"; data: FollowUpEntry };

interface ArchivedSession {
  id: string;
  trailName: string;
  story: StoryEntry[];
  sessionId: string;
  savedAt: string;
}

// ─── Main Page ───────────────────────────────────────────────

export default function TrailNarratorPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [trailName, setTrailName] = useState("");
  const [story, setStory] = useState<StoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const [view, setView] = useState<"landing" | "explore">("landing");
  const [archive, setArchive] = useState<ArchivedSession[]>([]);
  const [publicStories, setPublicStories] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const storyEndRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const recognitionRef = useRef<any>(null);

  const hasStory = story.length > 0;

  const showToast = useCallback((message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  // Fetch public stories on mount
  useEffect(() => {
    fetch(`${API_URL}/api/stories`)
      .then((r) => r.json())
      .then((data) => setPublicStories(data))
      .catch(() => {});
  }, []);

  // Restore persisted state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("trail-narrator-state");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.story?.length) setStory(parsed.story);
        if (parsed.sessionId) setSessionId(parsed.sessionId);
        if (parsed.trailName) setTrailName(parsed.trailName);
      }
    } catch {}
    try {
      const savedArchive = localStorage.getItem("trail-narrator-archive");
      if (savedArchive) setArchive(JSON.parse(savedArchive));
    } catch {}
  }, []);

  // Persist state on every story/session change
  useEffect(() => {
    if (story.length > 0 || sessionId) {
      try {
        localStorage.setItem(
          "trail-narrator-state",
          JSON.stringify({ story, sessionId, trailName })
        );
      } catch {}
    }
  }, [story, sessionId, trailName]);

  // Auto-scroll to latest entry
  useEffect(() => {
    if (storyEndRef.current) {
      storyEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [story]);

  // Loading steps — fast narration path only (images load in background)
  const loadingSteps = [
    { message: "Analyzing your photo", detail: "Identifying landscape and features" },
    { message: "Researching geology", detail: "Matching rock types and formations" },
    { message: "Crafting the narration", detail: "Ranger is writing your story" },
  ];

  // Step durations — spread across ~12s so we don't outrun the fast API
  const stepDurations = [4000, 5000, 999999]; // last step never auto-advances

  useEffect(() => {
    if (!isLoading) {
      setLoadingStep(0);
      return;
    }
    setLoadingStep(0);
    setLoadingMessage(loadingSteps[0].message);

    const timers: NodeJS.Timeout[] = [];
    let cumulative = 0;

    for (let i = 1; i < loadingSteps.length; i++) {
      cumulative += stepDurations[i - 1];
      const step = i;
      timers.push(
        setTimeout(() => {
          setLoadingStep(step);
          setLoadingMessage(loadingSteps[step].message);
        }, cumulative)
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [isLoading]);

  // Elapsed time counter
  useEffect(() => {
    if (!isLoading) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(0);
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // ─── Archive Helpers ─────────────────────────────────────────

  const saveToArchive = useCallback(() => {
    if (story.length === 0) return;
    // Don't duplicate if this session is already archived
    if (archive.some((a) => a.sessionId === sessionId)) return;
    // Strip large base64 images to avoid localStorage quota errors
    const lightStory = story.map((s) => {
      if (s.type === "narration") {
        return {
          ...s,
          data: {
            ...s.data,
            uploadedImage: "",
            timeTravelImage: null,
            futureImage: null,
          },
        };
      }
      return s;
    });
    const entry: ArchivedSession = {
      id: crypto.randomUUID(),
      trailName,
      story: lightStory,
      sessionId: sessionId || "",
      savedAt: new Date().toISOString(),
    };
    setArchive((prev) => {
      const updated = [entry, ...prev].slice(0, 10);
      try {
        localStorage.setItem("trail-narrator-archive", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [story, trailName, sessionId, archive]);

  const restoreFromArchive = useCallback((entry: ArchivedSession) => {
    setStory(entry.story);
    setSessionId(entry.sessionId);
    setTrailName(entry.trailName);
  }, []);

  const clearArchive = useCallback(() => {
    setArchive([]);
    localStorage.removeItem("trail-narrator-archive");
  }, []);

  const clearSession = useCallback(() => {
    saveToArchive();
    localStorage.removeItem("trail-narrator-state");
    setStory([]);
    setSessionId(null);
    setTrailName("");
    setPreviewImage(null);
    setView("explore");
  }, [saveToArchive]);

  // ─── Upload & Narrate ──────────────────────────────────────

  const handleImageUpload = useCallback(
    async (file: File) => {
      const isHeic = file.type === "image/heic" || file.type === "image/heif" ||
        file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");

      if (!file.type.startsWith("image/") && !isHeic) {
        setError("Please upload an image file.");
        return;
      }

      setError(null);
      setIsLoading(true);

      // Convert HEIC to JPEG for browser compatibility
      let displayFile = file;
      if (isHeic) {
        try {
          const heic2any = (await import("heic2any")).default;
          const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
          const converted = Array.isArray(blob) ? blob[0] : blob;
          displayFile = new File([converted], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
        } catch (e) {
          console.warn("HEIC conversion failed, sending original:", e);
        }
      }

      // Create preview
      const reader = new FileReader();
      const uploadedImage: string = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(displayFile);
      });
      setPreviewImage(uploadedImage);

      try {
        // ── Phase 1: Fast narration (~10-15s) ──
        const formData = new FormData();
        formData.append("image", displayFile);
        if (sessionId) formData.append("session_id", sessionId);
        if (trailName) formData.append("trail_name", trailName);

        const res = await fetch(`${API_URL}/api/narrate`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();

        if (!sessionId) setSessionId(data.session_id);

        const entryId = crypto.randomUUID();
        const entry: NarrationEntry = {
          id: entryId,
          narration: data.narration,
          identification: data.identification,
          timeTravelImage: null,
          timeTravelCaption: "",
          futureImage: null,
          futureCaption: "",
          era: data.era,
          uploadedImage,
          timestamp: new Date(),
          pastImageLoading: true,
          futureImageLoading: true,
        };

        setStory((prev) => [...prev, { type: "narration", data: entry }]);
        setIsLoading(false);

        // Helper to update a specific narration entry in the story
        const updateEntry = (updates: Partial<NarrationEntry>) => {
          setStory((prev) =>
            prev.map((s) =>
              s.type === "narration" && s.data.id === entryId
                ? { ...s, data: { ...s.data, ...updates } }
                : s
            )
          );
        };

        // Track image results for auto-publish
        let pastImg: string | null = null;
        let pastCap = "";
        let futureImg: string | null = null;
        let futureCap = "";

        // ── Phase 2: Past image (fire immediately, 3 min timeout) ──
        try {
          const pastRes = await fetch(`${API_URL}/api/generate-past-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: data.session_id,
              narration: data.narration,
              identification: data.identification,
            }),
            signal: AbortSignal.timeout(180_000),
          });
          if (pastRes.ok) {
            const pastData = await pastRes.json();
            pastImg = pastData.image;
            pastCap = pastData.caption;
            updateEntry({
              timeTravelImage: pastData.image,
              timeTravelCaption: pastData.caption,
              pastImageLoading: false,
            });
            if (pastData.image) showToast("Ancient landscape ready — tap Past to view");
          } else {
            const errText = await pastRes.text().catch(() => "");
            console.error("[Past Image] HTTP error:", pastRes.status, errText);
            updateEntry({ pastImageLoading: false, timeTravelCaption: "Past visualization unavailable." });
          }
        } catch (e) {
          console.error("[Past Image] Fetch error:", e);
          updateEntry({ pastImageLoading: false, timeTravelCaption: "Past visualization unavailable." });
        }

        // ── Phase 3: Future image (fire after past, 3 min timeout) ──
        try {
          const futureRes = await fetch(`${API_URL}/api/generate-future-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: data.session_id,
              narration: data.narration,
              identification: data.identification,
            }),
            signal: AbortSignal.timeout(180_000),
          });
          if (futureRes.ok) {
            const futureData = await futureRes.json();
            futureImg = futureData.image;
            futureCap = futureData.caption;
            updateEntry({
              futureImage: futureData.image,
              futureCaption: futureData.caption,
              futureImageLoading: false,
            });
            if (futureData.image) showToast("Future projection ready — tap Future to view");
          } else {
            const errText = await futureRes.text().catch(() => "");
            console.error("[Future Image] HTTP error:", futureRes.status, errText);
            updateEntry({ futureImageLoading: false, futureCaption: "Future visualization unavailable." });
          }
        } catch (e) {
          console.error("[Future Image] Fetch error:", e);
          updateEntry({ futureImageLoading: false, futureCaption: "Future visualization unavailable." });
        }

        // ── Auto-publish to public gallery ──
        try {
          await fetch(`${API_URL}/api/stories`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trail_name: trailName || "Trail Exploration",
              narration: data.narration,
              identification: data.identification,
              era: data.era,
              past_image: pastImg,
              past_caption: pastCap,
              future_image: futureImg,
              future_caption: futureCap,
            }),
          });
        } catch {}
      } catch (err: any) {
        setError(err.message || "Failed to narrate. Is the backend running?");
        setIsLoading(false);
      }
    },
    [sessionId, trailName, showToast]
  );

  // ─── Follow-up Question ────────────────────────────────────

  const handleAskQuestion = useCallback(async () => {
    if (!question.trim() || !sessionId) return;

    const q = question.trim();
    const entryId = crypto.randomUUID();
    setQuestion("");
    setIsAsking(true);
    setError(null);

    // Show the question bubble immediately with a loading answer
    const pendingEntry: FollowUpEntry = {
      id: entryId,
      question: q,
      answer: "",
      timestamp: new Date(),
    };
    setStory((prev) => [...prev, { type: "followup", data: pendingEntry }]);

    try {
      const res = await fetch(`${API_URL}/api/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, question: q }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();

      // Update the existing entry with the real answer
      setStory((prev) =>
        prev.map((s) =>
          s.type === "followup" && s.data.id === entryId
            ? { ...s, data: { ...s.data, answer: data.answer } }
            : s
        )
      );
    } catch (err: any) {
      // Remove the pending entry on error
      setStory((prev) => prev.filter((s) => !(s.type === "followup" && s.data.id === entryId)));
      setError(err.message || "Failed to get answer.");
    } finally {
      setIsAsking(false);
    }
  }, [question, sessionId]);

  // ─── Voice Input (Web Speech API) ──────────────────────────

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuestion(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  // ─── Text-to-Speech (Gemini TTS with browser fallback) ─────

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsCacheRef = useRef<Map<string, string>>(new Map());

  const speakNarration = useCallback(
    async (text: string) => {
      // Stop if currently playing
      if (isSpeaking) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current = null;
        }
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setTtsLoading(false);
        return;
      }

      setTtsLoading(true);
      const cacheKey = text.slice(0, 200);

      try {
        let blobUrl = ttsCacheRef.current.get(cacheKey);

        if (!blobUrl) {
          // Try Gemini TTS first
          const res = await fetch(`${API_URL}/api/tts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text.slice(0, 3000) }), // TTS has input limits
          });

          if (!res.ok) throw new Error("TTS API failed");

          const data = await res.json();
          // Use Blob URL instead of data URL for reliable playback of large audio
          const audioBytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
          const blob = new Blob([audioBytes], { type: data.mime_type });
          blobUrl = URL.createObjectURL(blob);
          ttsCacheRef.current.set(cacheKey, blobUrl);
        }

        const audio = new Audio(blobUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          setTtsLoading(false);
          audioRef.current = null;
        };
        setTtsLoading(false);
        setIsSpeaking(true);
        await audio.play();
      } catch (err) {
        // Fallback to browser TTS
        console.warn("Gemini TTS failed, falling back to browser TTS:", err);
        setTtsLoading(false);
        setIsSpeaking(true);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 0.95;
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      }
    },
    [isSpeaking]
  );

  // ─── Drag & Drop ──────────────────────────────────────────

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleImageUpload(file);
    },
    [handleImageUpload]
  );

  // ─── Parse identification JSON ─────────────────────────────

  const parseIdentification = (
    raw: string
  ): Record<string, any> | null => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="min-h-dvh flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-[#e0d0b5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {(hasStory || view === "explore") && (
              <button
                onClick={() => {
                  if (hasStory) clearSession();
                  else setView("landing");
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#f0e8db] transition-colors text-[#714a34]"
                title="Back to home"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <img src="/logo.png" alt="Trail Narrator" className="w-8 h-8 rounded-full object-cover" />
            <div>
              <h1 className="text-sm font-semibold tracking-wide text-[#331f16]">
                Trail Narrator
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasStory && (
              <span className="text-xs text-[#8a7a66] hidden sm:block">
                {story.filter((s) => s.type === "narration").length} photo
                {story.filter((s) => s.type === "narration").length !== 1
                  ? "s"
                  : ""}
              </span>
            )}
            {hasStory && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-3 bg-[#f0e8db] hover:bg-[#e0d0b5] rounded-lg flex items-center gap-1.5 text-xs font-medium text-[#714a34] transition-colors"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add Photo</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1">
        {hasStory ? (
          <StoryView
            story={story}
            isLoading={isLoading}
            loadingMessage={loadingMessage}
            speakNarration={speakNarration}
            isSpeaking={isSpeaking}
            ttsLoading={ttsLoading}
            storyEndRef={storyEndRef}
            parseIdentification={parseIdentification}
          />
        ) : view === "landing" ? (
          <LandingPage
            archive={archive}
            publicStories={publicStories}
            onStartExploring={() => setView("explore")}
            onRestoreSession={restoreFromArchive}
            onClearArchive={clearArchive}
          />
        ) : (
          <WelcomeScreen
            trailName={trailName}
            setTrailName={setTrailName}
            onUpload={handleImageUpload}
            fileInputRef={fileInputRef}
            dragActive={dragActive}
            handleDrag={handleDrag}
            handleDrop={handleDrop}
            isLoading={isLoading}
            loadingMessage={loadingMessage}
            loadingStep={loadingStep}
            elapsedSeconds={elapsedSeconds}
            previewImage={previewImage}
            error={error}
            setError={setError}
          />
        )}
      </main>

      {/* ── Bottom Input Bar (shown when story exists) ── */}
      {hasStory && (
        <div className="sticky bottom-0 bg-[#FDFBF7]/90 backdrop-blur-md border-t border-[#e0d0b5] p-3 sm:p-4">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <button
              onClick={toggleListening}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                isListening
                  ? "bg-[#2c6b3e] text-white"
                  : "bg-[#f0e8db] text-[#714a34] hover:bg-[#e0d0b5]"
              }`}
              title={isListening ? "Stop listening" : "Voice input"}
            >
              {isListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            <div className="flex-1 relative">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
                placeholder="Ask Ranger a question..."
                className="w-full h-10 pl-4 pr-10 bg-white border border-[#e0d0b5] rounded-xl text-sm text-[#331f16] placeholder:text-[#8a7a66] focus:outline-none focus:border-[#3d8750] transition-colors"
                disabled={isAsking}
              />
              {question.trim() && (
                <button
                  onClick={handleAskQuestion}
                  disabled={isAsking}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-[#2c6b3e] text-white flex items-center justify-center hover:bg-[#245633] transition-colors disabled:opacity-50"
                >
                  {isAsking ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-xl bg-[#f0e8db] text-[#714a34] flex items-center justify-center hover:bg-[#e0d0b5] transition-colors shrink-0"
              title="Upload another photo"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {(error || isListening) && (
            <div className="max-w-3xl mx-auto mt-2">
              {error && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <X className="w-3 h-3" />
                  {error}
                </p>
              )}
              {isListening && (
                <p className="text-xs text-[#3d8750] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#3d8750] animate-pulse" />
                  Listening... speak your question
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Toast notifications */}
      <div className="fixed top-16 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="animate-fade-in-up bg-[#2c6b3e] text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 max-w-xs"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            {toast.message}
          </div>
        ))}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Landing Page ─────────────────────────────────────────────

function LandingPage({
  archive,
  publicStories,
  onStartExploring,
  onRestoreSession,
  onClearArchive,
}: {
  archive: ArchivedSession[];
  publicStories: any[];
  onStartExploring: () => void;
  onRestoreSession: (entry: ArchivedSession) => void;
  onClearArchive: () => void;
}) {
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, "past" | "future">>({});

  const parseId = (raw: string) => {
    try { return JSON.parse(raw); } catch { return null; }
  };

  return (
    <div>
      {/* ── Hero ── */}
      <section className="text-center pt-16 pb-14 sm:pt-24 sm:pb-20 px-4">
        <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-6 ring-4 ring-[#dcedde] shadow-lg">
          <img src="/logo.png" alt="Trail Narrator" className="w-full h-full object-cover" />
        </div>
        <p className="text-[11px] text-[#3d8750] uppercase tracking-widest mb-3 font-bold">
          Your AI Park Ranger
        </p>
        <h2 className="font-narrative text-4xl sm:text-5xl font-semibold text-[#331f16] mb-4">
          Trail Narrator
        </h2>
        <p className="text-base sm:text-lg text-[#8a7a66] leading-relaxed max-w-md mx-auto mb-8">
          Upload a trail photo and discover the million-year story behind what
          you see — with AI-generated time-travel imagery.
        </p>
        <button
          onClick={onStartExploring}
          className="h-12 px-8 bg-[#2c6b3e] hover:bg-[#245633] text-white rounded-xl text-sm font-semibold transition-colors inline-flex items-center gap-2 shadow-md btn-lift"
        >
          Start Exploring
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* ── How It Works ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <h3 className="text-center text-[10px] text-[#8a7a66] uppercase tracking-[0.2em] font-bold mb-8">
          How it works
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          {[
            { icon: Camera, title: "Upload a photo", desc: "Take or choose a trail, park, or landscape photo" },
            { icon: Sparkles, title: "Ranger narrates", desc: "AI identifies geology, flora, and fauna — then tells the story" },
            { icon: Clock, title: "Travel through time", desc: "See AI-generated imagery of the ancient past and projected future" },
          ].map((step, i) => (
            <div key={i} className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#dcedde] flex items-center justify-center mx-auto mb-4">
                <step.icon className="w-6 h-6 text-[#2c6b3e]" />
              </div>
              <div className="text-[10px] text-[#2c6b3e] font-bold uppercase tracking-wider mb-1">
                Step {i + 1}
              </div>
              <p className="text-sm font-semibold text-[#331f16] mb-1">{step.title}</p>
              <p className="text-xs text-[#8a7a66] leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Public Story Gallery ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <h3 className="text-center text-[10px] text-[#8a7a66] uppercase tracking-[0.2em] font-bold mb-2">
          Trail Stories
        </h3>
        <p className="text-center text-xs text-[#b5a48a] mb-8">
          Explorations from hikers around the world
        </p>

        {publicStories.length === 0 ? (
          <div className="text-center py-12 bg-white border border-[#e8e0d4] rounded-2xl">
            <Mountain className="w-8 h-8 text-[#cdb389] mx-auto mb-3" />
            <p className="text-sm text-[#8a7a66]">No stories yet</p>
            <p className="text-xs text-[#cdb389] mt-1">
              Be the first — upload a trail photo to share your exploration
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {publicStories.map((story) => {
              const identification = parseId(story.identification);
              const isExpanded = expandedStory === story.id;
              const tab = activeTab[story.id] || "past";

              return (
                <article
                  key={story.id}
                  className="bg-white border border-[#e8e0d4] rounded-2xl overflow-hidden shadow-sm"
                >
                  {/* Images */}
                  {(story.past_image || story.future_image) && (
                    <div>
                      <div className="flex border-b border-[#e8e0d4]">
                        {story.past_image && (
                          <button
                            onClick={() => setActiveTab((p) => ({ ...p, [story.id]: "past" }))}
                            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                              tab === "past"
                                ? "text-[#714a34] border-b-2 border-[#714a34]"
                                : "text-[#b5a48a] hover:text-[#8a7a66]"
                            }`}
                          >
                            <Clock className="w-3 h-3 inline mr-1" />
                            Ancient Past
                          </button>
                        )}
                        {story.future_image && (
                          <button
                            onClick={() => setActiveTab((p) => ({ ...p, [story.id]: "future" }))}
                            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                              tab === "future"
                                ? "text-[#2c6b3e] border-b-2 border-[#2c6b3e]"
                                : "text-[#b5a48a] hover:text-[#8a7a66]"
                            }`}
                          >
                            <Sparkles className="w-3 h-3 inline mr-1" />
                            Future
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <img
                          src={`data:image/png;base64,${tab === "past" ? story.past_image : story.future_image}`}
                          alt={tab === "past" ? story.past_caption : story.future_caption}
                          className="w-full h-64 sm:h-80 object-cover"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                          <p className="text-white text-xs leading-relaxed">
                            {tab === "past" ? story.past_caption : story.future_caption}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-base font-semibold text-[#331f16] flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#2c6b3e] shrink-0" />
                          {story.location_name || story.trail_name}
                        </h4>
                        {story.era && (
                          <span className="inline-block mt-1 text-[10px] font-semibold text-[#714a34] bg-[#f0e8db] px-2 py-0.5 rounded">
                            {story.era}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#cdb389] shrink-0">
                        {new Date(story.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-sm text-[#5a4a3a] leading-relaxed whitespace-pre-line">
                      {(isExpanded
                        ? story.narration
                        : story.narration.slice(0, 250) +
                          (story.narration.length > 250 ? "..." : "")
                      )
                        .split(/(\*\*[^*]+\*\*)/)
                        .map((seg: string, j: number) =>
                          seg.startsWith("**") && seg.endsWith("**") ? (
                            <strong key={j} className="font-semibold text-[#714a34]">
                              {seg.slice(2, -2)}
                            </strong>
                          ) : (
                            <span key={j}>{seg}</span>
                          )
                        )}
                    </p>
                    {story.narration.length > 250 && (
                      <button
                        onClick={() =>
                          setExpandedStory(isExpanded ? null : story.id)
                        }
                        className="mt-2 text-xs font-semibold text-[#2c6b3e] hover:underline"
                      >
                        {isExpanded ? "Show less" : "Read full story"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Bottom CTA ── */}
      <section className="text-center pb-16 px-4">
        <button
          onClick={onStartExploring}
          className="h-12 px-8 bg-[#2c6b3e] hover:bg-[#245633] text-white rounded-xl text-sm font-semibold transition-colors inline-flex items-center gap-2"
        >
          <Camera className="w-4 h-4" />
          Start Your Exploration
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#e8e0d4] py-6 text-center">
        <p className="text-[11px] text-[#cdb389]">
          Powered by Google Gemini AI
        </p>
      </footer>
    </div>
  );
}

// ─── Welcome Screen ──────────────────────────────────────────

function WelcomeScreen({
  trailName,
  setTrailName,
  onUpload,
  fileInputRef,
  dragActive,
  handleDrag,
  handleDrop,
  isLoading,
  loadingMessage,
  loadingStep,
  elapsedSeconds,
  previewImage,
  error,
  setError,
}: {
  trailName: string;
  setTrailName: (v: string) => void;
  onUpload: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  dragActive: boolean;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  isLoading: boolean;
  loadingMessage: string;
  loadingStep: number;
  elapsedSeconds: number;
  previewImage: string | null;
  error: string | null;
  setError: (v: string | null) => void;
}) {
  // Loading experience — only the fast narration steps
  if (isLoading && previewImage) {
    const steps = [
      { icon: Camera, label: "Analyzing photo" },
      { icon: Layers, label: "Researching geology" },
      { icon: Sparkles, label: "Crafting narration" },
    ];

    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-14">
        {/* Photo preview with scanning overlay */}
        <div className="relative rounded-2xl overflow-hidden mb-8 shadow-lg">
          <img
            src={previewImage}
            alt="Uploading..."
            className="w-full h-56 sm:h-72 object-cover"
          />
          {/* Animated scan line */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(180deg, transparent 0%, transparent 45%, rgba(45,107,62,0.15) 50%, transparent 55%, transparent 100%)",
              animation: "scanLine 2.5s ease-in-out infinite",
            }}
          />
          {/* Overlay badge */}
          <div className="absolute top-3 left-3 bg-[#2c6b3e] text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md">
            <div className="w-2 h-2 rounded-full bg-white pulse-dot" />
            Ranger is exploring...
          </div>
        </div>

        {/* Progress steps */}
        <div className="bg-white border border-[#e8e0d4] rounded-2xl p-5 sm:p-6 shadow-sm mb-6">
          <div className="space-y-1">
            {steps.map((step, i) => {
              const isActive = i === loadingStep;
              const isComplete = i < loadingStep;
              const isPending = i > loadingStep;

              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-500 ${
                    isActive ? "bg-[#dcedde]" : ""
                  }`}
                >
                  {/* Step indicator */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
                      isComplete
                        ? "bg-[#2c6b3e]"
                        : isActive
                        ? "bg-[#2c6b3e]"
                        : "bg-[#f0e8db]"
                    }`}
                  >
                    {isComplete ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : isActive ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <step.icon
                        className={`w-3.5 h-3.5 ${
                          isPending ? "text-[#cdb389]" : "text-white"
                        }`}
                      />
                    )}
                  </div>

                  {/* Step label */}
                  <span
                    className={`text-sm font-medium transition-all duration-500 ${
                      isComplete
                        ? "text-[#2c6b3e]"
                        : isActive
                        ? "text-[#2c6b3e] font-semibold"
                        : "text-[#cdb389]"
                    }`}
                  >
                    {step.label}
                  </span>

                  {/* Complete indicator */}
                  {isComplete && (
                    <span className="text-[10px] text-[#3d8750] ml-auto font-semibold">
                      Done
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Elapsed time + fun fact */}
        <div className="text-center space-y-2">
          <p className="text-sm font-mono font-semibold text-[#2c6b3e] tabular-nums">
            {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, "0")} elapsed
          </p>
          <p className="text-xs text-[#8a7a66] italic font-narrative">
            &ldquo;The Earth is 4.5 billion years old. If that were compressed into 24 hours, humans would appear in the last 1.2 seconds.&rdquo;
          </p>
        </div>
      </div>
    );
  }

  // Explore screen — focused upload experience
  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-14">
      {/* Compact header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#dcedde] mb-4">
          <Sparkles className="w-3 h-3 text-[#2c6b3e]" />
          <span className="text-[11px] font-bold text-[#2c6b3e] uppercase tracking-wider">
            New Exploration
          </span>
        </div>
        <h2 className="font-narrative text-2xl sm:text-3xl font-semibold text-[#331f16] mb-2">
          Where are you exploring?
        </h2>
        <p className="text-sm text-[#8a7a66] leading-relaxed">
          Share a trail photo and Ranger will uncover its story.
        </p>
      </div>

      {/* Trail name input */}
      <div className="mb-5">
        <label className="text-[11px] font-semibold text-[#8a7a66] uppercase tracking-wider block mb-2">
          Trail or Park Name
        </label>
        <input
          type="text"
          value={trailName}
          onChange={(e) => setTrailName(e.target.value)}
          placeholder="e.g. Grand Canyon South Rim, Yosemite Valley..."
          className="w-full h-12 px-4 bg-white border border-[#e0d0b5] rounded-xl text-sm text-[#331f16] placeholder:text-[#cdb389] focus:outline-none focus:border-[#3d8750] focus:ring-2 focus:ring-[#3d8750]/10 transition-all"
        />
      </div>

      {/* Upload zone — large and inviting */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-10 sm:p-14 text-center transition-all cursor-pointer ${
          dragActive
            ? "border-[#3d8750] bg-[#dcedde] scale-[1.01]"
            : "border-[#d5c8b0] bg-gradient-to-b from-[#f8f3ec] to-[#f0e8db]/60 hover:border-[#3d8750]/50 hover:bg-[#f0e8db]"
        } ${isLoading ? "pointer-events-none" : ""}`}
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        {isLoading ? (
          <div className="animate-fade-in-up">
            <Loader2 className="w-10 h-10 text-[#3d8750] animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-[#2c6b3e] mb-1">
              {loadingMessage}
            </p>
            <p className="text-xs text-[#8a7a66]">
              This usually takes 15-30 seconds
            </p>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-[#2c6b3e]/10 flex items-center justify-center mx-auto mb-5">
              <div className="w-11 h-11 rounded-full bg-[#2c6b3e] flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-[15px] font-semibold text-[#331f16] mb-1.5">
              Drop your trail photo here
            </p>
            <p className="text-xs text-[#8a7a66] mb-4">
              JPG, PNG, or HEIC — from your camera roll or desktop
            </p>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#3d8750] bg-[#dcedde] px-3 py-1.5 rounded-full">
              <Upload className="w-3 h-3" />
              or click to browse
            </div>
          </>
        )}
      </div>

      {/* Action buttons */}
      {!isLoading && (
        <div className="flex gap-3 mt-5">
          <label
            className="flex-1 h-12 bg-[#2c6b3e] hover:bg-[#245633] text-white rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors shadow-sm btn-lift cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            Take Photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 h-12 bg-white border border-[#e0d0b5] hover:bg-[#f0e8db] text-[#714a34] rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors"
          >
            <Upload className="w-4 h-4" />
            Choose File
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
          <X className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-500 underline mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* What happens next — replaces the old features grid */}
      <div className="mt-10 bg-white border border-[#e8e0d4] rounded-2xl p-5 sm:p-6">
        <p className="text-[10px] text-[#8a7a66] uppercase tracking-[0.15em] font-bold mb-4">
          What happens next
        </p>
        <div className="space-y-3">
          {[
            { icon: Sparkles, label: "Ranger identifies the geology, flora, and landscape", color: "bg-[#2c6b3e]" },
            { icon: Layers, label: "A rich narration tells the million-year story", color: "bg-[#714a34]" },
            { icon: Clock, label: "Time-travel imagery shows past and future views", color: "bg-[#1b4f8a]" },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-lg ${step.color} flex items-center justify-center shrink-0`}>
                <step.icon className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-[13px] text-[#5d3e2d] leading-snug">{step.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Story View ──────────────────────────────────────────────

function StoryView({
  story,
  isLoading,
  loadingMessage,
  speakNarration,
  isSpeaking,
  ttsLoading,
  storyEndRef,
  parseIdentification,
}: {
  story: StoryEntry[];
  isLoading: boolean;
  loadingMessage: string;
  speakNarration: (text: string) => void;
  isSpeaking: boolean;
  ttsLoading: boolean;
  storyEndRef: React.RefObject<HTMLDivElement>;
  parseIdentification: (raw: string) => Record<string, any> | null;
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24">
      {story.map((entry, index) => (
        <div
          key={entry.type === "narration" ? entry.data.id : entry.data.id}
          className="animate-fade-in-up mb-8"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          {entry.type === "narration" ? (
            <NarrationCard
              data={entry.data}
              index={
                story
                  .filter((s) => s.type === "narration")
                  .findIndex(
                    (s) =>
                      s.type === "narration" && s.data.id === entry.data.id
                  ) + 1
              }
              total={story.filter((s) => s.type === "narration").length}
              speakNarration={speakNarration}
              isSpeaking={isSpeaking}
              ttsLoading={ttsLoading}
              parseIdentification={parseIdentification}
            />
          ) : (
            <FollowUpCard data={entry.data} />
          )}
        </div>
      ))}

      {/* Loading state */}
      {isLoading && (
        <div className="animate-fade-in-up mb-8">
          <div className="bg-white border border-[#e0d0b5] rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-[#2c6b3e] flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#2c6b3e]">
                  {loadingMessage}
                </p>
                <p className="text-xs text-[#8a7a66]">
                  Crafting your story...
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-4 rounded shimmer" />
              <div className="h-4 rounded shimmer w-4/5" />
              <div className="h-4 rounded shimmer w-3/5" />
            </div>
          </div>
        </div>
      )}

      <div ref={storyEndRef} />
    </div>
  );
}

// ─── Narration Card ──────────────────────────────────────────

function NarrationCard({
  data,
  index,
  total,
  speakNarration,
  isSpeaking,
  ttsLoading,
  parseIdentification,
}: {
  data: NarrationEntry;
  index: number;
  total: number;
  speakNarration: (text: string) => void;
  isSpeaking: boolean;
  ttsLoading: boolean;
  parseIdentification: (raw: string) => Record<string, any> | null;
}) {
  const identification = parseIdentification(data.identification);
  const [timelineTab, setTimelineTab] = useState<"past" | "present" | "future">("past");
  const paragraphs = data.narration.split("\n\n").filter(Boolean);

  const renderMarkdown = (text: string) => {
    return text.split(/(\*\*[^*]+\*\*)/).map((segment, j) => {
      if (segment.startsWith("**") && segment.endsWith("**")) {
        return (
          <strong key={j} className="font-semibold text-[#714a34]">
            {segment.slice(2, -2)}
          </strong>
        );
      }
      return <span key={j}>{segment}</span>;
    });
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] border border-[#e8e0d4]">
      {/* Uploaded photo — full bleed with overlay */}
      <div className="relative overflow-hidden group">
        <img
          src={data.uploadedImage}
          alt="Trail photo"
          className="w-full max-h-[30rem] min-h-[14rem] object-cover photo-hover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-black/15 pointer-events-none" />
        
        {/* Top badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="bg-white/95 backdrop-blur-sm text-[#331f16] text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-sm">
            Photo {index} of {total}
          </div>
        </div>

        {/* Bottom — location + powered by */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3.5 pt-10 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-end justify-between">
            <div>
              {(identification?.location_name || identification?.location_type) && (
                <p className="text-white text-[15px] font-semibold drop-shadow-lg leading-snug">
                  {identification.location_name || identification.location_type}
                </p>
              )}
            </div>
            <div className="bg-white/80 backdrop-blur-sm text-[9px] text-[#8a7a66] px-2 py-0.5 rounded font-semibold uppercase tracking-wider shrink-0">
              Gemini AI
            </div>
          </div>
        </div>
      </div>

      {/* Narration body */}
      <div className="p-5 sm:p-8">
        {/* Ranger header with speaking state */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#2c6b3e] flex items-center justify-center ring-2 ring-[#dcedde] ring-offset-2 ring-offset-white">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#331f16]">Ranger</p>
              <p className="text-[11px] text-[#8a7a66]">AI Park Guide</p>
            </div>
          </div>
          <button
            onClick={() => speakNarration(data.narration)}
            disabled={ttsLoading}
            className={`h-9 px-3.5 rounded-xl flex items-center gap-2 text-xs font-semibold transition-all btn-lift ${
              isSpeaking
                ? "bg-[#2c6b3e] text-white"
                : ttsLoading
                ? "bg-[#2c6b3e]/70 text-white cursor-wait"
                : "bg-[#f0e8db] text-[#714a34] hover:bg-[#e0d0b5]"
            }`}
          >
            {ttsLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading...</span>
              </>
            ) : isSpeaking ? (
              <>
                <div className="speaking-wave flex items-center gap-[2px] h-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="w-[2px] bg-white rounded-full" style={{ height: 8 }} />
                  ))}
                </div>
                <span>Playing</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Listen</span>
              </>
            )}
          </button>
        </div>

        {/* Thin accent line */}
        <div className="w-12 h-0.5 bg-[#2c6b3e] rounded-full mb-5" />

        {/* Narration text with drop cap on first paragraph */}
        <div className="font-narrative text-[15px] sm:text-[16px] leading-[1.9] text-[#3d3529] mb-6 space-y-5">
          {paragraphs.map((paragraph, i) => (
            <p
              key={i}
              className={`narration-paragraph ${i === 0 ? "drop-cap" : ""}`}
            >
              {renderMarkdown(paragraph)}
            </p>
          ))}
        </div>

        {/* Identification tags */}
        {identification && (
          <div className="bg-gradient-to-br from-[#f8f3ec] to-[#f0e8db]/60 border border-[#e8e0d4] rounded-xl p-4 sm:p-5 mb-6">
            <p className="text-[10px] text-[#8a7a66] uppercase tracking-[0.15em] mb-3 font-bold">
              Geological identification
            </p>
            <div className="flex flex-wrap gap-2 geo-tags">
              {identification.rock_types?.map((r: string) => (
                <span
                  key={r}
                  className="tag-hover text-[11px] px-2.5 py-1 rounded-lg bg-[#e0d0b5] text-[#5d3e2d] font-semibold"
                >
                  {r}
                </span>
              ))}
              {identification.flora?.map((f: string) => (
                <span
                  key={f}
                  className="tag-hover text-[11px] px-2.5 py-1 rounded-lg bg-[#dcedde] text-[#1a3924] font-semibold flex items-center gap-1"
                >
                  <Leaf className="w-2.5 h-2.5" />
                  {f}
                </span>
              ))}
              {identification.key_features?.map((f: string) => (
                <span
                  key={f}
                  className="tag-hover text-[11px] px-2.5 py-1 rounded-lg bg-[#c3dbfa] text-[#1b274f] font-semibold"
                >
                  {f}
                </span>
              ))}
              {identification.geological_era && (
                <span className="tag-hover text-[11px] px-2.5 py-1 rounded-lg bg-[#faeeda] text-[#633806] font-semibold flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {identification.geological_era}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Fun fact callout */}
        {identification?.fun_fact && (
          <div className="mb-6 pl-4 border-l-[3px] border-[#2c6b3e]">
            <p className="text-[10px] text-[#3d8750] uppercase tracking-[0.15em] font-bold mb-1">
              Did you know?
            </p>
            <p className="font-narrative text-[14px] sm:text-[15px] text-[#3d3529] leading-relaxed italic">
              {identification.fun_fact}
            </p>
          </div>
        )}

        {/* Timeline: Past / Present / Future — always shown, with loading states */}
        <div>
          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#e0d0b5] to-transparent" />
            <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#f0e8db] rounded-full border border-[#e0d0b5]">
              <Clock className="w-3 h-3 text-[#a67244]" />
              <span className="text-[10px] font-bold text-[#714a34] uppercase tracking-[0.15em]">
                Through time
              </span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#e0d0b5] to-transparent" />
          </div>

          {/* Tab buttons */}
          <div className="flex rounded-xl bg-[#f0e8db] p-1 mb-4 border border-[#e0d0b5]">
            {([
              { key: "past" as const, label: data.pastImageLoading ? "Past..." : "Past", color: "bg-[#714a34]", loading: data.pastImageLoading },
              { key: "present" as const, label: "Present", color: "bg-[#2c6b3e]", loading: false },
              { key: "future" as const, label: data.futureImageLoading ? "Future..." : "Future", color: "bg-[#1b4f8a]", loading: data.futureImageLoading },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTimelineTab(tab.key)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  timelineTab === tab.key
                    ? `${tab.color} text-white shadow-sm`
                    : "text-[#8a7a66] hover:text-[#5d3e2d]"
                }`}
              >
                {tab.loading && <Loader2 className="w-3 h-3 animate-spin" />}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Full-width image panel */}
          <div className="time-travel-reveal rounded-xl overflow-hidden border border-[#e0d0b5] shadow-sm">
            {timelineTab === "past" && (
              data.pastImageLoading ? (
                <div className="aspect-video bg-gradient-to-br from-[#f0e8db] to-[#e0d0b5]/30 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-[#714a34] animate-spin" />
                  <p className="text-sm text-[#714a34] font-medium">Generating ancient landscape...</p>
                  <p className="text-xs text-[#8a7a66]">This takes 20-30 seconds</p>
                </div>
              ) : data.timeTravelImage ? (
                <>
                  <img
                    src={`data:image/png;base64,${data.timeTravelImage}`}
                    alt={data.timeTravelCaption || "Ancient past"}
                    className="w-full animate-fade-in"
                  />
                  {data.timeTravelCaption && (
                    <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-[#f0e8db] to-[#f5efe5] border-t border-[#e0d0b5]">
                      <p className="text-[13px] text-[#714a34] italic leading-relaxed font-narrative">
                        {data.timeTravelCaption}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="aspect-video bg-[#f0e8db]/50 flex items-center justify-center">
                  <p className="text-sm text-[#8a7a66] italic">Past visualization unavailable</p>
                </div>
              )
            )}

            {timelineTab === "present" && (
              <>
                <img
                  src={data.uploadedImage}
                  alt="Present day"
                  className="w-full"
                />
                <div className="px-4 sm:px-5 py-3.5 bg-[#dcedde] border-t border-[#2c6b3e]/20">
                  <p className="text-[13px] text-[#2c6b3e] font-semibold leading-relaxed">
                    Your photo — today
                  </p>
                </div>
              </>
            )}

            {timelineTab === "future" && (
              data.futureImageLoading ? (
                <div className="aspect-video bg-gradient-to-br from-[#dce8f5] to-[#c3dbfa]/30 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-[#1b4f8a] animate-spin" />
                  <p className="text-sm text-[#1b4f8a] font-medium">Projecting the future...</p>
                  <p className="text-xs text-[#8a7a66]">This takes 20-30 seconds</p>
                </div>
              ) : data.futureImage ? (
                <>
                  <img
                    src={`data:image/png;base64,${data.futureImage}`}
                    alt={data.futureCaption || "Projected future"}
                    className="w-full animate-fade-in"
                  />
                  {data.futureCaption && (
                    <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-[#dce8f5] to-[#c3dbfa]/40 border-t border-[#c3dbfa]">
                      <p className="text-[13px] text-[#1b4f8a] italic leading-relaxed font-narrative">
                        {data.futureCaption}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="aspect-video bg-[#dce8f5]/50 flex items-center justify-center">
                  <p className="text-sm text-[#8a7a66] italic">Future visualization unavailable</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Follow-up Card ──────────────────────────────────────────

function FollowUpCard({ data }: { data: FollowUpEntry }) {
  const isLoading = !data.answer;

  return (
    <div className="space-y-3">
      {/* Question bubble */}
      <div className="flex justify-end animate-fade-in-up">
        <div className="max-w-[80%] bg-[#2c6b3e] text-white px-4 py-2.5 rounded-2xl rounded-tr-md">
          <p className="text-sm">{data.question}</p>
        </div>
      </div>

      {/* Answer or typing indicator */}
      <div className="flex gap-2.5 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
        <div className="w-7 h-7 rounded-full bg-[#2c6b3e] flex items-center justify-center shrink-0 mt-1">
          {isLoading ? (
            <Loader2 className="w-3 h-3 text-white animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3 text-white" />
          )}
        </div>
        <div className="bg-white border border-[#e0d0b5] rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%]">
          {isLoading ? (
            <div className="flex items-center gap-1.5 py-1">
              <span className="w-2 h-2 rounded-full bg-[#8a7a66] animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-[#8a7a66] animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-[#8a7a66] animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          ) : (
            <div className="font-narrative text-[15px] leading-[1.75] text-[#331f16] space-y-3">
              {data.answer.split("\n\n").map((p, i) => (
                <p key={i}>
                  {p.split(/(\*\*[^*]+\*\*)/).map((segment, j) => {
                    if (segment.startsWith("**") && segment.endsWith("**")) {
                      return (
                        <strong key={j} className="font-semibold text-[#714a34]">
                          {segment.slice(2, -2)}
                        </strong>
                      );
                    }
                    return <span key={j}>{segment}</span>;
                  })}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
