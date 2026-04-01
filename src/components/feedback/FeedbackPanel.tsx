import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, Square, Loader2, Send, Crosshair, X, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface FeedbackPanelProps {
  type: "bug" | "feature" | null;
  onClose: () => void;
}

export default function FeedbackPanel({ type, onClose }: FeedbackPanelProps) {
  const { user } = useAuth();
  const [rawInput, setRawInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const [elementSelector, setElementSelector] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Capture page URL when panel opens
  useEffect(() => {
    if (type) {
      setPageUrl(window.location.href);
      setRawInput("");
      setElementSelector(null);
      setInspecting(false);
      setRecording(false);
    }
  }, [type]);

  // ---- Voice Recording (Web Speech API with MediaRecorder fallback) ----
  const startRecording = useCallback(async () => {
    // Try Web Speech API first (real-time transcription)
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      let finalTranscript = rawInput;

      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += (finalTranscript ? " " : "") + transcript;
            setRawInput(finalTranscript);
          } else {
            interim = transcript;
          }
        }
        // Show interim results appended
        if (interim) {
          setRawInput(finalTranscript + (finalTranscript ? " " : "") + interim);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setRecording(false);
        if (event.error === "not-allowed") {
          toast.error("Microphone access needed", {
            description: "Click the lock icon in your browser's address bar to allow microphone access, then try again.",
          });
        } else if (event.error !== "aborted") {
          toast.error("Voice recording issue", {
            description: "Try typing your feedback instead.",
          });
        }
      };

      recognition.onend = () => {
        setRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setRecording(true);
    } else {
      // Fallback: record audio blob (would need server transcription)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          setTranscribing(true);
          // For now, just notify - would integrate Whisper API later
          toast.info("Voice recording saved", {
            description: "Type your feedback below for now - voice transcription coming soon",
          });
          setTranscribing(false);
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setRecording(true);
      } catch (err) {
        toast.error("Couldn't access microphone");
      }
    }
  }, [rawInput]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setRecording(false);
  }, []);

  // ---- Element Inspector ----
  const startInspecting = useCallback(() => {
    setInspecting(true);
  }, []);

  useEffect(() => {
    if (!inspecting) return;

    let lastHighlighted: HTMLElement | null = null;
    const originalOutline: string[] = [];

    const handleMouseMove = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("[data-feedback-panel]") || el.closest("[data-feedback-tabs]")) return;
      if (lastHighlighted && lastHighlighted !== el) {
        lastHighlighted.style.outline = originalOutline.pop() || "";
      }
      originalOutline.push(el.style.outline);
      el.style.outline = "2px solid #ef4444";
      el.style.outlineOffset = "2px";
      lastHighlighted = el;
    };

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = e.target as HTMLElement;
      if (el.closest("[data-feedback-panel]") || el.closest("[data-feedback-tabs]")) return;
      setElementSelector(buildSelector(el));
      if (lastHighlighted) lastHighlighted.style.outline = originalOutline.pop() || "";
      setInspecting(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lastHighlighted) lastHighlighted.style.outline = originalOutline.pop() || "";
        setInspecting(false);
      }
    };

    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.body.style.cursor = "crosshair";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.cursor = "";
      if (lastHighlighted) lastHighlighted.style.outline = originalOutline.pop() || "";
    };
  }, [inspecting]);

  const buildSelector = (el: HTMLElement): string => {
    const parts: string[] = [];
    let current: HTMLElement | null = el;
    let depth = 0;
    while (current && current !== document.body && depth < 4) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(`#${current.id}`);
        break;
      }
      if (current.className && typeof current.className === "string") {
        const classes = current.className
          .split(/\s+/)
          .filter((c) => c && !c.startsWith("hover:") && !c.startsWith("focus:") && c.length < 30)
          .slice(0, 2);
        if (classes.length) part += "." + classes.join(".");
      }
      parts.unshift(part);
      current = current.parentElement;
      depth++;
    }
    return parts.join(" > ");
  };

  // ---- Submit with AI processing ----
  const handleSubmit = async () => {
    if (!rawInput.trim()) return;
    setSubmitting(true);

    try {
      // Try AI parsing via existing wishlist-parse function
      let title = rawInput.trim().slice(0, 120);
      let description = rawInput.trim();
      let priority = "medium";

      try {
        const { data } = await supabase.functions.invoke("wishlist-parse", {
          body: { rawInput: rawInput.trim() },
        });
        if (data?.items?.length) {
          const first = data.items[0];
          title = first.title || title;
          description = first.description || description;
          priority = first.priority || priority;
        }
      } catch {
        // AI parsing failed - fall back to raw input as title/description
      }

      const { error } = await supabase.from("wishlist_items").insert({
        title,
        description,
        category: type === "bug" ? "bug" : "feature",
        priority,
        status: "wishlist",
        submitted_by: user?.id || null,
        page_url: pageUrl || null,
        element_selector: elementSelector || null,
      } as any);

      if (error) throw error;

      toast.success(
        type === "bug" ? "Bug logged" : "Feature requested",
        { description: "AI processed and added to the backlog" }
      );
      onClose();
    } catch (err: any) {
      toast.error("Failed to submit", { description: err.message });
    }
    setSubmitting(false);
  };

  const isBug = type === "bug";

  return (
    <Sheet open={!!type && !inspecting} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="sm:max-w-sm p-0 flex flex-col" data-feedback-panel>
        {/* Header with large typography */}
        <div className="px-8 pt-10 pb-6">
          <SheetTitle className="text-4xl tracking-tight">
            {isBug ? (
              <>
                <span className="font-light">Report a</span>{" "}
                <span className="font-black">Bug</span>
              </>
            ) : (
              <>
                <span className="font-light">Request a</span>{" "}
                <span className="font-black">Feature</span>
              </>
            )}
          </SheetTitle>
          <SheetDescription className="mt-2 text-sm">
            Just say what's on your mind. Type it, or hit the mic and talk. We'll figure out the rest.
          </SheetDescription>
        </div>

        <hr className="border-t border-border mx-8" />

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
          {/* Single brain-dump textarea with mic */}
          <div className="relative">
            <Textarea
              placeholder={
                isBug
                  ? "Something's off... just describe what happened in your own words."
                  : "I wish this thing could... just describe what you're imagining."
              }
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              rows={6}
              className="resize-none pr-14 text-[15px] leading-relaxed"
              autoFocus
            />
            {/* Mic / Stop button overlaid in textarea */}
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing}
              className={`absolute right-3 bottom-3 h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                recording
                  ? "border-2 border-red-500 bg-white dark:bg-background shadow-lg shadow-red-500/20"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              }`}
              title={recording ? "Stop recording" : "Record voice"}
            >
              {transcribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : recording ? (
                <Square className="h-3.5 w-3.5 fill-red-500 text-red-500" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          </div>

          {recording && (
            <div className="flex items-center gap-2 text-sm animate-pulse">
              <div className="h-3 w-3 rounded-full border-2 border-red-500 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
              </div>
              <span className="text-red-600 dark:text-red-400 font-medium">Recording</span>
              <span className="text-muted-foreground">just talk naturally</span>
            </div>
          )}

          {/* Element selector (bugs only) */}
          {isBug && (
            <div>
              {elementSelector ? (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
                  <Crosshair className="h-3.5 w-3.5 text-foreground shrink-0" />
                  <code className="text-xs text-muted-foreground truncate flex-1">
                    {elementSelector}
                  </code>
                  <button
                    className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-muted shrink-0"
                    onClick={() => setElementSelector(null)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={startInspecting}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  Point to the element
                </button>
              )}
            </div>
          )}

          {/* Page context */}
          <div className="text-[11px] text-muted-foreground/60 truncate">
            {pageUrl.replace(/^https?:\/\//, "")}
          </div>
        </div>

        {/* Submit bar */}
        <div className="px-8 py-5 border-t border-border bg-muted/20">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !rawInput.trim()}
            className="w-full gap-2 h-11 text-sm font-semibold"
          >
            {submitting ? (
              <>
                <Sparkles className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Process &amp; Submit
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
