import { useRef, useState, useCallback } from 'react';
import { Plus, X, FileText, Image as ImageIcon, Loader2, Upload, HardDrive, BookOpen } from 'lucide-react';
import { GoogleDrivePicker } from '@/components/drive/GoogleDrivePicker';
import { KnowledgeBasePickerDialog } from '@/components/deep-research/KnowledgeBasePickerDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type ChatAttachment = {
  name: string;
  type: 'text' | 'image' | 'document';
  content: string; // text content or base64 data URI for images
  mimeType: string;
  parsing?: boolean;
};

const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml', '.log', '.html', '.css', '.js', '.ts'];
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const DOC_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const PARSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-upload`;
const DRIVE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-picker`;

const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

function isTextFile(file: File): boolean {
  if (file.type.startsWith('text/')) return true;
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return TEXT_EXTENSIONS.includes(ext);
}

/** Load a Google script if not already loaded */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

type Props = {
  attachments: ChatAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<ChatAttachment[]>>;
  disabled?: boolean;
  onHandleFilesRef?: React.MutableRefObject<((files: FileList) => void) | null>;
  sessionId?: string;
};

export function ChatFileUpload({ attachments, setAttachments, disabled, onHandleFilesRef, sessionId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [kbPickerOpen, setKbPickerOpen] = useState(false);

  const handleFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }

      // Text files - read as text
      if (isTextFile(file)) {
        const text = await file.text();
        setAttachments(prev => [...prev, {
          name: file.name,
          type: 'text',
          content: text,
          mimeType: file.type || 'text/plain',
        }]);
        continue;
      }

      // Images - read as base64 data URI
      if (IMAGE_TYPES.includes(file.type)) {
        const dataUri = await fileToBase64(file);
        setAttachments(prev => [...prev, {
          name: file.name,
          type: 'image',
          content: dataUri,
          mimeType: file.type,
        }]);
        continue;
      }

      // PDF / DOCX - parse server-side
      if (DOC_TYPES.includes(file.type)) {
        setParsing(true);
        const placeholder: ChatAttachment = {
          name: file.name,
          type: 'document',
          content: '',
          mimeType: file.type,
          parsing: true,
        };
        setAttachments(prev => [...prev, placeholder]);

        try {
          const base64 = await fileToBase64Raw(file);
          const resp = await fetch(PARSE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              fileBase64: base64,
              fileName: file.name,
              mimeType: file.type,
            }),
          });

          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || `Parse failed (${resp.status})`);
          }

          const { text } = await resp.json();
          setAttachments(prev =>
            prev.map(a => a.name === file.name && a.parsing
              ? { ...a, content: text, parsing: false }
              : a
            )
          );
        } catch (e: any) {
          toast.error(`Failed to parse ${file.name}: ${e.message}`);
          setAttachments(prev => prev.filter(a => !(a.name === file.name && a.parsing)));
        } finally {
          setParsing(false);
        }
        continue;
      }

      toast.error(`Unsupported file type: ${file.name}`);
    }
  };

  // Expose handleFiles to parent via ref
  if (onHandleFilesRef) {
    onHandleFilesRef.current = handleFiles;
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const [drivePickerOpen, setDrivePickerOpen] = useState(false);

  const handleDriveFilesSelected = (driveFiles: { name: string; content?: string; mimeType: string; isText: boolean }[]) => {
    for (const file of driveFiles) {
      if (!file.content) continue;
      const isImage = file.mimeType.startsWith('image/');
      setAttachments(prev => [...prev, {
        name: file.name,
        type: isImage ? 'image' : file.isText ? 'text' : 'document',
        content: file.isText ? file.content : `data:${file.mimeType};base64,${file.content}`,
        mimeType: file.mimeType,
      }]);
    }
    toast.success(`Loaded ${driveFiles.length} file${driveFiles.length !== 1 ? 's' : ''} from Google Drive`);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".txt,.md,.csv,.json,.xml,.yaml,.yml,.log,.html,.css,.js,.ts,.pdf,.docx,.png,.jpg,.jpeg,.gif,.webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full border-0 bg-transparent overflow-visible text-muted-foreground hover:bg-muted hover:text-foreground"
            style={{ width: 44, height: 44 }}
            disabled={disabled || parsing}
          >
            {parsing ? (
              <Loader2 style={{ width: 28, height: 28 }} className="animate-spin" />
            ) : (
              <Plus style={{ width: 28, height: 28 }} strokeWidth={1.5} />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" sideOffset={10} className="w-48">
          <DropdownMenuItem onClick={() => inputRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload files
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDrivePickerOpen(true)} className="gap-2">
            <HardDrive className="h-4 w-4" />
            Google Drive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <GoogleDrivePicker open={drivePickerOpen} onOpenChange={setDrivePickerOpen} onFilesSelected={handleDriveFilesSelected} />
    </>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToBase64Raw(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip data URI prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
