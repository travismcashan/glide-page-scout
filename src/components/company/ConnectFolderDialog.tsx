/**
 * Connect Folder Dialog
 * Browse Google Drive folder hierarchy and connect a folder as a Stream to Agency Brain.
 */
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FolderOpen, Folder, ChevronRight, Loader2, ArrowLeft, HardDrive, Check,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const apiHeaders = {
  'Content-Type': 'application/json',
  'apikey': API_KEY,
  'Authorization': `Bearer ${API_KEY}`,
};

type DriveFolder = {
  id: string;
  name: string;
  mimeType: string;
};

type BreadcrumbItem = {
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (folderId: string, folderName: string, folderPath: string, label: string) => void;
};

export function ConnectFolderDialog({ open, onOpenChange, onConnect }: Props) {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: 'root', name: 'My Drive' }]);
  const [label, setLabel] = useState('general');
  const [connecting, setConnecting] = useState(false);

  const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id;
  const currentFolderName = breadcrumbs[breadcrumbs.length - 1].name;
  const folderPath = breadcrumbs.map(b => b.name).join(' / ');

  useEffect(() => {
    if (open) {
      loadFolders(currentFolderId);
    }
  }, [open, currentFolderId]);

  const loadFolders = async (folderId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-drive-list`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ folderId }),
      });
      const data = await res.json();
      if (data.error === 'drive_auth_required') {
        setFolders([]);
        setLoading(false);
        return;
      }
      // Show only folders
      const folderItems = (data.files || []).filter(
        (f: any) => f.mimeType === 'application/vnd.google-apps.folder'
      );
      setFolders(folderItems);
    } catch (err) {
      console.error('[connect-folder] List error:', err);
      setFolders([]);
    }
    setLoading(false);
  };

  const navigateInto = (folder: DriveFolder) => {
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateBack = () => {
    if (breadcrumbs.length > 1) {
      setBreadcrumbs(prev => prev.slice(0, -1));
    }
  };

  const navigateToBreadcrumb = (index: number) => {
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  const handleConnect = async () => {
    if (currentFolderId === 'root') return;
    setConnecting(true);
    onConnect(currentFolderId, currentFolderName, folderPath, label);
    setConnecting(false);
    onOpenChange(false);
    // Reset state
    setBreadcrumbs([{ id: 'root', name: 'My Drive' }]);
    setLabel('general');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Connect Drive Folder
          </DialogTitle>
        </DialogHeader>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto pb-1">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1 shrink-0">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <button
                onClick={() => navigateToBreadcrumb(i)}
                className={`hover:text-foreground transition-colors ${
                  i === breadcrumbs.length - 1 ? 'text-foreground font-medium' : ''
                }`}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        {/* Folder list */}
        <div className="border border-border rounded-lg overflow-hidden min-h-[200px] max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading...
            </div>
          ) : folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
              <FolderOpen className="h-8 w-8 mb-2 opacity-40" />
              {currentFolderId === 'root' ? 'No folders found' : 'No subfolders'}
            </div>
          ) : (
            folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => navigateInto(folder)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left border-b border-border/50 last:border-0"
              >
                <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1">{folder.name}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </button>
            ))
          )}
        </div>

        {/* Back button */}
        {breadcrumbs.length > 1 && (
          <Button variant="ghost" size="sm" onClick={navigateBack} className="w-fit text-xs">
            <ArrowLeft className="h-3 w-3 mr-1" /> Back
          </Button>
        )}

        {/* Connect section */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <Select value={label} onValueChange={setLabel}>
            <SelectTrigger className="w-32 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleConnect}
            disabled={currentFolderId === 'root' || connecting}
            className="flex-1 gap-2"
            size="sm"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Connect "{currentFolderName}"
          </Button>
        </div>

        {currentFolderId === 'root' && (
          <p className="text-xs text-muted-foreground text-center">
            Navigate into a folder to connect it
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
