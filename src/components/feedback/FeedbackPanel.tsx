import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, Square, Loader2, Crosshair, X, Sparkles, Send, ChevronLeft, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface FeedbackPanelProps {
  open: boolean;
  onClose: () => void;
}

type ProcessedResult = {
  title: string;
  description: string;
  priority: string;
  category: string;
};

export default function FeedbackPanel({ open, onClose }: FeedbackPanelProps) {
  const { user } = useAuth();
  const [rawInput, setRawInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState<ProcessedResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pageUrl, setPageUrl] = useState("");

  // Element inspector
  const [elementSelector, setElementSelector] = useState<string | null>(null);
  const [elementDescription, setElementDescription] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pendingAutoProcessRef = useRef(false);

  // Reset when panel opens
  useEffect(() => {
    if (open) {
      setPageUrl(window.location.href);
      setRawInput("");
      setProcessed(null);
      setElementSelector(null);
      setElementDescription(null);
      setInspecting(false);
      setRecording(false);
      pendingAutoProcessRef.current = false;
    }
  }, [open]);

  // Auto-process after recording stops
  useEffect(() => {
    if (!recording && pendingAutoProcessRef.current && rawInput.trim()) {
      pendingAutoProcessRef.current = false;
      handleProcess();
    }
  }, [recording]);

  // ---- AI Processing ----
  const handleProcess = async () => {
    if (!rawInput.trim()) return;
    setProcessing(true);
    try {
      const context = [
        rawInput.trim(),
        elementDescription ? `[Element: ${elementDescription}]` : null,
        pageUrl ? `[Page: ${pageUrl.replace(/^https?:\/\/[^/]+/, "")}]` : null,
      ].filter(Boolean).join("\n");

      const { data } = await supabase.functions.invoke("wishlist-parse", {
        body: { rawInput: context },
      });

      if (data?.items?.length) {
        const first = data.items[0];
        setProcessed({
          title: first.title || rawInput.trim().slice(0, 120),
          description: first.description || rawInput.trim(),
          priority: first.priority || "medium",
          category: first.category || "feature",
        });
      } else {
        setProcessed({
          title: rawInput.trim().slice(0, 120),
          description: rawInput.trim(),
          priority: "medium",
          category: "feature",
        });
      }
    } catch {
      setProcessed({
        title: rawInput.trim().slice(0, 120),
        description: rawInput.trim(),
        priority: "medium",
        category: "feature",
      });
    }
    setProcessing(false);
  };

  // ---- Voice Recording ----
  const startRecording = useCallback(async () => {
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
        if (interim) {
          setRawInput(finalTranscript + (finalTranscript ? " " : "") + interim);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setRecording(false);
        pendingAutoProcessRef.current = false;
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

      recognition.onend = () => setRecording(false);
      recognitionRef.current = recognition;
      pendingAutoProcessRef.current = true;
      recognition.start();
      setRecording(true);
    } else {
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
          toast.info("Voice recorded", { description: "Type your feedback for now. Full transcription coming soon." });
          setTranscribing(false);
        };
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setRecording(true);
      } catch {
        toast.error("Couldn't access microphone");
      }
    }
  }, [rawInput]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop(); mediaRecorderRef.current = null;
    }
    setRecording(false);
  }, []);

  // ---- Element Inspector ----
  const startInspecting = useCallback(() => setInspecting(true), []);

  const describeElement = (el: HTMLElement): string => {
    const text = el.innerText?.trim().slice(0, 60);
    const ariaLabel = el.getAttribute("aria-label");
    const placeholder = el.getAttribute("placeholder");
    const alt = el.getAttribute("alt");
    const title = el.getAttribute("title");
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role");

    const label = ariaLabel || alt || title || placeholder || text;

    if (label) {
      const typeHint = role || tag;
      const friendly = typeHint === "button" ? "Button" :
                       typeHint === "a" ? "Link" :
                       typeHint === "input" ? "Input field" :
                       typeHint === "img" ? "Image" :
                       typeHint === "svg" ? "Icon" :
                       typeHint === "h1" || typeHint === "h2" || typeHint === "h3" ? "Heading" :
                       typeHint === "p" ? "Text" :
                       typeHint === "nav" ? "Navigation" :
                       typeHint === "section" ? "Section" :
                       typeHint === "div" ? "Container" :
                       tag;
      return `${friendly}: "${label.length > 50 ? label.slice(0, 50) + "..." : label}"`;
    }

    return `<${tag}> element`;
  };

  useEffect(() => {
    if (!inspecting) return;

    let lastHighlighted: HTMLElement | null = null;
    let lastOriginalOutline = "";
    let lastOriginalOutlineOffset = "";

    const clearHighlight = () => {
      if (lastHighlighted) {
        lastHighlighted.style.outline = lastOriginalOutline;
        lastHighlighted.style.outlineOffset = lastOriginalOutlineOffset;
        lastHighlighted = null;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("[data-feedback-panel]") || el.closest("[data-feedback-tabs]")) return;
      if (lastHighlighted === el) return;
      clearHighlight();
      lastOriginalOutline = el.style.outline;
      lastOriginalOutlineOffset = el.style.outlineOffset;
      el.style.outline = "2px solid hsl(256 72% 54%)";
      el.style.outlineOffset = "2px";
      lastHighlighted = el;
    };

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = e.target as HTMLElement;
      if (el.closest("[data-feedback-panel]") || el.closest("[data-feedback-tabs]")) return;
      clearHighlight();
      setElementSelector(buildSelector(el));
      setElementDescription(describeElement(el));
      setInspecting(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearHighlight();
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
      clearHighlight();
    };
  }, [inspecting]);

  const buildSelector = (el: HTMLElement): string => {
    const parts: string[] = [];
    let current: HTMLElement | null = el;
    let depth = 0;
    while (current && current !== document.body && depth < 4) {
      let part = current.tagName.toLowerCase();
      if (current.id) { parts.unshift(`#${current.id}`); break; }
      if (current.className && typeof current.className === "string") {
        const classes = current.className.split(/\s+/)
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

  // ---- Submit the processed result ----
  const handleSubmit = async () => {
    if (!processed) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("wishlist_items").insert({
        title: processed.title,
        description: processed.description,
        category: processed.category,
        priority: processed.priority,
        status: "wishlist",
        submitted_by: user?.id || null,
        page_url: pageUrl || null,
        element_selector: elementSelector || null,
      } as any);

      if (error) throw error;

      toast.success("Feedback submitted", { description: "Added to the backlog" });
      onClose();
    } catch (err: any) {
      toast.error("Failed to submit", { description: err.message });
    }
    setSubmitting(false);
  };

  const pagePath = pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/";

  return (
    <Sheet open={open && !inspecting} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-sm p-0 flex flex-col" data-feedback-panel>
        {/* Header */}
        <div className="px-8 pt-10 pb-2">
          <SheetTitle className="text-4xl tracking-tight">
            <span className="font-light">Share</span>{" "}
            <span className="font-black">Feedback</span>
          </SheetTitle>
          <SheetDescription className="mt-2 text-sm">
            {processed
              ? "Review what AI captured. Edit anything, then submit."
              : "Bug, idea, wish... just say what's on your mind."}
          </SheetDescription>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-4 space-y-5">
          {!processed && !processing ? (
            <>
              {/* ---- STEP 1: Raw input ---- */}
              <div className="relative">
                <Textarea
                  placeholder="What's on your mind? A bug, an idea, a wish... just describe it."
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  rows={6}
                  className="resize-none pr-14 text-[15px] leading-relaxed"
                  autoFocus
                />
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

              {/* Element selector */}
              <div>
                {elementSelector ? (
                  <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
                    <div className="flex items-center gap-2">
                      <Crosshair className="h-3.5 w-3.5 text-foreground shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate flex-1">
                        {elementDescription || "Selected element"}
                      </span>
                      <button
                        className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-muted shrink-0"
                        onClick={() => { setElementSelector(null); setElementDescription(null); }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <code className="text-[10px] text-muted-foreground/60 block truncate">
                      {elementSelector}
                    </code>
                  </div>
                ) : (
                  <button
                    onClick={startInspecting}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    Point to an element
                  </button>
                )}
              </div>

              {/* Page context */}
              <div className="text-[11px] text-muted-foreground/60 truncate">
                {pageUrl.replace(/^https?:\/\//, "")}
              </div>
            </>
          ) : processing ? (
            /* ---- PROCESSING STATE ---- */
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processing your feedback...</p>
            </div>
          ) : processed ? (
            <>
              {/* ---- STEP 2: AI-processed preview ---- */}
              <div className="space-y-4">
                {/* Back button */}
                <button
                  onClick={() => setProcessed(null)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to editing
                </button>

                {/* Raw transcript */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-1">
                    Your words
                  </p>
                  <p className="text-sm text-muted-foreground italic leading-relaxed">
                    "{rawInput}"
                  </p>
                </div>

                {/* AI-structured output */}
                <div className="space-y-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-primary">
                      AI processed
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Title</label>
                    <Input
                      value={processed.title}
                      onChange={(e) => setProcessed({ ...processed, title: e.target.value })}
                      className="mt-1 h-9 text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Description</label>
                    <Textarea
                      value={processed.description}
                      onChange={(e) => setProcessed({ ...processed, description: e.target.value })}
                      rows={3}
                      className="mt-1 text-sm resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Priority</label>
                    <div className="flex gap-1 mt-1">
                      {["low", "medium", "high"].map((p) => (
                        <button
                          key={p}
                          onClick={() => setProcessed({ ...processed, priority: p })}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            processed.priority === p
                              ? p === "high"
                                ? "bg-red-500/10 text-red-600 border border-red-500/20"
                                : p === "medium"
                                ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                : "bg-green-500/10 text-green-600 border border-green-500/20"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Type</label>
                    <div className="flex gap-1 mt-1">
                      {["bug", "feature", "idea"].map((c) => (
                        <button
                          key={c}
                          onClick={() => setProcessed({ ...processed, category: c })}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            processed.category === c
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Context: element + page URL */}
                <div className="space-y-2">
                  {elementSelector && (
                    <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
                      <div className="flex items-center gap-2">
                        <Crosshair className="h-3.5 w-3.5 text-foreground shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate flex-1">
                          {elementDescription || "Selected element"}
                        </span>
                      </div>
                      <code className="text-[10px] text-muted-foreground/60 block truncate">
                        {elementSelector}
                      </code>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{pagePath}</span>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Bottom action bar */}
        <div className="px-8 py-5 border-t border-border bg-muted/20">
          {!processed && !processing ? (
            <Button
              onClick={handleProcess}
              disabled={!rawInput.trim()}
              className="w-full gap-2 h-11 text-sm font-semibold"
            >
              <Sparkles className="h-4 w-4" />
              Process with AI
            </Button>
          ) : processing ? (
            <Button disabled className="w-full gap-2 h-11 text-sm font-semibold">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !processed?.title.trim()}
              className="w-full gap-2 h-11 text-sm font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit to Backlog
                </>
              )}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
