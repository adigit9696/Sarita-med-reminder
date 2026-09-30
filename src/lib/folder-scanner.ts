/**
 * Utility for scanning files and folders from Drag & Drop events or Folder Input elements.
 * Recursively traverses directories via HTML5 File System API (webkitGetAsEntry).
 */

export interface ScannedFolderResult {
  files: File[];
  folderName?: string;
  isFolder: boolean;
}

const VALID_EXTENSIONS = new Set(['.xls', '.xlsx', '.csv']);

/**
 * Checks if a file is a valid Marg spreadsheet and not a system/lock file.
 */
export function isValidSpreadsheetFile(fileName: string): boolean {
  if (!fileName) return false;
  // Ignore temporary lock files, hidden system files
  if (fileName.startsWith('~$') || fileName.startsWith('.') || fileName.toLowerCase() === 'thumbs.db') {
    return false;
  }
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  return VALID_EXTENSIONS.has(ext);
}

/**
 * Asynchronously traverses a FileSystemEntry hierarchy (handles nested directories).
 */
async function traverseFileSystemEntry(entry: any, collectedFiles: File[]): Promise<void> {
  if (!entry) return;

  if (entry.isFile) {
    await new Promise<void>((resolve) => {
      entry.file(
        (file: File) => {
          if (isValidSpreadsheetFile(file.name)) {
            collectedFiles.push(file);
          }
          resolve();
        },
        (err: any) => {
          console.warn('[FolderScanner] Error reading file entry:', err);
          resolve();
        }
      );
    });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    // readEntries must be called repeatedly until an empty array is returned in Chromium
    const readAllEntries = async (): Promise<any[]> => {
      const all: any[] = [];
      let batch: any[] = [];
      do {
        batch = await new Promise<any[]>((resolve) => {
          reader.readEntries(
            (entries: any[]) => resolve(entries || []),
            (err: any) => {
              console.warn('[FolderScanner] Error reading directory batch:', err);
              resolve([]);
            }
          );
        });
        all.push(...batch);
      } while (batch.length > 0);
      return all;
    };

    const entries = await readAllEntries();
    for (const child of entries) {
      await traverseFileSystemEntry(child, collectedFiles);
    }
  }
}

/**
 * Scans files from a DragEvent.
 * Automatically detects whether an entire folder or individual files were dropped.
 */
export async function scanFilesFromDropEvent(e: React.DragEvent): Promise<ScannedFolderResult> {
  const items = e.dataTransfer?.items;
  const rawFiles = e.dataTransfer?.files;

  // 1. Try modern FileSystemEntry traversal if supported
  if (items && items.length > 0) {
    const entries: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : (item as any).getAsEntry?.();
        if (entry) entries.push(entry);
      }
    }

    if (entries.length > 0) {
      const collectedFiles: File[] = [];
      let detectedFolderName: string | undefined;
      let hasDirectory = false;

      for (const entry of entries) {
        if (entry.isDirectory) {
          hasDirectory = true;
          if (!detectedFolderName) {
            detectedFolderName = entry.name;
          }
        }
        await traverseFileSystemEntry(entry, collectedFiles);
      }

      if (collectedFiles.length > 0) {
        return {
          files: collectedFiles,
          folderName: detectedFolderName,
          isFolder: hasDirectory,
        };
      }
    }
  }

  // 2. Fallback to standard dataTransfer.files
  if (rawFiles && rawFiles.length > 0) {
    const validFiles: File[] = [];
    let detectedFolderName: string | undefined;

    for (let i = 0; i < rawFiles.length; i++) {
      const file = rawFiles[i];
      if (isValidSpreadsheetFile(file.name)) {
        validFiles.push(file);
        // Check webkitRelativePath for folder name (e.g. "September/01-09.XLS")
        if (!detectedFolderName && (file as any).webkitRelativePath) {
          const parts = (file as any).webkitRelativePath.split('/');
          if (parts.length > 1) {
            detectedFolderName = parts[0];
          }
        }
      }
    }

    return {
      files: validFiles,
      folderName: detectedFolderName,
      isFolder: Boolean(detectedFolderName || validFiles.length > 1),
    };
  }

  return { files: [], isFolder: false };
}

/**
 * Scans files from an HTML `<input type="file">` change event.
 * Supports both multi-file selection and `webkitdirectory` folder input.
 */
export function scanFilesFromInputEvent(e: React.ChangeEvent<HTMLInputElement>): ScannedFolderResult {
  const fileList = e.target.files;
  if (!fileList || fileList.length === 0) {
    return { files: [], isFolder: false };
  }

  const validFiles: File[] = [];
  let detectedFolderName: string | undefined;

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (isValidSpreadsheetFile(file.name)) {
      validFiles.push(file);
      if (!detectedFolderName && (file as any).webkitRelativePath) {
        const parts = (file as any).webkitRelativePath.split('/');
        if (parts.length > 1) {
          detectedFolderName = parts[0];
        }
      }
    }
  }

  return {
    files: validFiles,
    folderName: detectedFolderName,
    isFolder: Boolean(detectedFolderName || validFiles.length > 1),
  };
}
