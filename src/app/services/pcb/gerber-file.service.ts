import { Injectable } from '@angular/core';
import JSZip from 'jszip';

export interface UnzippedFile {
  filename: string;
  content: string;
  size: number;
}

export interface ZipValidationLimits {
  maxZipSizeBytes: number;        // Max 50 MB
  maxEntries: number;             // Max 60 files
  maxUncompressedBytes: number;   // Max 100 MB
}

const DEFAULT_LIMITS: ZipValidationLimits = {
  maxZipSizeBytes: 50 * 1024 * 1024,
  maxEntries: 60,
  maxUncompressedBytes: 100 * 1024 * 1024
};

@Injectable({
  providedIn: 'root'
})
export class GerberFileService {

  /**
   * Extrait et sécurise le dézipage d'une archive Gerber dans le navigateur
   */
  async extractZip(
    fileOrBlob: File | Blob,
    limits: ZipValidationLimits = DEFAULT_LIMITS
  ): Promise<UnzippedFile[]> {
    if (fileOrBlob.size > limits.maxZipSizeBytes) {
      throw new Error(`L'archive dépasse la taille maximale autorisée (${limits.maxZipSizeBytes / 1024 / 1024} Mo).`);
    }

    const zip = await JSZip.loadAsync(fileOrBlob);
    const entries = Object.keys(zip.files);

    if (entries.length > limits.maxEntries) {
      throw new Error(`Nombre de fichiers excessif dans l'archive (${entries.length} > ${limits.maxEntries}).`);
    }

    let totalUncompressed = 0;
    const result: UnzippedFile[] = [];

    for (const filename of entries) {
      const entry = zip.files[filename];
      if (entry.dir) continue;

      // Protection Path Traversal (Zip Slip)
      if (filename.includes('..') || filename.startsWith('/') || filename.startsWith('\\')) {
        console.warn(`[Security] Fichier rejeté pour chemin non sécurisé : ${filename}`);
        continue;
      }

      // Rejet des fichiers non textuels évidents
      const lower = filename.toLowerCase();
      if (lower.endsWith('.exe') || lower.endsWith('.dll') || lower.endsWith('.bat') || lower.endsWith('.sh')) {
        continue;
      }

      const content = await entry.async('string');
      totalUncompressed += content.length;

      if (totalUncompressed > limits.maxUncompressedBytes) {
        throw new Error('Dépassement de la taille décompressée autorisée (Zip Bomb protection).');
      }

      result.push({
        filename,
        content,
        size: content.length
      });
    }

    if (result.length === 0) {
      throw new Error('Aucun fichier Gerber exploitable trouvé dans l\'archive.');
    }

    return result;
  }
}
