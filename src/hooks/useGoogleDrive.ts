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
const TOKEN_KEY = 'google-drive-access-token';
const TOKEN_EXPIRY_KEY = 'google-drive-access-token-expires-at';
const TOKEN_EXPIRY_BUFFER_MS = 60_000;
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';

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

function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch {}
}

function persistToken(token: string, expiresInSeconds?: number) {
  try {
    localStorage.setItem(TOKEN_KEY, token);

    if (typeof expiresInSeconds === 'number' && Number.isFinite(expiresInSeconds)) {
      const expiresAt = Date.now() + (expiresInSeconds * 1000);
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt));
    } else {
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    }
  } catch {}
}

function getStoredToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    const rawExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    const expiresAt = rawExpiry ? Number(rawExpiry) : Number.NaN;

    if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
      clearStoredToken();
      return null;
    }

    return token;
  } catch {
    return null;
  }
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
  const [accessToken, setAccessToken] = useState<string | null>(() => getStoredToken());

  const initialState = loadFolderState();
  const [currentFolder, setCurrentFolder] = useState(initialState.currentFolder);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>(initialState.folderStack);

  useEffect(() => {
    saveFolderState({ folderStack, currentFolder });
  }, [folderStack, currentFolder]);

  const saveToken = useCallback((token: string, expiresInSeconds?: number) => {
    setAccessToken(token);
    persistToken(token, expiresInSeconds);
  }, []);

  const clearToken = useCallback(() => {
    setAccessToken(null);
    clearStoredToken();
    setFiles([]);
    setIsConnected(false);
  }, []);

  const getActiveToken = useCallback((overrideToken?: string | null) => {
    if (overrideToken) {
      if (overrideToken !== accessToken) {
        setAccessToken(overrideToken);
      }
      return overrideToken;
    }

    const token = getStoredToken();
    if (!token) {
      if (accessToken !== null) {
        setAccessToken(null);
      }
      return null;
    }

    if (token !== accessToken) {
      setAccessToken(token);
    }

    return token;
  }, [accessToken]);

  const listFiles = useCallback(async (folderId: string = 'root', tokenOverride?: string) => {
    const tok = getActiveToken(tokenOverride);
    if (!tok) {
      setFiles([]);
      setIsConnected(false);
      return;
    }

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

      if (response.status === 401) {
        clearToken();
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to list files');
      }

      const data = await response.json().catch(() => ({}));
      if (data.error === 'token_expired') {
        clearToken();
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
  }, [clearToken, getActiveToken]);

  const checkConnection = useCallback(async () => {
    const latestToken = getActiveToken();
    if (!latestToken) {
      clearToken();
      return;
    }
    await listFiles(currentFolder, latestToken);
  }, [clearToken, currentFolder, getActiveToken, listFiles]);

  const connect = useCallback(async () => {
    try {
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

      const tokenResponse = await new Promise<{ accessToken: string; expiresIn?: number }>((resolve, reject) => {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: (resp: { error?: string; access_token?: string; expires_in?: number | string }) => {
            if (resp.error || !resp.access_token) {
              reject(new Error(resp.error || 'missing_access_token'));
              return;
            }

            const expiresIn = typeof resp.expires_in === 'string'
              ? Number(resp.expires_in)
              : resp.expires_in;

            resolve({ accessToken: resp.access_token, expiresIn });
          },
        });
        tokenClient.requestAccessToken();
      });

      saveToken(tokenResponse.accessToken, tokenResponse.expiresIn);
      await listFiles('root', tokenResponse.accessToken);
    } catch (error) {
      console.error('Google Drive connect error:', error);
      clearToken();
    }
  }, [clearToken, saveToken, listFiles]);

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
    const tok = getActiveToken();
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

      if (response.status === 401) {
        clearToken();
        return null;
      }

      if (!response.ok) throw new Error('Download failed');

      const data = await response.json();
      if (data.error === 'token_expired') {
        clearToken();
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error downloading file:', error);
      return null;
    }
  }, [clearToken, getActiveToken]);

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
