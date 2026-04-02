import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, ImagePlus, FileText, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

export interface CaseStudy {
  id?: string;
  session_id?: string;
  sort_order: number;
  company: string;
  tagline: string;
  screenshot_url: string;
  metrics: { stat: string; label: string }[];
  description: string;
  why_it_matters: string;
  raw_content: string;
}

interface ProposalCaseStudiesProps {
  sessionId: string;
  clientName?: string;
  domain?: string;
  caseStudies: CaseStudy[];
  onCaseStudiesChange: (studies: CaseStudy[]) => void;
}

const PARSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-upload`;
const GENERATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-case-study`;

export default function ProposalCaseStudies({
  sessionId,
  clientName,
  domain,
  caseStudies,
  onCaseStudiesChange,
}: ProposalCaseStudiesProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState<string | null>(null); // case study id

  const name = clientName || domain || "the client";

  // ── Save case studies to DB ──────────────────────────────────
  const saveCaseStudies = useCallback(async (studies: CaseStudy[]) => {
    // Delete existing and re-insert
    await (supabase.from("proposal_case_studies" as any) as any).delete().eq("session_id", sessionId);
    if (studies.length > 0) {
      await (supabase.from("proposal_case_studies" as any) as any).insert(
        studies.map((cs, idx) => ({
          session_id: sessionId,
          sort_order: idx,
          company: cs.company,
          tagline: cs.tagline,
          screenshot_url: cs.screenshot_url || "",
          metrics: cs.metrics,
          description: cs.description,
          why_it_matters: cs.why_it_matters,
          raw_content: cs.raw_content || "",
        }))
      );
    }
  }, [sessionId]);

  // ── Parse uploaded file to text ──────────────────────────────
  const parseFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const resp = await fetch(PARSE_URL, {
      method: "POST",
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: formData,
    });
    if (!resp.ok) throw new Error("Failed to parse file");
    const data = await resp.json();
    return data.text || data.content || "";
  };

  // ── Generate case study from raw content ─────────────────────
  const generateCaseStudy = async (rawContent: string): Promise<CaseStudy> => {
    const resp = await fetch(GENERATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ rawContent, clientName: name, domain }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Generation failed: ${err}`);
    }
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    const cs = data.caseStudy;
    return {
      sort_order: caseStudies.length,
      company: cs.company || "",
      tagline: cs.tagline || "",
      screenshot_url: "",
      metrics: cs.metrics || [],
      description: cs.description || "",
      why_it_matters: cs.whyItMatters || cs.why_it_matters || "",
      raw_content: rawContent,
    };
  };

  // ── Handle file drop/upload ──────────────────────────────────
  const handleFiles = async (files: FileList | File[]) => {
    setIsProcessing(true);
    try {
      let rawContent = "";

      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/")) {
          // Skip images in the content parse — handle screenshots separately
          continue;
        }
        setProcessingLabel(`Parsing ${file.name}...`);
        const text = await parseFile(file);
        rawContent += (rawContent ? "\n\n---\n\n" : "") + text;
      }

      // Check for pasted/typed text too
      if (textInput.trim()) {
        rawContent += (rawContent ? "\n\n---\n\n" : "") + textInput.trim();
        setTextInput("");
        setShowTextInput(false);
      }

      if (!rawContent.trim()) {
        toast.error("No text content found in uploads");
        setIsProcessing(false);
        return;
      }

      setProcessingLabel("AI is structuring the case study...");
      const newStudy = await generateCaseStudy(rawContent);
      const updated = [...caseStudies, newStudy];
      onCaseStudiesChange(updated);
      await saveCaseStudies(updated);
      toast.success(`Case study for ${newStudy.company} created`);
    } catch (e: any) {
      console.error("Case study creation error:", e);
      toast.error(e?.message || "Failed to create case study");
    }
    setIsProcessing(false);
    setProcessingLabel("");
  };

  // ── Handle text-only submission ──────────────────────────────
  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    setIsProcessing(true);
    setProcessingLabel("AI is structuring the case study...");
    try {
      const newStudy = await generateCaseStudy(textInput.trim());
      const updated = [...caseStudies, newStudy];
      onCaseStudiesChange(updated);
      await saveCaseStudies(updated);
      setTextInput("");
      setShowTextInput(false);
      toast.success(`Case study for ${newStudy.company} created`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to create case study");
    }
    setIsProcessing(false);
    setProcessingLabel("");
  };

  // ── Upload screenshot for a case study ───────────────────────
  const handleScreenshotUpload = async (idx: number, file: File) => {
    const cs = caseStudies[idx];
    setUploadingScreenshot(cs.id || String(idx));
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `case-studies/${sessionId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("screenshots").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("screenshots").getPublicUrl(path);
      const updated = caseStudies.map((c, i) =>
        i === idx ? { ...c, screenshot_url: urlData.publicUrl } : c
      );
      onCaseStudiesChange(updated);
      await saveCaseStudies(updated);
    } catch (e: any) {
      toast.error("Failed to upload screenshot");
    }
    setUploadingScreenshot(null);
  };

  // ── Delete case study ────────────────────────────────────────
  const handleDelete = async (idx: number) => {
    const updated = caseStudies.filter((_, i) => i !== idx);
    onCaseStudiesChange(updated);
    await saveCaseStudies(updated);
  };

  // ── Drop handlers ────────────────────────────────────────────
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  return (
    <section className="py-20 px-8 lg:px-16">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-4xl md:text-5xl text-foreground tracking-tight mb-4">
              <span className="font-bold">Proof of</span>{" "}
              <span className="font-light">Performance</span>
            </h2>
            <hr className="border-t-2 border-foreground mt-8" />
          </div>

          <div className="lg:col-span-3 space-y-16">
            {/* Rendered case studies */}
            {caseStudies.map((cs, idx) => (
              <div key={cs.id || idx} className="group relative">
                {/* Delete button */}
                <button
                  onClick={() => handleDelete(idx)}
                  className="absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-foreground/80 text-background opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                {/* Company + tagline */}
                <h3 className="text-2xl font-bold text-foreground">{cs.company}</h3>
                <p className="text-base text-muted-foreground italic mt-1 mb-6">{cs.tagline}</p>

                {/* Screenshot */}
                {cs.screenshot_url ? (
                  <div className="rounded-xl border border-border shadow-sm overflow-hidden mb-6 relative group/img">
                    <img src={cs.screenshot_url} alt={`${cs.company} website`} className="w-full" />
                    <button
                      onClick={() => {
                        const updated = caseStudies.map((c, i) => i === idx ? { ...c, screenshot_url: "" } : c);
                        onCaseStudiesChange(updated);
                        saveCaseStudies(updated);
                      }}
                      className="absolute top-2 right-2 h-7 w-7 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="rounded-xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center h-48 mb-6 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => {
                      setUploadingScreenshot(cs.id || String(idx));
                      screenshotInputRef.current?.click();
                    }}
                  >
                    {uploadingScreenshot === (cs.id || String(idx)) ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <ImagePlus className="h-8 w-8 text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">Click to add screenshot</p>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={screenshotInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const targetIdx = caseStudies.findIndex((c, i) => (c.id || String(i)) === uploadingScreenshot);
                      if (targetIdx >= 0) handleScreenshotUpload(targetIdx, file);
                    }
                    e.target.value = "";
                  }}
                />

                {/* Metrics */}
                {cs.metrics.length > 0 && (
                  <div className="flex items-start gap-8 mb-6">
                    {cs.metrics.map((m, i) => (
                      <div key={i}>
                        <p className="text-3xl font-bold text-foreground">{m.stat}</p>
                        <p className="text-sm text-muted-foreground">{m.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Description */}
                <p className="text-base text-muted-foreground leading-relaxed mb-6">{cs.description}</p>

                {/* Why It Matters */}
                <div className="border-l-[3px] border-foreground pl-6 py-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Why It Matters for {name}
                  </p>
                  <p className="text-base text-muted-foreground leading-relaxed">{cs.why_it_matters}</p>
                </div>
              </div>
            ))}

            {/* Add Case Study zone */}
            {isProcessing ? (
              <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03] p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">{processingLabel || "Processing..."}</p>
              </div>
            ) : (
              <div
                className={`rounded-xl border-2 border-dashed p-8 transition-colors ${
                  dragOver ? "border-primary bg-primary/[0.05]" : "border-border bg-muted/10 hover:bg-muted/20"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <div className="text-center">
                  <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-base font-medium text-foreground mb-1">Add Case Study</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Drop files here, or use the buttons below. Upload docs, images, or paste text about a client project.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileText className="h-4 w-4" />
                      Upload Files
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setShowTextInput(!showTextInput)}
                    >
                      <FileText className="h-4 w-4" />
                      Paste Text
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) handleFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>

                {showTextInput && (
                  <div className="mt-4 space-y-3">
                    <textarea
                      className="w-full rounded-lg border border-border bg-background p-3 text-sm min-h-[120px] resize-y outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Paste case study content here... company name, metrics, description, anything you have."
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                    />
                    <Button size="sm" onClick={handleTextSubmit} disabled={!textInput.trim()}>
                      Generate Case Study
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
