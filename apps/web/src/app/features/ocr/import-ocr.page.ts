import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../core/services/notification.service';
import { MatTableModule } from '@angular/material/table';
import { GroupService, Group } from '../../core/services/group.service';
import { BlocksService } from '../../core/services/blocks.service';
import { ImportOcrService } from './import-ocr.service';
import { ShiftEditorComponent } from './components/shift-editor.component';
import { DetectedShift, ParseIssue } from '@domain/index';
import { formatDateDDMMYYYY } from '../../core/utils/date-format';
import { minToHhmm } from '@domain/index';

type Step = 'upload' | 'results' | 'saving';

@Component({
  selector: 'app-import-ocr',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTableModule,
    ShiftEditorComponent
  ],
  template: `
    <div class="qf-page container">
      <div class="nav-back">
        <button mat-stroked-button class="qf-btn-secondary" [routerLink]="['/g', code]">
          <mat-icon>arrow_back</mat-icon>
          Volver al grupo
        </button>
      </div>

      <mat-card class="qf-surface">
        <mat-card-header>
          <mat-card-title>Importar Horarios por OCR</mat-card-title>
          <mat-card-subtitle>Sube una o varias capturas de tu app de horarios y el sistema detectará los turnos automáticamente</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <!-- Step 1: Upload -->
          <div *ngIf="currentStep === 'upload'">
            <form [formGroup]="uploadForm" (ngSubmit)="onFileSelected()">
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                multiple
                (change)="onFileChange($event)"
                id="file-input"
                style="display: none"
                #fileInput>
              <label for="file-input">
                <button mat-raised-button class="qf-btn-primary" type="button" (click)="fileInput.click()">
                  <mat-icon>upload</mat-icon>
                  Seleccionar imagen{{ selectedFiles.length > 0 ? 'es' : '' }}
                </button>
              </label>
              <div *ngIf="selectedFiles.length > 0" class="file-info">
                <p class="file-count">{{ selectedFiles.length }} archivo(s) seleccionado(s):</p>
                <ul class="file-list">
                  <li *ngFor="let f of selectedFiles">{{ f.name }} <span class="file-size">({{ formatFileSize(f.size) }})</span></li>
                </ul>
                <img [src]="imagePreviews[0]" alt="Vista previa" class="preview-image" *ngIf="imagePreviews[0]">
              </div>
              <div *ngIf="selectedFiles.length > 0 && !processingOcr" class="actions">
                <button mat-raised-button class="qf-btn-primary" type="button" (click)="analyzeImage()">
                  <mat-icon>text_fields</mat-icon>
                  Analizar {{ selectedFiles.length > 1 ? selectedFiles.length + ' imágenes' : 'con OCR' }}
                </button>
                <button mat-button type="button" (click)="cancelUpload()">
                  Cancelar
                </button>
              </div>
              <div *ngIf="processingOcr" class="ocr-progress">
                <p>{{ ocrProgressStatus }}</p>
                <p *ngIf="selectedFiles.length > 1" class="ocr-file-index">Imagen {{ currentFileIndex + 1 }} de {{ selectedFiles.length }}</p>
                <mat-progress-bar mode="determinate" [value]="ocrProgress * 100"></mat-progress-bar>
                <button mat-button type="button" (click)="cancelOcr()" class="cancel-btn">
                  Cancelar
                </button>
              </div>
            </form>
          </div>

          <!-- Step 2: Results & Confirmation -->
          <div *ngIf="currentStep === 'results'">
            <div class="results-header">
              <h3>Turnos Detectados ({{ detectedShifts.length }})</h3>
              <button mat-raised-button class="qf-btn-accent" (click)="addNewShift()">
                <mat-icon>add</mat-icon>
                Añadir turno
              </button>
            </div>

            <!-- Aviso de turnos omitidos -->
            <div *ngIf="parseIssues.length > 0 && group" class="omitted-notice">
              <mat-icon>info</mat-icon>
              <span>Algunos turnos fueron omitidos por exceder la fecha de planificación planteada por el host ({{ formatDateDDMMYYYY(group.planning_start_date) }} - {{ formatDateDDMMYYYY(group.planning_end_date) }})</span>
            </div>

            <!-- Shifts List -->
            <div class="shifts-list">
              <app-shift-editor
                *ngFor="let shift of detectedShifts; let i = index"
                [shift]="shift"
                [minDate]="minDate"
                [maxDate]="maxDate"
                (shiftChange)="onShiftChange(i, $event)"
                (delete)="onShiftDelete(i)">
              </app-shift-editor>
            </div>

            <div class="actions">
              <button mat-button (click)="cancelResults()">
                Cancelar
              </button>
              <button mat-raised-button class="qf-btn-primary" (click)="saveShifts()" [disabled]="detectedShifts.length === 0 || saving">
                <mat-icon>save</mat-icon>
                Guardar turnos
              </button>
            </div>
          </div>

          <!-- Step 3: Saving -->
          <div *ngIf="currentStep === 'saving'">
            <p>Guardando turnos...</p>
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .container {
      padding: 16px;
    }

    .nav-back {
      margin-bottom: 16px;
    }

    .file-info {
      margin-top: 16px;
    }

    .file-count {
      margin: 0 0 8px 0;
      font-weight: 500;
    }

    .file-list {
      margin: 0 0 12px 0;
      padding-left: 20px;
      color: var(--qf-text-muted);
      font-size: 0.9rem;
    }

    .file-size {
      font-size: 0.85rem;
      opacity: 0.85;
    }

    .ocr-file-index {
      margin: 4px 0 8px 0;
      font-size: 0.9rem;
      color: var(--qf-text-muted);
    }

    .preview-image {
      max-width: 100%;
      max-height: 400px;
      margin-top: 16px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 4px;
    }

    .actions {
      display: flex;
      gap: 12px;
      margin-top: 16px;
    }

    .ocr-progress {
      margin-top: 16px;
    }

    .ocr-progress p {
      margin-bottom: 8px;
    }

    .cancel-btn {
      margin-top: 8px;
    }

    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .omitted-notice {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: var(--qf-surface-2);
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      font-size: 0.9rem;
      color: var(--qf-text, inherit);
    }

    .omitted-notice mat-icon {
      flex-shrink: 0;
      color: var(--qf-primary);
    }

    .shifts-list {
      margin-bottom: 16px;
    }

  `]
})
export class ImportOcrPageComponent implements OnInit, OnDestroy {
  code = '';
  group: Group | null = null;
  currentStep: Step = 'upload';
  selectedFiles: File[] = [];
  imagePreviews: string[] = [];
  currentFileIndex = 0;
  processingOcr = false;
  ocrProgress = 0;
  ocrProgressStatus = '';
  detectedShifts: DetectedShift[] = [];
  parseIssues: ParseIssue[] = [];
  saving = false;
  minDate = new Date();
  maxDate = new Date();
  formatDateDDMMYYYY = formatDateDDMMYYYY;

  uploadForm: FormGroup;
  private ocrCancelToken: { cancel: () => void } | null = null;
  private readonly maxPreviews = 6;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private groupService: GroupService,
    private blocksService: BlocksService,
    private ocrService: ImportOcrService,
    private notification: NotificationService
  ) {
    this.uploadForm = this.fb.group({
      file: [null, Validators.required]
    });
  }

  ngOnInit() {
    this.code = this.route.snapshot.paramMap.get('code') || '';
    this.loadGroup();
  }

  ngOnDestroy() {
    this.ocrService.terminate();
  }

  loadGroup() {
    this.groupService.getGroup(this.code).subscribe({
      next: (group: Group) => {
        this.group = group;
        this.minDate = new Date(group.planning_start_date);
        this.maxDate = new Date(group.planning_end_date);
      },
      error: (err: unknown) => {
        this.notification.error('Error al cargar el grupo');
        console.error(err);
      }
    });
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      const combined = [...this.selectedFiles, ...newFiles];
      const seen = new Set<string>();
      this.selectedFiles = combined.filter(f => {
        const key = `${f.name}-${f.size}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      this.imagePreviews = new Array(Math.min(this.selectedFiles.length, this.maxPreviews));
      const toLoad = this.imagePreviews.length;
      for (let i = 0; i < toLoad; i++) {
        this.createImagePreview(this.selectedFiles[i], (dataUrl) => {
          this.imagePreviews[i] = dataUrl;
        });
      }
      input.value = '';
    }
  }

  createImagePreview(file: File, onLoad: (dataUrl: string) => void) {
    const reader = new FileReader();
    reader.onload = (e) => {
      onLoad((e.target?.result as string) ?? '');
    };
    reader.readAsDataURL(file);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  onFileSelected() {
    // File selection handled by onFileChange
  }

  async analyzeImage() {
    if (this.selectedFiles.length === 0 || !this.group) return;

    this.processingOcr = true;
    this.ocrProgress = 0;
    this.ocrProgressStatus = 'Inicializando OCR...';
    const totalFiles = this.selectedFiles.length;
    const allShifts: DetectedShift[] = [];
    const allIssues: ParseIssue[] = [];
    let allRawText = '';

    try {
      for (let i = 0; i < totalFiles; i++) {
        this.currentFileIndex = i;
        this.ocrProgressStatus = totalFiles > 1
          ? `Analizando imagen ${i + 1} de ${totalFiles}...`
          : 'Analizando texto...';
        this.ocrProgress = (i + 0.2) / totalFiles;

        const text = await this.ocrService.recognizeText(
          this.selectedFiles[i],
          (progress) => {
            this.ocrProgress = (i + progress.progress * 0.8) / totalFiles;
            this.ocrProgressStatus = progress.status;
          }
        );

        if (allRawText) allRawText += '\n\n';
        allRawText += `--- ${this.selectedFiles[i].name} ---\n${text}`;

        const parseResult = this.ocrService.parseShifts(
          text,
          this.group.planning_start_date,
          this.group.planning_end_date
        );

        allShifts.push(...parseResult.shifts);
        parseResult.issues.forEach(issue => {
          allIssues.push({
            line: `${this.selectedFiles[i].name}: ${issue.line}`,
            reason: issue.reason
          });
        });
      }

      this.detectedShifts = this.sortShiftsByDateAndTime(allShifts);
      this.parseIssues = allIssues;
      this.currentStep = 'results';

      if (this.detectedShifts.length === 0) {
        this.notification.error('No se detectaron turnos. Revisa que las imágenes contengan texto legible con turnos.', 'Cerrar', 5000);
      } else if (totalFiles > 1) {
        this.notification.info(`${this.detectedShifts.length} turnos detectados en ${totalFiles} imagen(es)`);
      }
    } catch (error: any) {
      this.notification.error('Error al procesar OCR: ' + (error.message || 'Error desconocido'), 'Cerrar', 5000);
      console.error('OCR error:', error);
    } finally {
      this.processingOcr = false;
      this.currentFileIndex = 0;
    }
  }

  cancelOcr() {
    this.processingOcr = false;
    this.ocrProgress = 0;
    this.ocrProgressStatus = '';
    this.currentFileIndex = 0;
  }

  cancelUpload() {
    this.selectedFiles = [];
    this.imagePreviews = [];
    this.uploadForm.reset();
  }

  cancelResults() {
    this.currentStep = 'upload';
    this.detectedShifts = [];
    this.parseIssues = [];
  }

  onShiftChange(index: number, updatedShift: DetectedShift) {
    this.detectedShifts[index] = updatedShift;
    this.detectedShifts = this.sortShiftsByDateAndTime([...this.detectedShifts]);
  }

  onShiftDelete(index: number) {
    this.detectedShifts.splice(index, 1);
  }

  addNewShift() {
    const today = new Date().toISOString().split('T')[0];
    const newShift: DetectedShift = {
      dateISO: today,
      startMin: 540, // 09:00
      endMin: 1020, // 17:00
      crossesMidnight: false
    };
    this.detectedShifts = this.sortShiftsByDateAndTime([...this.detectedShifts, newShift]);
  }

  private sortShiftsByDateAndTime(shifts: DetectedShift[]): DetectedShift[] {
    return [...shifts].sort((a, b) => {
      const dateCmp = a.dateISO.localeCompare(b.dateISO);
      if (dateCmp !== 0) return dateCmp;
      return a.startMin - b.startMin;
    });
  }

  saveShifts() {
    if (!this.group || this.detectedShifts.length === 0) return;

    this.currentStep = 'saving';
    this.saving = true;

    this.blocksService.bulkInsertWorkBlocks(
      this.group.id,
      this.detectedShifts,
      this.group.planning_start_date,
      this.group.planning_end_date
    ).subscribe({
      next: (results: Array<{ ok: true; ids: string[] } | { ok: false; error: string }>) => {
        const savedCount = results.filter((r): r is { ok: true; ids: string[] } => r.ok).length;
        const failedCount = results.filter((r): r is { ok: false; error: string } => !r.ok).length;

        if (savedCount > 0) {
          this.notification.success('Turnos guardados correctamente');
          this.router.navigate(['/g', this.code, 'blocks']);
        } else if (failedCount > 0) {
          this.notification.error(`${failedCount} turno(s) fallaron al guardar`, 'Cerrar', 5000);
          this.currentStep = 'results';
        }
      },
      error: (err: unknown) => {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        this.notification.error('Error al guardar turnos: ' + message, 'Cerrar', 5000);
        console.error('Save error:', err);
        this.currentStep = 'results';
      },
      complete: () => {
        this.saving = false;
      }
    });
  }

  reset() {
    this.currentStep = 'upload';
    this.selectedFiles = [];
    this.imagePreviews = [];
    this.detectedShifts = [];
    this.parseIssues = [];
    this.uploadForm.reset();
  }
}

