import { useState, useEffect, useCallback } from 'react';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

const STORAGE_KEY = 'google-drive-folder-state';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';

const OAUTH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-exchange`;
const LIST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-list`;
const DOWNLOAD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-download`;

const apiHeaders = {
  'Content-Type': 'application/json',
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

interface FolderState {
  folderStack: { id: string; name: string }[];
  currentFolder: string;
}

function loadFolderState(): FolderState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.folderStack?.length > 0) return parsed;
    }
  } catch {}
  return { folderStack: [{ id: 'root', name: 'My Drive' }], currentFolder: 'root' };
}

function saveFolderState(state: FolderState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export function useGoogleDrive() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);

  const initialState = loadFolderState();
  const [currentFolder, setCurrentFolder] = useState(initialState.currentFolder);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>(initialState.folderStack);

  useEffect(() => {
    saveFolderState({ folderStack, currentFolder });
  }, [folderStack, currentFolder]);

  const listFiles = useCallback(async (folderId: string = 'root') => {
    setIsLoading(true);
    try {
      // No accessToken passed — edge function resolves from DB
      const response = await fetch(LIST_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ folderId }),
      });

      if (response.status === 401) {
        setIsConnected(false);
        setFiles([]);
        return;
      }

      if (!response.ok) throw new Error('Failed to list files');

      const data = await response.json().catch(() => ({}));
      if (data.error === 'token_expired' || data.error === 'drive_auth_required') {
        setIsConnected(false);
        setFiles([]);
        return;
      }

      setFiles(data.files || []);
      setCurrentFolder(folderId);
      setIsConnected(true);
    } catch (err) {
      console.error('Error listing files:', err);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    await listFiles(currentFolder);
  }, [currentFolder, listFiles]);

  const connect = useCallback(async () => {
    try {
      // 1. Get client ID
      const configRes = await fetch(OAUTH_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ action: 'get-config' }),
      });
      const { clientId } = await configRes.json();
      if (!clientId) throw new Error('Could not get Google config');

      // 2. Load Google Identity Services
      await loadScript('https://accounts.google.com/gsi/client');

      // 3. Use authorization code flow for refresh tokens
      const code = await new Promise<string>((resolve, reject) => {
        const client = (window as any).google.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope: SCOPES,
          ux_mode: 'popup',
          callback: (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve(response.code);
          },
        });
        client.requestCode();
      });

      // 4. Exchange code for tokens on the server (stored globally)
      const exchangeRes = await fetch(OAUTH_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'exchange',
          code,
          redirectUri: window.location.origin,
          provider: 'google-drive',
        }),
      });
      const result = await exchangeRes.json();
      if (!exchangeRes.ok) throw new Error(result.message || result.error);

      // 5. Clear legacy localStorage tokens
      try {
        localStorage.removeItem('google-drive-access-token');
        localStorage.removeItem('google-drive-access-token-expires-at');
      } catch {}

      // 6. List files using the new connection
      setIsConnected(true);
      await listFiles('root');
    } catch (error) {
      console.error('Google Drive connect error:', error);
      setIsConnected(false);
    }
  }, [listFiles]);

  const navigateToFolder = useCallback((folderId: string, folderName: string) => {
    setFolderStack(prev => [...prev, { id: folderId, name: folderName }]);
    listFiles(folderId);
  }, [listFiles]);

  const navigateToBreadcrumb = useCallback((index: number) => {
    const newStack = folderStack.slice(0, index + 1);
    setFolderStack(newStack);
    listFiles(newStack[newStack.length - 1].id);
  }, [folderStack, listFiles]);

  const downloadFile = useCallback(async (file: DriveFile): Promise<{
    content?: string; mimeType: string; fileName: string; isText: boolean; size?: number;
  } | null> => {
    try {
      const response = await fetch(DOWNLOAD_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          fileId: file.id,
          mimeType: file.mimeType,
          fileName: file.name,
        }),
      });

      if (response.status === 401) {
        setIsConnected(false);
        return null;
      }

      if (!response.ok) throw new Error('Download failed');

      const data = await response.json();
      if (data.error === 'token_expired' || data.error === 'drive_auth_required') {
        setIsConnected(false);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error downloading file:', error);
      return null;
    }
  }, []);

  return {
    isConnected,
    isLoading,
    files,
    currentFolder,
    folderStack,
    connect,
    checkConnection,
    listFiles,
    navigateToFolder,
    navigateToBreadcrumb,
    downloadFile,
  };
}
