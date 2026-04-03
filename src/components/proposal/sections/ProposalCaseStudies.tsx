import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, ImagePlus, FileText, Trash2, HardDrive, Link2 } from "lucide-react";
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
  references?: string[];
}

interface StagedPreview {
  company: string;
  tagline: string;
  screenshotUrl: string;
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

/** Extract a quick company name + tagline from metadata + markdown — no API call needed */
function extractPreview(
  markdown: string,
  fallbackUrl?: string,
  metadata?: { title?: string; description?: string; ogTitle?: string; ogDescription?: string; siteName?: string },
): { company: string; tagline: string } {
  // Prefer metadata for company name (much cleaner than parsing markdown)
  const metaTitle = metadata?.ogTitle || metadata?.siteName || metadata?.title || "";
  // Strip common suffixes like " | Company" or " - Tagline"
  const cleanTitle = metaTitle.split(/\s*[|–—-]\s*/)[0]?.trim();

  // Fallback to markdown H1
  const h1 = markdown.match(/^#\s+(.+)/m)?.[1]?.trim()?.replace(/[#*_\[\]]/g, "").trim();

  let company = cleanTitle || h1 || fallbackUrl || "Case Study";
  if (company.length > 60) company = company.slice(0, 60);

  // Tagline: prefer meta description, then OG description, then first short paragraph
  const metaDesc = metadata?.ogDescription || metadata?.description || "";
  let tagline = "";
  if (metaDesc && metaDesc.length >= 10 && metaDesc.length <= 300) {
    tagline = metaDesc;
  } else {
    const lines = markdown.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#") && l.length >= 15 && l.length <= 200);
    tagline = lines[0] || "";
    tagline = tagline.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_]/g, "").trim();
  }
  if (!tagline) tagline = `Digital presence for ${company}`;
  if (tagline.length > 150) tagline = tagline.slice(0, 147) + "...";

  return { company, tagline };
}

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
  const [stagedFiles, setStagedFiles] = useState<{ name: string; content: string; type: "file" | "drive" | "url" | "text" }[]>([]);
  const [stagedScreenshotUrl, setStagedScreenshotUrl] = useState("");
  const [stagedPreview, setStagedPreview] = useState<StagedPreview | null>(null);
  const [stagedOceanData, setStagedOceanData] = useState<Record<string, any> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingStudy, setPendingStudy] = useState<StagedPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState<string | null>(null);

  const name = clientName || domain || "the client";

  // ── Save case studies to DB ──────────────────────────────────
  const saveCaseStudies = useCallback(async (studies: CaseStudy[]) => {
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
          sources: cs.references || null,
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

  // ── Generate case study from raw content (Opus) ──────────────
  const generateCaseStudy = async (rawContent: string, oceanData?: Record<string, any> | null, stagedFileNames?: string[]): Promise<CaseStudy> => {
    // If we have Ocean.io data, prepend a structured company profile to the raw content
    let enrichedContent = rawContent;
    if (oceanData?.success) {
      const parts: string[] = ["## Company Profile (from Ocean.io)"];
      if (oceanData.companyName) parts.push(`Company: ${oceanData.companyName}`);
      if (oceanData.description) parts.push(`Description: ${oceanData.description}`);
      if (oceanData.industries?.length) parts.push(`Industries: ${oceanData.industries.join(", ")}`);
      if (oceanData.companySize) parts.push(`Company Size: ${oceanData.companySize}`);
      if (oceanData.employeeCountLinkedin) parts.push(`Employees (LinkedIn): ${oceanData.employeeCountLinkedin}`);
      if (oceanData.revenue) parts.push(`Revenue: ${oceanData.revenue}`);
      if (oceanData.yearFounded) parts.push(`Founded: ${oceanData.yearFounded}`);
      if (oceanData.primaryCountry) parts.push(`HQ: ${oceanData.primaryCountry}`);
      if (oceanData.technologies?.length) parts.push(`Tech Stack: ${oceanData.technologies.slice(0, 15).join(", ")}`);
      enrichedContent = parts.join("\n") + "\n\n---\n\n" + rawContent;
    }

    const resp = await fetch(GENERATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ rawContent: enrichedContent, clientName: name, domain, sessionId }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Generation failed: ${err}`);
    }
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    const cs = data.caseStudy;
    // Build references list: staged files + Ocean.io + RAG sources from edge function
    const refs: string[] = [];
    if (stagedFileNames?.length) refs.push(...stagedFileNames.map(n => `Uploaded: ${n}`));
    if (oceanData?.success) refs.push(`Ocean.io: ${oceanData.companyName || 'Company Enrichment'}`);
    if (data.references?.length) refs.push(...data.references);
    return {
      sort_order: caseStudies.length,
      company: cs.company || "",
      tagline: cs.tagline || "",
      screenshot_url: "",
      metrics: cs.metrics || [],
      description: cs.description || "",
      why_it_matters: cs.whyItMatters || cs.why_it_matters || "",
      raw_content: rawContent,
      references: refs.length ? refs : undefined,
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
        if (text.trim()) {
          setStagedFiles(prev => [...prev, { name: file.name, content: text, type: "file" }]);
          // Update preview from content
          const preview = extractPreview(text);
          setStagedPreview(prev => prev ? { ...prev, company: preview.company, tagline: preview.tagline } : { ...preview, screenshotUrl: "" });
        }
      } catch { toast.error(`Failed to parse ${file.name}`); }
    }
    setIsProcessing(false);
    setProcessingLabel("");
  };

  // ── Stage text ───────────────────────────────────────────────
  const handleStageText = () => {
    if (!textInput.trim()) return;
    const preview = extractPreview(textInput.trim());
    setStagedFiles(prev => [...prev, { name: "Pasted text", content: textInput.trim(), type: "text" }]);
    setStagedPreview(prev => prev ? { ...prev, company: preview.company, tagline: preview.tagline } : { ...preview, screenshotUrl: "" });
    setTextInput("");
    setShowTextInput(false);
  };

  // ── Upload a base64 screenshot to Supabase Storage ──────────
  const uploadBase64Screenshot = async (base64DataUrl: string): Promise<string | null> => {
    try {
      // base64DataUrl is like "data:image/png;base64,iVBOR..."
      const match = base64DataUrl.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
      if (!match) return null;
      const ext = match[1] === "jpeg" ? "jpg" : match[1];
      const raw = atob(match[2]);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const blob = new Blob([bytes], { type: `image/${match[1]}` });
      const path = `case-studies/${sessionId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("screenshots").upload(path, blob, { upsert: true });
      if (error) { console.warn("[case-study] Screenshot upload error:", error); return null; }
      const { data: urlData } = supabase.storage.from("screenshots").getPublicUrl(path);
      return urlData.publicUrl;
    } catch (e) { console.warn("[case-study] Screenshot upload failed:", e); return null; }
  };

  // ── Extract domain from URL ──────────────────────────────────
  const extractDomain = (url: string): string => {
    try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); }
    catch { return url; }
  };

  // ── Stage URL — Firecrawl + Ocean.io in parallel ──────────────
  const handleStageUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setIsProcessing(true);
    setUrlInput("");
    setShowUrlInput(false);
    const caseDomain = extractDomain(url);

    try {
      setProcessingLabel("Scraping content & enriching company data...");

      // Fire Firecrawl and Ocean.io in parallel
      const [scrapeResult, oceanResult] = await Promise.allSettled([
        supabase.functions.invoke("firecrawl-scrape", {
          body: { url, options: { formats: ["markdown", "screenshot"], onlyMainContent: true } },
        }),
        supabase.functions.invoke("ocean-enrich", { body: { domain: caseDomain } }),
      ]);

      // Process Firecrawl result
      const scrapeData = scrapeResult.status === "fulfilled" ? scrapeResult.value.data : null;
      if (scrapeResult.status === "rejected" || scrapeResult.value.error) {
        throw scrapeResult.status === "rejected" ? scrapeResult.reason : scrapeResult.value.error;
      }
      const payload = scrapeData?.data || scrapeData;
      const rawContent = payload?.markdown || payload?.text || payload?.content || url;
      const metadata = payload?.metadata;

      // Process Ocean.io result (non-blocking — enrichment is optional)
      const oceanData = oceanResult.status === "fulfilled" && !oceanResult.value.error
        ? oceanResult.value.data : null;
      if (oceanData?.success) {
        setStagedOceanData(oceanData);
      }

      // Build preview — Ocean.io data takes priority for company name & description
      const preview = extractPreview(rawContent, url, metadata);
      const companyName = (oceanData?.success && oceanData?.companyName) || preview.company;
      const tagline = (oceanData?.success && oceanData?.description)
        ? (oceanData.description.length > 150 ? oceanData.description.slice(0, 147) + "..." : oceanData.description)
        : preview.tagline;

      if (rawContent.trim()) setStagedFiles(prev => [...prev, { name: companyName, content: rawContent, type: "url" }]);

      // Handle screenshot
      const screenshotRaw = payload?.screenshot;
      let ssUrl = "";
      if (screenshotRaw) {
        if (screenshotRaw.startsWith("data:image")) {
          setProcessingLabel("Saving screenshot...");
          ssUrl = (await uploadBase64Screenshot(screenshotRaw)) || "";
        } else if (screenshotRaw.startsWith("http")) {
          ssUrl = screenshotRaw;
        }
      }

      setStagedPreview({ company: companyName, tagline, screenshotUrl: ssUrl });
      if (ssUrl) setStagedScreenshotUrl(ssUrl);

      setIsProcessing(false);
      setProcessingLabel("");
      const enrichLabel = oceanData?.success ? " + company enriched" : "";
      toast.success(ssUrl ? `Content & screenshot captured${enrichLabel}` : `Site content scraped${enrichLabel}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to scrape URL");
      setIsProcessing(false);
      setProcessingLabel("");
    }
  };

  // ── Stage Google Drive files ─────────────────────────────────
  const handleDriveFiles = (files: { name: string; content?: string; mimeType: string; isText: boolean }[]) => {
    setDriveOpen(false);
    const textFiles = files.filter(f => f.isText && f.content);
    if (!textFiles.length) { toast.error("No text content found"); return; }
    setStagedFiles(prev => [...prev, ...textFiles.map(f => ({ name: f.name, content: f.content!, type: "drive" as const }))]);
    // Update preview from first file
    if (textFiles[0]?.content) {
      const preview = extractPreview(textFiles[0].content);
      setStagedPreview(prev => prev ? { ...prev, company: preview.company, tagline: preview.tagline } : { ...preview, screenshotUrl: "" });
    }
  };

  // ── Remove staged file ───────────────────────────────────────
  const removeStagedFile = (idx: number) => {
    setStagedFiles(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (!next.length) { setStagedPreview(null); setStagedScreenshotUrl(""); setStagedOceanData(null); }
      return next;
    });
  };

  // ── GENERATE: show preview card immediately, Opus fills the rest ──
  const handleGenerate = async () => {
    const allContent = stagedFiles.map(f => f.content).join("\n\n---\n\n");
    if (!allContent.trim()) { toast.error("Add some content first"); return; }

    // Show the pending card immediately with preview data
    const preview: StagedPreview = stagedPreview || { company: "Loading...", tagline: "", screenshotUrl: "" };
    const ssUrl = stagedScreenshotUrl || preview.screenshotUrl;
    setPendingStudy({ company: preview.company, tagline: preview.tagline, screenshotUrl: ssUrl });
    setIsGenerating(true);

    // Capture references before clearing
    const oceanForGeneration = stagedOceanData;
    const fileNames = stagedFiles.map(f => f.name);

    // Clear staging
    setStagedFiles([]);
    setStagedScreenshotUrl("");
    setStagedPreview(null);
    setStagedOceanData(null);

    try {
      const newStudy = await generateCaseStudy(allContent, oceanForGeneration, fileNames);
      if (ssUrl) newStudy.screenshot_url = ssUrl;
      // Use Opus company/tagline if better, but keep screenshot
      const updated = [...caseStudies, newStudy];
      onCaseStudiesChange(updated);
      await saveCaseStudies(updated);
      setPendingStudy(null);
      toast.success(`Case study for ${newStudy.company} created`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to create case study");
      setPendingStudy(null);
    }
    setIsGenerating(false);
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
      const updated = caseStudies.map((c, i) => i === idx ? { ...c, screenshot_url: urlData.publicUrl } : c);
      onCaseStudiesChange(updated);
      await saveCaseStudies(updated);
    } catch {
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
            {/* Shared screenshot upload input */}
            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && uploadingScreenshot != null) {
                  const targetIdx = caseStudies.findIndex((c, i) => (c.id || String(i)) === uploadingScreenshot);
                  if (targetIdx >= 0) handleScreenshotUpload(targetIdx, file);
                }
                e.target.value = "";
              }}
            />

            {/* Rendered case studies */}
            {caseStudies.map((cs, idx) => (
              <CaseStudyCard
                key={cs.id || idx}
                cs={cs}
                idx={idx}
                name={name}
                uploadingScreenshot={uploadingScreenshot}
                onDelete={handleDelete}
                onClickUploadScreenshot={(csKey) => {
                  setUploadingScreenshot(csKey);
                  screenshotInputRef.current?.click();
                }}
                onRemoveScreenshot={(i) => {
                  const updated = caseStudies.map((c, j) => j === i ? { ...c, screenshot_url: "" } : c);
                  onCaseStudiesChange(updated);
                  saveCaseStudies(updated);
                }}
              />
            ))}

            {/* Pending study — shown while Opus is writing */}
            {pendingStudy && (
              <div className="relative">
                {/* Company name + tagline — real data from preview */}
                <h3 className="text-2xl font-bold text-foreground">{pendingStudy.company}</h3>
                <p className="text-base text-muted-foreground italic mt-1 mb-6 truncate">{pendingStudy.tagline}</p>

                {/* Screenshot — real if available, shimmer if not */}
                {pendingStudy.screenshotUrl ? (
                  <div className="rounded-xl border border-border shadow-sm overflow-hidden mb-6">
                    <img src={pendingStudy.screenshotUrl} alt={`${pendingStudy.company} website`} className="w-full" />
                  </div>
                ) : (
                  <div className="skeleton-shimmer rounded-xl h-48 mb-6" />
                )}

                {/* Shimmer metrics */}
                <div className="grid grid-cols-5 gap-3 mb-6">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="space-y-2">
                      <div className="skeleton-shimmer h-9 w-16" />
                      <div className="skeleton-shimmer h-4 w-full" />
                    </div>
                  ))}
                </div>

                {/* Shimmer description */}
                <div className="space-y-2 mb-6">
                  <div className="skeleton-shimmer h-4 w-full" />
                  <div className="skeleton-shimmer h-4 w-4/5" />
                </div>

                {/* Shimmer why it matters */}
                <div className="border-l-[3px] border-foreground/20 pl-6 py-2">
                  <div className="skeleton-shimmer h-3 w-44 mb-3" />
                  <div className="space-y-2">
                    <div className="skeleton-shimmer h-4 w-full" />
                    <div className="skeleton-shimmer h-4 w-3/5" />
                  </div>
                </div>

                {/* Generating label */}
                <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>AI is writing the case study...</span>
                </div>
              </div>
            )}

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
                        placeholder="https://example.com"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleStageUrl(); }}
                      />
                      <Button size="sm" onClick={handleStageUrl} disabled={!urlInput.trim() || isProcessing}>
                        Add
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

                {/* Staged preview card + files list */}
                {stagedFiles.length > 0 && (
                  <div className="mt-6 space-y-4">
                    {/* Preview card */}
                    {stagedPreview && (
                      <div className="rounded-lg border border-border bg-background p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</p>
                          {stagedOceanData?.success && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              Ocean.io Enriched
                            </span>
                          )}
                        </div>
                        <h4 className="text-lg font-bold text-foreground">{stagedPreview.company}</h4>
                        <p className="text-sm text-muted-foreground italic mt-0.5 mb-3">{stagedPreview.tagline}</p>
                        {/* Ocean.io enrichment details */}
                        {stagedOceanData?.success && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
                            {stagedOceanData.industries?.length > 0 && (
                              <span>{stagedOceanData.industries.slice(0, 2).join(", ")}</span>
                            )}
                            {stagedOceanData.companySize && <span>{stagedOceanData.companySize} employees</span>}
                            {stagedOceanData.yearFounded && <span>Est. {stagedOceanData.yearFounded}</span>}
                            {stagedOceanData.primaryCountry && <span>{stagedOceanData.primaryCountry}</span>}
                          </div>
                        )}
                        {stagedPreview.screenshotUrl ? (
                          <div className="rounded-lg border border-border overflow-hidden">
                            <img src={stagedPreview.screenshotUrl} alt="Preview" className="w-full max-h-40 object-cover object-top" />
                          </div>
                        ) : stagedScreenshotUrl ? (
                          <div className="rounded-lg border border-border overflow-hidden">
                            <img src={stagedScreenshotUrl} alt="Preview" className="w-full max-h-40 object-cover object-top" />
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border bg-muted/10 h-24 flex items-center justify-center">
                            <p className="text-xs text-muted-foreground">Screenshot loading...</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Staged content list */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Staged Content ({stagedFiles.length})
                      </p>
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
                    </div>

                    <Button className="w-full" onClick={handleGenerate} disabled={isGenerating}>
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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

/* ── Case study card (extracted to reduce main component size) ── */
function CaseStudyCard({
  cs, idx, name, uploadingScreenshot,
  onDelete, onClickUploadScreenshot, onRemoveScreenshot,
}: {
  cs: CaseStudy;
  idx: number;
  name: string;
  uploadingScreenshot: string | null;
  onDelete: (i: number) => void;
  onClickUploadScreenshot: (csKey: string) => void;
  onRemoveScreenshot: (i: number) => void;
}) {
  const csKey = cs.id || String(idx);
  return (
    <div className="group relative">
      <button
        onClick={() => onDelete(idx)}
        className="absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-foreground/80 text-background opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <h3 className="text-2xl font-bold text-foreground">{cs.company}</h3>
      <p className="text-base text-muted-foreground italic mt-1 mb-6 truncate">{cs.tagline}</p>

      {cs.screenshot_url ? (
        <div className="rounded-xl border border-border shadow-sm overflow-hidden mb-6 relative group/img">
          <img src={cs.screenshot_url} alt={`${cs.company} website`} className="w-full" />
          <button
            onClick={() => onRemoveScreenshot(idx)}
            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-foreground/80 text-background flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          className="rounded-xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center h-48 mb-6 cursor-pointer hover:bg-muted/40 transition-colors"
          onClick={() => onClickUploadScreenshot(csKey)}
        >
          {uploadingScreenshot === csKey ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <ImagePlus className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Click to add screenshot</p>
            </>
          )}
        </div>
      )}

      {cs.metrics.length > 0 && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          {cs.metrics.map((m, i) => (
            <div key={i}>
              <p className="text-3xl font-bold text-foreground">{m.stat}</p>
              <p className="text-sm text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-base text-muted-foreground leading-relaxed mb-6">{cs.description}</p>

      <div className="border-l-[3px] border-foreground pl-6 py-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Why It Matters for {name}
        </p>
        <p className="text-base text-muted-foreground leading-relaxed">{cs.why_it_matters}</p>
      </div>

      {/* Admin-only references — not visible to clients */}
      {cs.references && cs.references.length > 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
              Editor Only — Not visible to clients
            </p>
          </div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Sources used to generate this case study:</p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {cs.references.map((ref, i) => (
              <li key={i} className="truncate">• {ref}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
