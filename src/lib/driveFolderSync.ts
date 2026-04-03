/**
 * Drive Folder Sync Engine
 * Part of the Sync Engine layer — connects Streams (Google Drive folders) to Agency Brain.
 */
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const apiHeaders = {
  'Content-Type': 'application/json',
  'apikey': API_KEY,
  'Authorization': `Bearer ${API_KEY}`,
};

// MIME types we can ingest (matches GoogleDrivePicker's SUPPORTED_MIMES)
const SUPPORTED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/html',
  'application/json',
  'application/xml',
  'text/xml',
]);

export type SyncProgress = {
  phase: 'listing' | 'downloading' | 'ingesting' | 'complete' | 'error';
  filesFound: number;
  filesNew: number;
  filesProcessed: number;
  filesSkipped: number;
  currentFile?: string;
  error?: string;
};

export type ConnectedFolder = {
  id: string;
  company_id: string;
  folder_id: string;
  folder_name: string;
  folder_path: string | null;
  label: string;
  is_enabled: boolean;
  last_synced_at: string | null;
  last_sync_file_count: number;
  sync_status: string;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Fetch all connected folders for a company
 */
export async function getConnectedFolders(companyId: string): Promise<ConnectedFolder[]> {
  const { data, error } = await supabase
    .from('connected_drive_folders')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[sync-engine] Failed to fetch folders:', error);
    return [];
  }
  return (data || []) as ConnectedFolder[];
}

/**
 * Connect a new Google Drive folder to a company
 */
export async function connectFolder(
  companyId: string,
  folderId: string,
  folderName: string,
  folderPath: string,
  label: string = 'general'
): Promise<ConnectedFolder | null> {
  const { data, error } = await supabase
    .from('connected_drive_folders')
    .insert({
      company_id: companyId,
      folder_id: folderId,
      folder_name: folderName,
      folder_path: folderPath,
      label,
    })
    .select()
    .single();

  if (error) {
    console.error('[sync-engine] Failed to connect folder:', error);
    return null;
  }
  return data as ConnectedFolder;
}

/**
 * Disconnect a folder
 */
export async function disconnectFolder(folderId: string): Promise<boolean> {
  const { error } = await supabase
    .from('connected_drive_folders')
    .delete()
    .eq('id', folderId);

  return !error;
}

/**
 * Sync a single connected folder — the core Sync Engine operation.
 * Lists files recursively, diffs against existing knowledge docs, downloads + ingests new ones.
 */
export async function syncFolder(
  sessionId: string,
  folder: ConnectedFolder,
  onProgress?: (progress: SyncProgress) => void
): Promise<{ ingested: number; skipped: number; error?: string }> {
  const progress: SyncProgress = {
    phase: 'listing',
    filesFound: 0,
    filesNew: 0,
    filesProcessed: 0,
    filesSkipped: 0,
  };
  const report = (update: Partial<SyncProgress>) => {
    Object.assign(progress, update);
    onProgress?.(progress);
  };

  // Mark folder as syncing
  await supabase
    .from('connected_drive_folders')
    .update({ sync_status: 'syncing', last_sync_error: null })
    .eq('id', folder.id);

  try {
    // Phase 1: Recursive listing via edge function
    report({ phase: 'listing' });
    const listRes = await fetch(`${SUPABASE_URL}/functions/v1/google-drive-list`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ folderId: folder.folder_id, recursive: true, maxFiles: 1000 }),
    });

    if (!listRes.ok) {
      const err = await listRes.json().catch(() => ({}));
      throw new Error(err.error || `Listing failed: ${listRes.status}`);
    }

    const listData = await listRes.json();
    const allFiles = (listData.files || []).filter(
      (f: any) => SUPPORTED_MIMES.has(f.mimeType)
    );
    report({ filesFound: allFiles.length });

    // Phase 2: Diff against existing docs
    const sourceKeyPrefix = `gdrive-folder:${folder.folder_id}:`;
    const { data: existingDocs } = await supabase
      .from('knowledge_documents')
      .select('source_key')
      .eq('session_id', sessionId)
      .like('source_key', `${sourceKeyPrefix}%`);

    const existingFileIds = new Set(
      (existingDocs || []).map(d => d.source_key?.replace(sourceKeyPrefix, '') || '')
    );

    const newFiles = allFiles.filter((f: any) => !existingFileIds.has(f.id));
    const skipped = allFiles.length - newFiles.length;
    report({ filesNew: newFiles.length, filesSkipped: skipped });

    if (newFiles.length === 0) {
      report({ phase: 'complete' });
      await supabase
        .from('connected_drive_folders')
        .update({
          sync_status: 'idle',
          last_synced_at: new Date().toISOString(),
          last_sync_file_count: allFiles.length,
        })
        .eq('id', folder.id);
      return { ingested: 0, skipped };
    }

    // Phase 3: Download + ingest in batches of 5
    report({ phase: 'downloading' });
    const BATCH_SIZE = 5;

    for (let i = 0; i < newFiles.length; i += BATCH_SIZE) {
      const batch = newFiles.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (file: any) => {
        try {
          report({ currentFile: file.name });

          // Download
          const dlRes = await fetch(`${SUPABASE_URL}/functions/v1/google-drive-download`, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({ fileId: file.id }),
          });

          if (!dlRes.ok) {
            console.warn(`[sync-engine] Download failed for ${file.name}`);
            return;
          }

          const dlData = await dlRes.json();
          const content = dlData?.content || dlData?.text || '';
          if (!content || content.length < 30) {
            console.warn(`[sync-engine] No readable content: ${file.name}`);
            return;
          }

          // Create knowledge document
          const { data: doc } = await supabase
            .from('knowledge_documents')
            .insert({
              session_id: sessionId,
              name: file.name,
              source_type: 'google-drive',
              source_key: `${sourceKeyPrefix}${file.id}`,
              status: 'pending',
              chunk_count: 0,
              char_count: content.length,
            })
            .select('id')
            .single();

          if (!doc) return;

          // Ingest via RAG pipeline
          await fetch(`${SUPABASE_URL}/functions/v1/rag-ingest`, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({
              session_id: sessionId,
              documents: [{
                document_id: doc.id,
                name: file.name,
                content: content.slice(0, 50_000),
                source_type: 'google-drive',
                source_key: `${sourceKeyPrefix}${file.id}`,
              }],
            }),
          });

          report({ filesProcessed: progress.filesProcessed + 1 });
        } catch (err) {
          console.error(`[sync-engine] Failed to process ${file.name}:`, err);
        }
      }));
    }

    // Done
    report({ phase: 'complete' });
    await supabase
      .from('connected_drive_folders')
      .update({
        sync_status: 'idle',
        last_synced_at: new Date().toISOString(),
        last_sync_file_count: allFiles.length,
      })
      .eq('id', folder.id);

    return { ingested: progress.filesProcessed, skipped };
  } catch (err: any) {
    const errorMsg = err.message || 'Unknown sync error';
    report({ phase: 'error', error: errorMsg });
    await supabase
      .from('connected_drive_folders')
      .update({
        sync_status: 'error',
        last_sync_error: errorMsg,
      })
      .eq('id', folder.id);
    return { ingested: 0, skipped: 0, error: errorMsg };
  }
}

/**
 * Sync all enabled folders for a company, optionally only stale ones.
 */
export async function syncAllCompanyFolders(
  companyId: string,
  sessionId: string,
  options?: { stalenessMs?: number; onProgress?: (folderId: string, progress: SyncProgress) => void }
): Promise<{ totalIngested: number; foldersProcessed: number }> {
  const folders = await getConnectedFolders(companyId);
  const enabled = folders.filter(f => f.is_enabled);
  let totalIngested = 0;
  let foldersProcessed = 0;

  for (const folder of enabled) {
    // Check staleness
    if (options?.stalenessMs && folder.last_synced_at) {
      const age = Date.now() - new Date(folder.last_synced_at).getTime();
      if (age < options.stalenessMs) continue;
    }

    // Skip folders already syncing
    if (folder.sync_status === 'syncing') continue;

    const result = await syncFolder(sessionId, folder, (p) => {
      options?.onProgress?.(folder.id, p);
    });

    totalIngested += result.ingested;
    foldersProcessed++;
  }

  return { totalIngested, foldersProcessed };
}
