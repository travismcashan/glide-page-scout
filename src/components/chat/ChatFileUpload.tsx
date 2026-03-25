import { useRef, useState } from 'react';
import { Paperclip, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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

function isTextFile(file: File): boolean {
  if (file.type.startsWith('text/')) return true;
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return TEXT_EXTENSIONS.includes(ext);
}

type Props = {
  attachments: ChatAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<ChatAttachment[]>>;
  disabled?: boolean;
};

export function ChatFileUpload({ attachments, setAttachments, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);

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

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
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

      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-[44px] w-[44px] text-muted-foreground hover:text-foreground"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || parsing}
        title="Attach files"
      >
        {parsing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
      </Button>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1 pb-2">
          {attachments.map((att, i) => (
            <Badge
              key={`${att.name}-${i}`}
              variant="secondary"
              className="gap-1 pl-1.5 pr-1 py-0.5 text-xs font-normal max-w-[200px]"
            >
              {att.type === 'image' ? (
                <ImageIcon className="h-3 w-3 shrink-0" />
              ) : (
                <FileText className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate">{att.name}</span>
              {att.parsing ? (
                <Loader2 className="h-3 w-3 animate-spin shrink-0 ml-0.5" />
              ) : (
                <button
                  onClick={() => removeAttachment(i)}
                  className="ml-0.5 hover:text-destructive shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
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
