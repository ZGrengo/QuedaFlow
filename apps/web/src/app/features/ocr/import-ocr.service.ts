import { Injectable } from '@angular/core';
import { createWorker, Worker } from 'tesseract.js';
import { parseMapalOcrText, DetectedShift, ParseIssue } from '@domain/index';

export interface OcrProgress {
  status: string;
  progress: number; // 0-1
}

@Injectable({
  providedIn: 'root'
})
export class ImportOcrService {
  private worker: Worker | null = null;

  /**
   * Initializes Tesseract worker (lazy initialization)
   */
  private async getWorker(): Promise<Worker> {
    if (!this.worker) {
      this.worker = await createWorker('spa', 1);
    }
    return this.worker;
  }

  /**
   * Performs OCR on an image file
   * @param file - Image file (PNG/JPG)
   * @param onProgress - Optional progress callback
   * @returns OCR text
   */
  async recognizeText(
    file: File,
    onProgress?: (progress: OcrProgress) => void
  ): Promise<string> {
    const worker = await this.getWorker();

    // Tesseract v5: progress via worker.onProgress or recognize() may not expose logger in types
    const result = await worker.recognize(file);
    if (onProgress) {
      onProgress({ status: 'recognizing text', progress: 1 });
    }
    return result.data.text;
  }

  /**
   * Parses OCR text to extract shifts
   * @param text - Raw OCR text
   * @param planningStartISO - Planning start date (YYYY-MM-DD)
   * @param planningEndISO - Planning end date (YYYY-MM-DD)
   * @returns Parsed shifts and issues
   */
  parseShifts(
    text: string,
    planningStartISO: string,
    planningEndISO: string
  ): { shifts: DetectedShift[]; issues: ParseIssue[] } {
    return parseMapalOcrText(text, planningStartISO, planningEndISO);
  }

  /**
   * Cleanup worker when done
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

