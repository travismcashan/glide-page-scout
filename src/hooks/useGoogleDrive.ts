import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
const TOKEN_KEY = 'google-drive-access-token';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

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

const LIST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-list`;
const DOWNLOAD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-download`;
const PICKER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-picker`;

export function useGoogleDrive() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  });

  const initialState = loadFolderState();
  const [currentFolder, setCurrentFolder] = useState(initialState.currentFolder);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>(initialState.folderStack);

  useEffect(() => {
    saveFolderState({ folderStack, currentFolder });
  }, [folderStack, currentFolder]);

  const saveToken = useCallback((token: string) => {
    setAccessToken(token);
    try { localStorage.setItem(TOKEN_KEY, token); } catch {}
  }, []);

  const clearToken = useCallback(() => {
    setAccessToken(null);
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    setIsConnected(false);
  }, []);

  const listFiles = useCallback(async (folderId: string = 'root', token?: string) => {
    const tok = token || accessToken;
    if (!tok) { setIsConnected(false); return; }
    setIsLoading(true);
    try {
      const response = await fetch(LIST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ accessToken: tok, folderId }),
      });

      if (!response.ok) {
        if (response.status === 401) { clearToken(); return; }
        throw new Error('Failed to list files');
      }

      const data = await response.json();
      if (data.error === 'token_expired') { clearToken(); return; }
      setFiles(data.files || []);
      setCurrentFolder(folderId);
      setIsConnected(true);
    } catch (err) {
      console.error('Error listing files:', err);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, clearToken]);

  // Check connection on init
  const checkConnection = useCallback(async () => {
    if (!accessToken) { setIsConnected(false); return; }
    await listFiles(currentFolder, accessToken);
  }, [accessToken, currentFolder, listFiles]);

  // Connect via GIS popup
  const connect = useCallback(async () => {
    try {
      // Get client ID
      const clientIdResp = await fetch(PICKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: 'get-client-id' }),
      });
      if (!clientIdResp.ok) throw new Error('Could not get Google config');
      const { clientId } = await clientIdResp.json();

      await loadScript('https://accounts.google.com/gsi/client');

      const token = await new Promise<string>((resolve, reject) => {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: (resp: any) => {
            if (resp.error) reject(new Error(resp.error));
            else resolve(resp.access_token);
          },
        });
        tokenClient.requestAccessToken();
      });

      saveToken(token);
      await listFiles('root', token);
    } catch (error) {
      console.error('Google Drive connect error:', error);
    }
  }, [saveToken, listFiles]);

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
    const tok = accessToken;
    if (!tok) return null;
    try {
      const response = await fetch(DOWNLOAD_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          accessToken: tok,
          fileId: file.id,
          mimeType: file.mimeType,
          fileName: file.name,
        }),
      });
      if (!response.ok) throw new Error('Download failed');
      return await response.json();
    } catch (error) {
      console.error('Error downloading file:', error);
      return null;
    }
  }, [accessToken]);

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