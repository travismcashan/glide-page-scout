import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2, Send, MessageCircle, Paperclip, X, FileText, Image as ImageIcon, Wand2, Copy, Check, Link2, ExternalLink, HardDrive } from 'lucide-react';
import { GoogleDrivePicker } from '@/components/drive/GoogleDrivePicker';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { WishlistItem } from './KanbanCard';

const STATUS_OPTIONS = [
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'planned', label: 'Planned' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const CATEGORY_OPTIONS = [
  { value: 'feature', label: 'Feature' },
  { value: 'bug', label: 'Bug' },
  { value: 'idea', label: 'Idea' },
  { value: 'plan', label: 'Plan' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const EFFORT_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

type Comment = {
  id: string;
  content: string;
  created_at: string;
  user_id: string | null;
  profile?: { display_name: string | null; avatar_url: string | null } | null;
};

type Attachment = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
};

type CardDetailModalProps = {
  item: WishlistItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (item: WishlistItem) => void;
  onDelete: (id: string) => void;
};

export function CardDetailModal({ item, open, onOpenChange, onUpdate, onDelete }: CardDetailModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('feature');
  const [status, setStatus] = useState('wishlist');
  const [priority, setPriority] = useState('medium');
  const [effort, setEffort] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingItem, setDeletingItem] = useState(false);

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [copied, setCopied] = useState(false);

  // Link attachment
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [addingLink, setAddingLink] = useState(false);

  // Google Drive picker
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || '');
      setCategory(item.category);
      setStatus(item.status);
      setPriority(item.priority);
      setEffort(item.effort_estimate || '');
      loadComments(item.id);
      loadAttachments(item.id);
    }
  }, [item]);

  async function loadComments(itemId: string) {
    const { data } = await supabase
      .from('wishlist_comments')
      .select('*')
      .eq('wishlist_item_id', itemId)
      .order('created_at', { ascending: true });

    const comments = (data as any[]) || [];
    const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
    if (userIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds);
      if (profiles?.length) {
        const profileMap = new Map(profiles.map(p => [p.id, p]));
        for (const c of comments) {
          if (c.user_id) c.profile = profileMap.get(c.user_id) || null;
        }
      }
    }
    setComments(comments);
  }

  async function loadAttachments(itemId: string) {
    const { data } = await supabase
      .from('wishlist_attachments')
      .select('*')
      .eq('wishlist_item_id', itemId)
      .order('created_at', { ascending: false });
    setAttachments((data as Attachment[]) || []);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length || !item) return;
    setUploading(true);

    const { data: { user } } = await supabase.auth.getUser();

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop() || 'bin';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${item.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('wishlist-attachments')
        .upload(path, file);

      if (uploadError) {
        toast.error('Upload failed', { description: uploadError.message });
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('wishlist-attachments')
        .getPublicUrl(path);

      await supabase.from('wishlist_attachments').insert({
        wishlist_item_id: item.id,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type || null,
        file_size: file.size,
        uploaded_by: user?.id || null,
      } as any);
    }

    setUploading(false);
    await loadAttachments(item.id);
    onUpdate({ ...item, attachment_count: (item.attachment_count || 0) + files.length });
    e.target.value = '';
  }

  async function handleDeleteAttachment(att: Attachment) {
    if (!item) return;
    // Extract storage path from URL
    const urlParts = att.file_url.split('/wishlist-attachments/');
    const storagePath = urlParts[1] ? decodeURIComponent(urlParts[1]) : null;

    if (storagePath) {
      await supabase.storage.from('wishlist-attachments').remove([storagePath]);
    }
    await supabase.from('wishlist_attachments').delete().eq('id', att.id);
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    onUpdate({ ...item, attachment_count: Math.max(0, (item.attachment_count || 0) - 1) });
  }

  async function handleGenerateCover() {
    if (!item) return;
    setGeneratingCover(true);
    try {
      const { data, error } = await supabase.functions.invoke('wishlist-cover-image', {
        body: { item_id: item.id, title: title || item.title, description: description || item.description },
      });
      if (error) throw error;
      if (data?.error) { toast.error('Image generation failed', { description: data.error }); return; }
      if (data?.cover_image_url) {
        onUpdate({ ...item, cover_image_url: data.cover_image_url });
        toast.success('Cover image generated');
      }
    } catch (e: any) {
      toast.error('Failed', { description: e.message || 'Try again' });
    } finally {
      setGeneratingCover(false);
    }
  }

  async function handleAddLink() {
    if (!linkUrl.trim() || !item) return;
    setAddingLink(true);
    const { data: { user } } = await supabase.auth.getUser();

    // Derive a display name from the URL
    const url = linkUrl.trim();
    const isGoogleDrive = /drive\.google\.com|docs\.google\.com/.test(url);
    const displayName = isGoogleDrive
      ? 'Google Drive file'
      : new URL(url).hostname.replace('www.', '') + new URL(url).pathname.split('/').pop();

    await supabase.from('wishlist_attachments').insert({
      wishlist_item_id: item.id,
      file_name: displayName,
      file_url: url,
      file_type: 'link',
      file_size: null,
      uploaded_by: user?.id || null,
      source: isGoogleDrive ? 'google_drive' : 'link',
    } as any);

    setLinkUrl('');
    setLinkInputOpen(false);
    setAddingLink(false);
    await loadAttachments(item.id);
    onUpdate({ ...item, attachment_count: (item.attachment_count || 0) + 1 });
  }

  async function handleDriveFilesLinked(driveFiles: { id: string; name: string; mimeType: string; url: string }[]) {
    if (!item) return;
    const { data: { user } } = await supabase.auth.getUser();
    for (const df of driveFiles) {
      await supabase.from('wishlist_attachments').insert({
        wishlist_item_id: item.id,
        file_name: df.name,
        file_url: df.url,
        file_type: 'link',
        file_size: null,
        uploaded_by: user?.id || null,
        source: 'google_drive',
      } as any);
    }
    await loadAttachments(item.id);
    onUpdate({ ...item, attachment_count: (item.attachment_count || 0) + driveFiles.length });
    toast.success(`${driveFiles.length} file${driveFiles.length > 1 ? 's' : ''} linked from Google Drive`);
  }

  async function handleSendComment() {
    if (!newComment.trim() || !item) return;
    setSendingComment(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('wishlist_comments').insert({
      wishlist_item_id: item.id,
      user_id: user?.id || null,
      content: newComment.trim(),
    } as any);
    setNewComment('');
    setSendingComment(false);
    await loadComments(item.id);
    // Update count on parent
    onUpdate({ ...item, comment_count: (item.comment_count || 0) + 1 });
  }

  if (!item) return null;

  const hasChanges =
    title !== item.title ||
    description !== (item.description || '') ||
    category !== item.category ||
    status !== item.status ||
    priority !== item.priority ||
    effort !== (item.effort_estimate || '');

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    const updates = {
      title: title.trim(),
      description: description.trim() || null,
      category,
      status,
      priority,
      effort_estimate: effort || null,
    };
    await supabase.from('wishlist_items').update(updates as any).eq('id', item!.id);
    onUpdate({ ...item!, ...updates });
    setSaving(false);
    toast.success('Card updated');
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${item!.title.slice(0, 60)}"?`)) return;
    setDeletingItem(true);
    onDelete(item!.id);
    setDeletingItem(false);
    onOpenChange(false);
  }

  const createdDate = new Date(item.created_at).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Edit Card</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold border-0 px-0 h-auto focus-visible:ring-0 shadow-none"
            placeholder="Card title"
          />

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
              placeholder="Describe what needs to happen..."
            />
          </div>

          {/* Cover image */}
          {item.cover_image_url && (
            <div className="rounded-lg overflow-hidden">
              <img src={item.cover_image_url} alt="" className="w-full h-40 object-cover rounded-lg" />
            </div>
          )}
          {(effort === 'large' || !effort) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateCover}
              disabled={generatingCover}
              className="w-full"
            >
              {generatingCover ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
              {generatingCover ? 'Generating cover image...' : item.cover_image_url ? 'Regenerate cover image' : 'Generate cover image'}
            </Button>
          )}

          {/* Fields grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Effort</label>
              <Select value={effort || 'none'} onValueChange={(v) => setEffort(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {EFFORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
            {item.profiles?.avatar_url ? (
              <img src={item.profiles.avatar_url} alt="" className="h-6 w-6 rounded-full" />
            ) : item.profiles?.display_name ? (
              <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                {item.profiles.display_name.charAt(0).toUpperCase()}
              </span>
            ) : null}
            {item.profiles?.display_name && (
              <span>{item.profiles.display_name}</span>
            )}
            <span className="text-xs">{createdDate}</span>
          </div>

          {/* Attachments */}
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Attachments</span>
              {attachments.length > 0 && (
                <span className="text-xs text-muted-foreground">{attachments.length}</span>
              )}
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => setDrivePickerOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <HardDrive className="h-3 w-3" />
                  Google Drive
                </button>
                <button
                  onClick={() => setLinkInputOpen(!linkInputOpen)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Link2 className="h-3 w-3" />
                  Add link
                </button>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                    {uploading ? 'Uploading...' : 'Add file'}
                  </span>
                </label>
              </div>
            </div>

            {/* Link input */}
            {linkInputOpen && (
              <div className="flex gap-2 mb-3">
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Paste a Google Drive or any URL..."
                  className="text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleAddLink}
                  disabled={addingLink || !linkUrl.trim()}
                >
                  {addingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
                </Button>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {attachments.map((att) => {
                  const isImage = att.file_type?.startsWith('image/');
                  const isLink = att.file_type === 'link';
                  const isDrive = /drive\.google\.com|docs\.google\.com/.test(att.file_url);
                  return (
                    <div key={att.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 group">
                      {isDrive ? (
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                          <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                          <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                          <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.8z" fill="#ea4335"/>
                          <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                          <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                          <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.8h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                        </svg>
                      ) : isLink ? (
                        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : isImage ? (
                        <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <a
                        href={att.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-foreground hover:underline truncate flex-1"
                      >
                        {att.file_name}
                      </a>
                      {att.file_size && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {att.file_size < 1024 ? `${att.file_size}B` : att.file_size < 1048576 ? `${Math.round(att.file_size / 1024)}KB` : `${(att.file_size / 1048576).toFixed(1)}MB`}
                        </span>
                      )}
                      <button
                        onClick={() => handleDeleteAttachment(att)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Comments</span>
              {comments.length > 0 && (
                <span className="text-xs text-muted-foreground">{comments.length}</span>
              )}
            </div>

            {comments.length > 0 && (
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    {c.profile?.avatar_url ? (
                      <img src={c.profile.avatar_url} alt="" className="h-6 w-6 rounded-full shrink-0 mt-0.5" />
                    ) : (
                      <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
                        {(c.profile?.display_name || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{c.profile?.display_name || 'Unknown'}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* New comment input */}
            <div className="flex gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="text-sm"
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendComment()}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSendComment}
                disabled={sendingComment || !newComment.trim()}
                className="shrink-0"
              >
                {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={deletingItem}
              >
                {deletingItem ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const prompt = [
                    `Implement the following wishlist item:`,
                    ``,
                    `**${title}**`,
                    description ? `${description}` : null,
                    ``,
                    `Category: ${category} | Priority: ${priority} | Effort: ${effort || 'unknown'}`,
                    `Status: ${status}`,
                    ``,
                    `First, move this card to "in-progress" on the Kanban board. When complete, move it to "done".`,
                  ].filter(Boolean).join('\n');
                  navigator.clipboard.writeText(prompt);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="h-4 w-4 mr-1.5 text-green-500" /> : <Copy className="h-4 w-4 mr-1.5" />}
                {copied ? 'Copied' : 'Copy prompt'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges || !title.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
      <GoogleDrivePicker
        open={drivePickerOpen}
        onOpenChange={setDrivePickerOpen}
        onFilesSelected={() => {}}
        onFilesLinked={handleDriveFilesLinked}
      />
    </Dialog>
  );
}
