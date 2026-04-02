import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, ImagePlus, FileText, Trash2, GripVertical, HardDrive, Link2 } from "lucide-react";
import { toast } from "sonner";
import { GoogleDrivePicker } from "@/components/drive/GoogleDrivePicker";

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
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [driveOpen, setDriveOpen] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<{ name: string; content: string; type: 'file' | 'drive' | 'url' | 'text' }[]>([]);
  const [stagedScreenshotUrl, setStagedScreenshotUrl] = useState("");
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

  // ── Stage files (parse but don't generate yet) ────────────────
  const handleFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) continue;
      try {
        setProcessingLabel(`Parsing ${file.name}...`);
        setIsProcessing(true);
        const text = await parseFile(file);
        if (text.trim()) setStagedFiles(prev => [...prev, { name: file.name, content: text, type: 'file' }]);
      } catch { toast.error(`Failed to parse ${file.name}`); }
    }
    setIsProcessing(false);
    setProcessingLabel("");
  };

  // ── Stage text ───────────────────────────────────────────────
  const handleStageText = () => {
    if (!textInput.trim()) return;
    setStagedFiles(prev => [...prev, { name: "Pasted text", content: textInput.trim(), type: 'text' }]);
    setTextInput("");
    setShowTextInput(false);
  };

  // ── Stage URL (scrape + screenshot + quick name extraction) ──
  const handleStageUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setIsProcessing(true);
    try {
      // Fire scrape and screenshot in parallel
      setProcessingLabel("Fetching site...");
      const [scrapeResult, ssResult] = await Promise.allSettled([
        supabase.functions.invoke("firecrawl-scrape", { body: { url, formats: ["markdown"], onlyMainContent: true } }),
        supabase.functions.invoke("thum-screenshot", { body: { url } }),
      ]);

      // Handle scrape
      let rawContent = "";
      if (scrapeResult.status === "fulfilled" && scrapeResult.value.data) {
        const d = scrapeResult.value.data;
        rawContent = d?.markdown || d?.text || d?.content || url;
      }
      if (rawContent.trim()) setStagedFiles(prev => [...prev, { name: url, content: rawContent, type: 'url' }]);

      // Handle screenshot
      if (ssResult.status === "fulfilled" && ssResult.value.data) {
        const ssUrl = ssResult.value.data?.screenshotUrl || ssResult.value.data?.screenshot_url;
        if (ssUrl) setStagedScreenshotUrl(ssUrl);
      }

      // Quick name extraction from the scraped content (first line or title)
      if (rawContent) {
        const firstLine = rawContent.split('\n').find(l => l.trim() && !l.startsWith('#') && !l.startsWith('['));
        const titleMatch = rawContent.match(/^#\s+(.+)/m);
        const quickName = titleMatch?.[1] || firstLine?.slice(0, 60) || url;
        // Update the staged file name to something readable
        setStagedFiles(prev => prev.map(f => f.name === url ? { ...f, name: `${quickName} (${url})` } : f));
      }

      setUrlInput("");
      setShowUrlInput(false);
    } catch (e: any) { toast.error(e?.message || "Failed to fetch URL"); }
    setIsProcessing(false);
    setProcessingLabel("");
  };

  // ── Stage Google Drive files ─────────────────────────────────
  const handleDriveFiles = (files: { name: string; content?: string; mimeType: string; isText: boolean }[]) => {
    setDriveOpen(false);
    const textFiles = files.filter(f => f.isText && f.content);
    if (!textFiles.length) { toast.error("No text content found"); return; }
    setStagedFiles(prev => [...prev, ...textFiles.map(f => ({ name: f.name, content: f.content!, type: 'drive' as const }))]);
  };

  // ── Remove staged file ───────────────────────────────────────
  const removeStagedFile = (idx: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // ── GENERATE: combine all staged content and submit ──────────
  const handleGenerate = async () => {
    const allContent = stagedFiles.map(f => f.content).join("\n\n---\n\n");
    if (!allContent.trim()) { toast.error("Add some content first"); return; }
    setIsProcessing(true);
    setProcessingLabel("AI is structuring the case study...");
    try {
      const newStudy = await generateCaseStudy(allContent);
      if (stagedScreenshotUrl) newStudy.screenshot_url = stagedScreenshotUrl;
      const updated = [...caseStudies, newStudy];
      onCaseStudiesChange(updated);
      await saveCaseStudies(updated);
      setStagedFiles([]);
      setStagedScreenshotUrl("");
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

          <div className="hidden lg:block lg:col-span-1" />
          <div className="lg:col-span-2 space-y-16">
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
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                      <FileText className="h-4 w-4" />
                      Upload Files
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDriveOpen(true)}>
                      <HardDrive className="h-4 w-4" />
                      Google Drive
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setShowUrlInput(!showUrlInput); setShowTextInput(false); }}>
                      <Link2 className="h-4 w-4" />
                      From URL
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setShowTextInput(!showTextInput); setShowUrlInput(false); }}>
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
                  <GoogleDrivePicker open={driveOpen} onOpenChange={setDriveOpen} onFilesSelected={handleDriveFiles} />
                </div>

                {showUrlInput && (
                  <div className="mt-4 space-y-3">
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                        placeholder="https://example.com — we'll screenshot it and scrape the content"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleStageUrl(); }}
                      />
                      <Button size="sm" onClick={handleStageUrl} disabled={!urlInput.trim() || isProcessing}>
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                      </Button>
                    </div>
                  </div>
                )}

                {showTextInput && (
                  <div className="mt-4 space-y-3">
                    <textarea
                      className="w-full rounded-lg border border-border bg-background p-3 text-sm min-h-[100px] resize-y outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Paste case study content here... company name, metrics, description, anything you have."
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                    />
                    <Button size="sm" variant="outline" onClick={handleStageText} disabled={!textInput.trim()}>
                      Add to Staged
                    </Button>
                  </div>
                )}

                {/* Staged files list + Generate button */}
                {stagedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Staged Content ({stagedFiles.length})</p>
                    {stagedFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground truncate flex-1">{f.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{f.type}</span>
                        <button onClick={() => removeStagedFile(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {stagedScreenshotUrl && (
                      <div className="rounded-md border border-border bg-muted/30 overflow-hidden">
                        <img src={stagedScreenshotUrl} alt="Screenshot preview" className="w-full max-h-48 object-cover object-top" />
                        <div className="flex items-center gap-2 px-3 py-1.5">
                          <ImagePlus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground flex-1">Screenshot will be used as case study image</span>
                          <button onClick={() => setStagedScreenshotUrl("")} className="text-muted-foreground hover:text-destructive shrink-0">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                    <Button className="w-full mt-2" onClick={handleGenerate} disabled={isProcessing}>
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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
