import { useState, useEffect, useCallback, useRef } from 'react';
import { useGoogleDrive, DriveFile } from '@/hooks/useGoogleDrive';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Folder, FileText, FileSpreadsheet, FileImage, File, ChevronRight,
  Loader2, HardDrive, Check, Search, X, Eye, ArrowUpDown, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type SortField = 'name' | 'modified' | 'type';
type SortDirection = 'asc' | 'desc';
type FilterOption = 'all' | 'folders' | 'documents' | 'pdfs' | 'spreadsheets' | 'images' | 'supported';

interface GoogleDrivePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilesSelected: (files: { name: string; content?: string; mimeType: string; isText: boolean }[]) => void;
}

const SUPPORTED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'text/plain', 'text/csv', 'text/markdown',
  'application/json', 'application/xml',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
];

function getFileIcon(mimeType: string, size: 'sm' | 'lg' = 'sm') {
  const sizeClass = size === 'lg' ? 'w-12 h-12' : 'w-6 h-6';
  if (mimeType === 'application/vnd.google-apps.folder')
    return <Folder className={cn(sizeClass, 'text-muted-foreground')} />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return <FileSpreadsheet className={cn(sizeClass, 'text-emerald-500')} />;
  if (mimeType.includes('document') || mimeType.includes('word'))
    return <FileText className={cn(sizeClass, 'text-blue-500')} />;
  if (mimeType === 'application/pdf')
    return <FileText className={cn(sizeClass, 'text-destructive')} />;
  if (mimeType.includes('image'))
    return <FileImage className={cn(sizeClass, 'text-purple-500')} />;
  return <File className={cn(sizeClass, 'text-muted-foreground')} />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function isFileSupported(mimeType: string): boolean {
  return SUPPORTED_MIMES.some(m => mimeType.includes(m) || m.includes(mimeType));
}

function isFolder(mimeType: string): boolean {
  return mimeType === 'application/vnd.google-apps.folder';
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'Document';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Spreadsheet';
  if (mimeType.includes('image')) return 'Image';
  if (mimeType === 'application/vnd.google-apps.document') return 'Google Doc';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'Google Sheet';
  return 'File';
}

export function GoogleDrivePicker({ open, onOpenChange, onFilesSelected }: GoogleDrivePickerProps) {
  const {
    isConnected, isLoading, files, folderStack,
    connect, checkConnection, navigateToFolder, navigateToBreadcrumb, downloadFile,
  } = useGoogleDrive();

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedFileId, setFocusedFileId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [foldersOnTop, setFoldersOnTop] = useState(true);
  const [multiTab, setMultiTab] = useState(() => {
    try { return localStorage.getItem('drive-multi-tab') === 'true'; } catch { return false; }
  });

  const previewFileRef = useRef(previewFile);
  const focusedFileIdRef = useRef(focusedFileId);
  const filesRef = useRef(files);
  const isHandlingSpaceRef = useRef(false);

  useEffect(() => { previewFileRef.current = previewFile; }, [previewFile]);
  useEffect(() => { focusedFileIdRef.current = focusedFileId; }, [focusedFileId]);
  useEffect(() => { filesRef.current = files; }, [files]);

  useEffect(() => {
    if (open) checkConnection();
    else { setPreviewFile(null); setPreviewContent(null); setFocusedFileId(null); }
  }, [open, checkConnection]);

  const toggleFileSelection = useCallback((fileId: string) => {
    setSelectedFiles(prev => {
      const n = new Set(prev);
      n.has(fileId) ? n.delete(fileId) : n.add(fileId);
      return n;
    });
  }, []);

  const handleFileClick = useCallback((file: DriveFile) => {
    if (isFolder(file.mimeType)) {
      navigateToFolder(file.id, file.name);
    } else if (isFileSupported(file.mimeType)) {
      toggleFileSelection(file.id);
      setFocusedFileId(file.id);
    }
  }, [navigateToFolder, toggleFileSelection]);

  const closePreview = useCallback(() => {
    setPreviewFile(null);
    setPreviewContent(null);
  }, []);

  // Spacebar preview toggle
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (isHandlingSpaceRef.current) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.closest('[role="menu"]')) return;
      e.preventDefault();
      isHandlingSpaceRef.current = true;

      try {
        if (previewFileRef.current) {
          setPreviewFile(null);
          setPreviewContent(null);
        } else {
          const id = focusedFileIdRef.current;
          if (id) {
            const file = filesRef.current.find(f => f.id === id);
            if (file && !isFolder(file.mimeType)) {
              setPreviewFile(file);
              setPreviewContent(`https://drive.google.com/file/d/${file.id}/preview`);
            }
          }
        }
      } catch (err) {
        console.error('Preview toggle error:', err);
      }
      setTimeout(() => { isHandlingSpaceRef.current = false; }, 300);
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [open]);

  const handleImport = async () => {
    const filesToImport = files.filter(f => selectedFiles.has(f.id) && isFileSupported(f.mimeType));
    if (filesToImport.length === 0) return;
    setIsImporting(true);
    try {
      const imported: { name: string; content?: string; mimeType: string; isText: boolean }[] = [];
      const failed: string[] = [];
      for (const file of filesToImport) {
        try {
          const isGoogleDoc = file.mimeType === 'application/vnd.google-apps.document';
          const result = await downloadFile(file, { multiTab: multiTab && isGoogleDoc });
          if (result) {
            imported.push({ name: result.fileName, content: result.content, mimeType: result.mimeType, isText: result.isText });
          } else {
            failed.push(file.name);
          }
        } catch {
          failed.push(file.name);
        }
      }
      if (imported.length > 0) {
        onFilesSelected(imported);
      }
      if (failed.length > 0) {
        toast.error(`Failed to import ${failed.length} file${failed.length > 1 ? 's' : ''}: ${failed.join(', ')}`);
      }
      setSelectedFiles(new Set());
      onOpenChange(false);
    } finally {
      setIsImporting(false);
    }
  };

  const getFileCategory = (mimeType: string): FilterOption => {
    if (mimeType === 'application/vnd.google-apps.folder') return 'folders';
    if (mimeType === 'application/pdf') return 'pdfs';
    if (mimeType.includes('document') || mimeType.includes('word')) return 'documents';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheets';
    if (mimeType.includes('image')) return 'images';
    return 'all';
  };

  const filteredAndSortedFiles = files
    .filter(file => {
      if (!file.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterBy === 'all') return true;
      if (filterBy === 'supported') return isFileSupported(file.mimeType) || isFolder(file.mimeType);
      return getFileCategory(file.mimeType) === filterBy;
    })
    .sort((a, b) => {
      if (foldersOnTop) {
        if (isFolder(a.mimeType) && !isFolder(b.mimeType)) return -1;
        if (!isFolder(a.mimeType) && isFolder(b.mimeType)) return 1;
      }
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'modified': cmp = (a.modifiedTime || '').localeCompare(b.modifiedTime || ''); break;
        case 'type': cmp = a.mimeType.localeCompare(b.mimeType); break;
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });

  const getFilterLabel = () => {
    switch (filterBy) {
      case 'all': return 'All files';
      case 'folders': return 'Folders';
      case 'documents': return 'Documents';
      case 'pdfs': return 'PDFs';
      case 'spreadsheets': return 'Spreadsheets';
      case 'images': return 'Images';
      case 'supported': return 'Importable';
    }
  };

  // Not connected
  if (isConnected === false) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Connect Google Drive
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="p-5 rounded-full bg-muted">
              <HardDrive className="w-12 h-12 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium">Access your Google Drive files</p>
              <p className="text-sm text-muted-foreground">Connect to import documents directly</p>
            </div>
            <Button onClick={connect} size="lg" className="gap-2 mt-2">
              <HardDrive className="w-4 h-4" />
              Connect Google Drive
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Loading
  if (isConnected === null) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Preview mode
  if (previewFile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden [&>button:last-child]:hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0 bg-background">
            <div className="flex items-center gap-3">
              {getFileIcon(previewFile.mimeType)}
              <div>
                <p className="font-medium truncate max-w-md">{previewFile.name}</p>
                <p className="text-xs text-muted-foreground">{getFileTypeLabel(previewFile.mimeType)}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closePreview}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden bg-muted/50">
            {previewContent ? (
              <iframe src={previewContent} className="w-full h-full border-0" title={previewFile.name} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                {getFileIcon(previewFile.mimeType, 'lg')}
                <p className="text-sm text-muted-foreground">Preview not available</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t bg-background flex-shrink-0">
            <p className="text-sm text-muted-foreground">Press Esc to close preview</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={closePreview}>Back to files</Button>
              {isFileSupported(previewFile.mimeType) && (
                <Button onClick={() => { if (!selectedFiles.has(previewFile.id)) toggleFileSelection(previewFile.id); closePreview(); }}>
                  {selectedFiles.has(previewFile.id) ? 'Selected' : 'Select file'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // File picker
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl h-[75vh] flex flex-col p-0 gap-0 overflow-hidden [&>button:last-child]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <HardDrive className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg">Select files</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Search + Sort + Filter */}
        <div className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search in Drive" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 pr-8 bg-muted/50 border-0 focus-visible:ring-1" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 px-2.5">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sort</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Sort by</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setSortField('name')} className="gap-2">
                  {sortField === 'name' ? <Check className="w-4 h-4 text-primary" /> : <span className="w-4" />} Name
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortField('modified')} className="gap-2">
                  {sortField === 'modified' ? <Check className="w-4 h-4 text-primary" /> : <span className="w-4" />} Date modified
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortField('type')} className="gap-2">
                  {sortField === 'type' ? <Check className="w-4 h-4 text-primary" /> : <span className="w-4" />} Type
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Direction</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setSortDirection('asc')} className="gap-2">
                  {sortDirection === 'asc' ? <Check className="w-4 h-4 text-primary" /> : <span className="w-4" />} A → Z
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortDirection('desc')} className="gap-2">
                  {sortDirection === 'desc' ? <Check className="w-4 h-4 text-primary" /> : <span className="w-4" />} Z → A
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Folders</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setFoldersOnTop(true)} className="gap-2">
                  {foldersOnTop ? <Check className="w-4 h-4 text-primary" /> : <span className="w-4" />} On top
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFoldersOnTop(false)} className="gap-2">
                  {!foldersOnTop ? <Check className="w-4 h-4 text-primary" /> : <span className="w-4" />} Mixed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={filterBy !== 'all' ? 'default' : 'outline'} size="sm" className="gap-1.5 text-xs h-9 px-2.5">
                  <Filter className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{getFilterLabel()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={filterBy === 'all'} onCheckedChange={() => setFilterBy('all')}>All files</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={filterBy === 'supported'} onCheckedChange={() => setFilterBy('supported')}>Importable only</DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={filterBy === 'folders'} onCheckedChange={() => setFilterBy('folders')}>
                  <Folder className="w-4 h-4 mr-2" /> Folders
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={filterBy === 'documents'} onCheckedChange={() => setFilterBy('documents')}>
                  <FileText className="w-4 h-4 mr-2" /> Documents
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={filterBy === 'pdfs'} onCheckedChange={() => setFilterBy('pdfs')}>
                  <FileText className="w-4 h-4 mr-2 text-destructive" /> PDFs
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={filterBy === 'spreadsheets'} onCheckedChange={() => setFilterBy('spreadsheets')}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Spreadsheets
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={filterBy === 'images'} onCheckedChange={() => setFilterBy('images')}>
                  <FileImage className="w-4 h-4 mr-2" /> Images
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm px-4 py-2 border-b flex-shrink-0 bg-muted/30">
          {folderStack.map((folder, index) => (
            <div key={folder.id} className="flex items-center">
              {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />}
              <button
                onClick={() => navigateToBreadcrumb(index)}
                className={cn(
                  'px-2 py-1 rounded hover:bg-accent transition-colors whitespace-nowrap',
                  index === folderStack.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {folder.name}
              </button>
            </div>
          ))}
        </div>

        {/* File list */}
        <div className="flex-1 overflow-hidden min-h-0">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAndSortedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Folder className="w-16 h-16 mb-3 opacity-50" />
                <p className="font-medium">{searchQuery || filterBy !== 'all' ? 'No matching files' : 'This folder is empty'}</p>
                <p className="text-sm">{searchQuery || filterBy !== 'all' ? 'Try a different search or filter' : 'Upload files to Google Drive to see them here'}</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredAndSortedFiles.map(file => {
                  const isFolderItem = isFolder(file.mimeType);
                  const isSupported = isFileSupported(file.mimeType);
                  const isSelected = selectedFiles.has(file.id);
                  const isFocused = focusedFileId === file.id;

                  return (
                    <div
                      key={file.id}
                      onClick={() => handleFileClick(file)}
                      onFocus={() => !isFolderItem && setFocusedFileId(file.id)}
                      tabIndex={!isFolderItem && isSupported ? 0 : -1}
                      className={cn(
                        'flex items-center gap-4 px-4 py-3 transition-colors group cursor-pointer outline-none',
                        isFolderItem && 'hover:bg-accent/50',
                        !isFolderItem && isSupported && 'hover:bg-accent/50',
                        !isFolderItem && !isSupported && 'opacity-40 cursor-not-allowed',
                        isSelected && 'bg-primary/10',
                        isFocused && !isSelected && 'ring-1 ring-inset ring-primary/50'
                      )}
                    >
                      <div className="w-6 flex items-center justify-center">
                        {!isFolderItem && isSupported && (
                          <div className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                            isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 group-hover:border-muted-foreground'
                          )}>
                            {isSelected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">{getFileIcon(file.mimeType)}</div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm truncate', !isFolderItem && !isSupported && 'text-muted-foreground')}>{file.name}</p>
                      </div>
                      {isFocused && !isFolderItem && isSupported && (
                        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Space to preview</span>
                        </div>
                      )}
                      {!isFolderItem && file.size && (
                        <div className="flex-shrink-0 text-sm text-muted-foreground hidden sm:block tabular-nums">
                          {formatFileSize(Number(file.size))}
                        </div>
                      )}
                      <div className="flex-shrink-0 text-sm text-muted-foreground hidden sm:block pr-1">
                        {file.modifiedTime && new Date(file.modifiedTime).toLocaleDateString()}
                      </div>
                      {isFolderItem && <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              {selectedFiles.size > 0 ? `${selectedFiles.size} selected` : 'Click to select · Space to preview'}
            </p>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={multiTab}
                onCheckedChange={(checked) => {
                  const val = checked === true;
                  setMultiTab(val);
                  try { localStorage.setItem('drive-multi-tab', String(val)); } catch {}
                }}
                className="h-4 w-4"
              />
              <span className="text-xs text-muted-foreground">Import all Google Doc tabs</span>
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={selectedFiles.size === 0 || isImporting}>
              {isImporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</> : 'Import'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}