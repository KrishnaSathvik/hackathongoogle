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
  Loader2,
  Mountain,
  Layers,
  Leaf,
  Clock,
  ImagePlus,
  Sparkles,
  X,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ───────────────────────────────────────────────────

interface NarrationEntry {
  id: string;
  narration: string;
  identification: string;
  timeTravelImage: string | null;
  timeTravelCaption: string;
  era: string;
  uploadedImage: string; // base64 data URL of the original photo
  timestamp: Date;
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

// ─── Main Page ───────────────────────────────────────────────

export default function TrailNarratorPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [trailName, setTrailName] = useState("");
  const [story, setStory] = useState<StoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const storyEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const hasStory = story.length > 0;

  // Auto-scroll to latest entry
  useEffect(() => {
    if (storyEndRef.current) {
      storyEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [story]);

  // Loading steps with progress
  const loadingSteps = [
    { message: "Analyzing your photo", detail: "Identifying landscape and features" },
    { message: "Researching geology", detail: "Matching rock types and formations" },
    { message: "Crafting the narration", detail: "Ranger is writing your story" },
    { message: "Selecting the best era", detail: "Choosing the most dramatic time period" },
    { message: "Generating time-travel image", detail: "Painting the ancient landscape" },
  ];

  // Step durations - spread across ~50s so we never outrun the API
  const stepDurations = [5000, 7000, 10000, 8000, 999999]; // last step never auto-advances

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

  // ─── Upload & Narrate ──────────────────────────────────────

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file.");
        return;
      }

      setError(null);
      setIsLoading(true);

      // Create preview and store it for the loading screen
      const reader = new FileReader();
      const uploadedImage: string = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      setPreviewImage(uploadedImage);

      try {
        const formData = new FormData();
        formData.append("image", file);
        if (sessionId) formData.append("session_id", sessionId);
        if (trailName) formData.append("trail_name", trailName);

        const res = await fetch(`${API_URL}/api/narrate`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();

        if (!sessionId) setSessionId(data.session_id);

        const entry: NarrationEntry = {
          id: crypto.randomUUID(),
          narration: data.narration,
          identification: data.identification,
          timeTravelImage: data.time_travel_image,
          timeTravelCaption: data.time_travel_caption,
          era: data.era,
          uploadedImage,
          timestamp: new Date(),
        };

        setStory((prev) => [...prev, { type: "narration", data: entry }]);
      } catch (err: any) {
        setError(err.message || "Failed to narrate. Is the backend running?");
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, trailName]
  );

  // ─── Follow-up Question ────────────────────────────────────

  const handleAskQuestion = useCallback(async () => {
    if (!question.trim() || !sessionId) return;

    const q = question.trim();
    setQuestion("");
    setIsAsking(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, question: q }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();

      const entry: FollowUpEntry = {
        id: crypto.randomUUID(),
        question: q,
        answer: data.answer,
        timestamp: new Date(),
      };

      setStory((prev) => [...prev, { type: "followup", data: entry }]);
    } catch (err: any) {
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
        return;
      }

      setIsSpeaking(true);

      try {
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
        const blobUrl = URL.createObjectURL(blob);
        const audio = new Audio(blobUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          URL.revokeObjectURL(blobUrl);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          URL.revokeObjectURL(blobUrl);
        };
        await audio.play();
      } catch (err) {
        // Fallback to browser TTS
        console.warn("Gemini TTS failed, falling back to browser TTS:", err);
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
            <div className="w-8 h-8 rounded-full bg-[#2c6b3e] flex items-center justify-center">
              <Mountain className="w-4 h-4 text-white" />
            </div>
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
        {!hasStory ? (
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
            previewImage={previewImage}
            error={error}
            setError={setError}
          />
        ) : (
          <StoryView
            story={story}
            isLoading={isLoading}
            loadingMessage={loadingMessage}
            speakNarration={speakNarration}
            isSpeaking={isSpeaking}
            storyEndRef={storyEndRef}
            parseIdentification={parseIdentification}
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
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
  previewImage: string | null;
  error: string | null;
  setError: (v: string | null) => void;
}) {
  // Loading experience
  if (isLoading && previewImage) {
    const steps = [
      { icon: Camera, label: "Analyzing photo" },
      { icon: Layers, label: "Researching geology" },
      { icon: Sparkles, label: "Crafting narration" },
      { icon: Clock, label: "Selecting era" },
      { icon: Mountain, label: "Generating landscape" },
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

        {/* Fun fact while waiting */}
        <div className="text-center">
          <p className="text-xs text-[#8a7a66] italic font-narrative">
            &ldquo;The Earth is 4.5 billion years old. If that were compressed into 24 hours, humans would appear in the last 1.2 seconds.&rdquo;
          </p>
        </div>
      </div>
    );
  }

  // Normal welcome screen
  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-12 sm:py-20">
      {/* Title */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-[#2c6b3e] flex items-center justify-center mx-auto mb-5 ring-4 ring-[#dcedde]">
          <Mountain className="w-7 h-7 text-white" />
        </div>
        <p className="text-[11px] text-[#8a7a66] uppercase tracking-widest mb-2 font-semibold">
          Creative Storyteller Agent
        </p>
        <h1 className="font-narrative text-3xl sm:text-4xl font-semibold text-[#331f16] mb-3">
          Trail Narrator
        </h1>
        <p className="text-base text-[#8a7a66] leading-relaxed max-w-sm mx-auto">
          Upload a trail photo and your AI park ranger will narrate the
          million-year story behind what you&apos;re seeing — with
          time-travel imagery.
        </p>
      </div>

      {/* Trail name input */}
      <div className="mb-4">
        <input
          type="text"
          value={trailName}
          onChange={(e) => setTrailName(e.target.value)}
          placeholder="Trail or park name (optional)"
          className="w-full h-11 px-4 bg-white border border-[#e0d0b5] rounded-xl text-sm text-[#331f16] placeholder:text-[#cdb389] focus:outline-none focus:border-[#3d8750] transition-colors"
        />
      </div>

      {/* Upload zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer ${
          dragActive
            ? "border-[#3d8750] bg-[#dcedde]"
            : "border-[#e0d0b5] bg-[#f0e8db]/50 hover:border-[#cdb389] hover:bg-[#f0e8db]"
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
            <div className="w-14 h-14 rounded-2xl bg-[#e0d0b5] flex items-center justify-center mx-auto mb-4">
              <Upload className="w-6 h-6 text-[#714a34]" />
            </div>
            <p className="text-sm font-medium text-[#5d3e2d] mb-1">
              Drop a trail photo here or tap to upload
            </p>
            <p className="text-xs text-[#8a7a66]">
              JPG, PNG, HEIC — from your camera roll or desktop
            </p>
          </>
        )}
      </div>

      {/* Quick action buttons */}
      {!isLoading && (
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 h-12 bg-[#2c6b3e] hover:bg-[#245633] text-white rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors"
          >
            <Camera className="w-4 h-4" />
            Take Photo
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 h-12 bg-white border border-[#e0d0b5] hover:bg-[#f0e8db] text-[#714a34] rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors"
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

      {/* Features */}
      <div className="grid grid-cols-3 gap-3 mt-10">
        {[
          { icon: Layers, label: "Geological\nstory", color: "text-[#714a34]" },
          {
            icon: Clock,
            label: "Time-travel\nimagery",
            color: "text-[#3d8750]",
          },
          { icon: Mic, label: "Voice\ninteraction", color: "text-[#4785e8]" },
        ].map((feat) => (
          <div
            key={feat.label}
            className="text-center p-3 rounded-xl bg-white border border-[#f0e8db]"
          >
            <feat.icon
              className={`w-5 h-5 ${feat.color} mx-auto mb-2`}
            />
            <p className="text-[11px] text-[#8a7a66] whitespace-pre-line leading-tight">
              {feat.label}
            </p>
          </div>
        ))}
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
  storyEndRef,
  parseIdentification,
}: {
  story: StoryEntry[];
  isLoading: boolean;
  loadingMessage: string;
  speakNarration: (text: string) => void;
  isSpeaking: boolean;
  storyEndRef: React.RefObject<HTMLDivElement | null>;
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
  parseIdentification,
}: {
  data: NarrationEntry;
  index: number;
  total: number;
  speakNarration: (text: string) => void;
  isSpeaking: boolean;
  parseIdentification: (raw: string) => Record<string, any> | null;
}) {
  const identification = parseIdentification(data.identification);
  const [showTimeTravel, setShowTimeTravel] = useState(true);
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
            className={`h-9 px-3.5 rounded-xl flex items-center gap-2 text-xs font-semibold transition-all btn-lift ${
              isSpeaking
                ? "bg-[#2c6b3e] text-white"
                : "bg-[#f0e8db] text-[#714a34] hover:bg-[#e0d0b5]"
            }`}
          >
            {isSpeaking ? (
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

        {/* Time-travel image */}
        {data.timeTravelImage && (
          <div>
            {/* Era divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#e0d0b5] to-transparent" />
              <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#f0e8db] rounded-full border border-[#e0d0b5]">
                <Clock className="w-3 h-3 text-[#a67244]" />
                <span className="text-[10px] font-bold text-[#714a34] uppercase tracking-[0.15em]">
                  Time travel
                </span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#e0d0b5] to-transparent" />
            </div>

            {/* Image with reveal animation */}
            <div className="time-travel-reveal rounded-xl overflow-hidden border border-[#e0d0b5] shadow-sm">
              <img
                src={`data:image/png;base64,${data.timeTravelImage}`}
                alt={data.timeTravelCaption || "Time-travel visualization"}
                className="w-full"
              />
              {data.timeTravelCaption && (
                <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-[#f0e8db] to-[#f5efe5] border-t border-[#e0d0b5]">
                  <p className="text-[13px] text-[#714a34] italic leading-relaxed font-narrative">
                    {data.timeTravelCaption}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Follow-up Card ──────────────────────────────────────────

function FollowUpCard({ data }: { data: FollowUpEntry }) {
  return (
    <div className="space-y-3">
      {/* Question bubble */}
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-[#2c6b3e] text-white px-4 py-2.5 rounded-2xl rounded-tr-md">
          <p className="text-sm">{data.question}</p>
        </div>
      </div>

      {/* Answer */}
      <div className="flex gap-2.5">
        <div className="w-7 h-7 rounded-full bg-[#2c6b3e] flex items-center justify-center shrink-0 mt-1">
          <Sparkles className="w-3 h-3 text-white" />
        </div>
        <div className="bg-white border border-[#e0d0b5] rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%]">
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
        </div>
      </div>
    </div>
  );
}
