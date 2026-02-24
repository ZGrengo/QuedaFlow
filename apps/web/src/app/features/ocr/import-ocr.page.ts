import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { GroupService, Group } from '../../core/services/group.service';
import { BlocksService } from '../../core/services/blocks.service';
import { ImportOcrService } from './import-ocr.service';
import { ShiftEditorComponent } from './components/shift-editor.component';
import { DetectedShift, ParseIssue } from '@domain/index';
import { minToHhmm } from '@domain/index';

type Step = 'upload' | 'results' | 'saving' | 'summary';

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
    MatExpansionModule,
    MatSnackBarModule,
    MatTableModule,
    ShiftEditorComponent
  ],
  template: `
    <div class="container">
      <div class="nav-back">
        <button mat-stroked-button [routerLink]="['/g', code]">
          <mat-icon>arrow_back</mat-icon>
          Volver al grupo
        </button>
      </div>

      <mat-card>
        <mat-card-header>
          <mat-card-title>Importar Horarios por OCR</mat-card-title>
          <mat-card-subtitle>Sube una captura de tu app de horarios y el sistema detectará los turnos automáticamente</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <!-- Step 1: Upload -->
          <div *ngIf="currentStep === 'upload'">
            <form [formGroup]="uploadForm" (ngSubmit)="onFileSelected()">
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                (change)="onFileChange($event)"
                id="file-input"
                style="display: none"
                #fileInput>
              <label for="file-input">
                <button mat-raised-button color="primary" type="button" (click)="fileInput.click()">
                  <mat-icon>upload</mat-icon>
                  Seleccionar imagen
                </button>
              </label>
              <div *ngIf="selectedFile" class="file-info">
                <p>Archivo seleccionado: {{ selectedFile.name }}</p>
                <img [src]="imagePreview" alt="Preview" class="preview-image" *ngIf="imagePreview">
              </div>
              <div *ngIf="selectedFile && !processingOcr" class="actions">
                <button mat-raised-button color="primary" type="button" (click)="analyzeImage()">
                  <mat-icon>text_fields</mat-icon>
                  Analizar con OCR
                </button>
                <button mat-button type="button" (click)="cancelUpload()">
                  Cancelar
                </button>
              </div>
              <div *ngIf="processingOcr" class="ocr-progress">
                <p>{{ ocrProgressStatus }}</p>
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
              <button mat-raised-button color="accent" (click)="addNewShift()">
                <mat-icon>add</mat-icon>
                Añadir turno
              </button>
            </div>

            <!-- Parse Issues Panel -->
            <mat-expansion-panel *ngIf="parseIssues.length > 0" class="issues-panel">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>warning</mat-icon>
                  Problemas detectados ({{ parseIssues.length }})
                </mat-panel-title>
              </mat-expansion-panel-header>
              <div class="issues-list">
                <div *ngFor="let issue of parseIssues" class="issue-item">
                  <strong>Línea:</strong> {{ issue.line }}<br>
                  <strong>Razón:</strong> {{ issue.reason }}
                </div>
              </div>
            </mat-expansion-panel>

            <!-- OCR Raw Text (Debug) -->
            <mat-expansion-panel class="debug-panel">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>code</mat-icon>
                  Texto OCR (debug)
                </mat-panel-title>
              </mat-expansion-panel-header>
              <pre class="ocr-text">{{ ocrRawText }}</pre>
            </mat-expansion-panel>

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
              <button mat-raised-button color="primary" (click)="saveShifts()" [disabled]="detectedShifts.length === 0 || saving">
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

          <!-- Step 4: Summary -->
          <div *ngIf="currentStep === 'summary'">
            <h3>Resumen de Importación</h3>
            <div class="summary-stats">
              <div class="stat success">
                <mat-icon>check_circle</mat-icon>
                <span>Guardados: {{ savedCount }}</span>
              </div>
              <div class="stat error" *ngIf="failedCount > 0">
                <mat-icon>error</mat-icon>
                <span>Fallidos: {{ failedCount }}</span>
              </div>
            </div>
            <div *ngIf="saveResults.length > 0" class="save-results">
              <h4>Detalles:</h4>
              <div *ngFor="let result of saveResults; let i = index" class="result-item" [class.error]="!result.ok">
                <span>Turno {{ i + 1 }}:</span>
                <span *ngIf="result.ok">✓ Guardado ({{ result.ids.length }} bloque{{ result.ids.length > 1 ? 's' : '' }})</span>
                <span *ngIf="!result.ok">✗ Error: {{ result.error }}</span>
              </div>
            </div>
            <div class="actions">
              <button mat-raised-button color="primary" [routerLink]="['/g', code, 'blocks']">
                Ver bloques
              </button>
              <button mat-raised-button [routerLink]="['/g', code, 'planner']">
                Ver planner
              </button>
              <button mat-button (click)="reset()">
                Importar otro
              </button>
            </div>
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

    .preview-image {
      max-width: 100%;
      max-height: 400px;
      margin-top: 16px;
      border: 1px solid #e0e0e0;
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

    .issues-panel {
      margin-bottom: 16px;
    }

    .issues-list {
      padding: 8px 0;
    }

    .issue-item {
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
      font-size: 0.875rem;
    }

    .debug-panel {
      margin-bottom: 16px;
    }

    .ocr-text {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      font-size: 0.875rem;
      white-space: pre-wrap;
      word-wrap: break-word;
      max-height: 300px;
      overflow-y: auto;
    }

    .shifts-list {
      margin-bottom: 16px;
    }

    .summary-stats {
      display: flex;
      gap: 24px;
      margin: 16px 0;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .stat.success {
      color: #2e7d32;
    }

    .stat.error {
      color: #c62828;
    }

    .save-results {
      margin-top: 16px;
    }

    .result-item {
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }

    .result-item.error {
      color: #c62828;
    }
  `]
})
export class ImportOcrPageComponent implements OnInit, OnDestroy {
  code = '';
  group: Group | null = null;
  currentStep: Step = 'upload';
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  processingOcr = false;
  ocrProgress = 0;
  ocrProgressStatus = '';
  ocrRawText = '';
  detectedShifts: DetectedShift[] = [];
  parseIssues: ParseIssue[] = [];
  saving = false;
  saveResults: Array<{ ok: true; ids: string[] } | { ok: false; error: string }> = [];
  savedCount = 0;
  failedCount = 0;
  minDate = new Date();
  maxDate = new Date();

  uploadForm: FormGroup;
  private ocrCancelToken: { cancel: () => void } | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private groupService: GroupService,
    private blocksService: BlocksService,
    private ocrService: ImportOcrService,
    private snackBar: MatSnackBar
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
        this.snackBar.open('Error al cargar el grupo', 'Cerrar', { duration: 3000 });
        console.error(err);
      }
    });
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.createImagePreview(this.selectedFile);
    }
  }

  createImagePreview(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  onFileSelected() {
    // File selection handled by onFileChange
  }

  async analyzeImage() {
    if (!this.selectedFile || !this.group) return;

    this.processingOcr = true;
    this.ocrProgress = 0;
    this.ocrProgressStatus = 'Inicializando OCR...';

    try {
      const text = await this.ocrService.recognizeText(
        this.selectedFile,
        (progress) => {
          this.ocrProgress = progress.progress;
          this.ocrProgressStatus = progress.status;
        }
      );

      this.ocrRawText = text;
      const parseResult = this.ocrService.parseShifts(
        text,
        this.group.planning_start_date,
        this.group.planning_end_date
      );

      this.detectedShifts = parseResult.shifts;
      this.parseIssues = parseResult.issues;
      this.currentStep = 'results';

      if (this.detectedShifts.length === 0) {
        this.snackBar.open('No se detectaron turnos. Revisa el texto OCR en el panel de debug.', 'Cerrar', { duration: 5000 });
      }
    } catch (error: any) {
      this.snackBar.open('Error al procesar OCR: ' + (error.message || 'Error desconocido'), 'Cerrar', { duration: 5000 });
      console.error('OCR error:', error);
    } finally {
      this.processingOcr = false;
    }
  }

  cancelOcr() {
    // Tesseract doesn't have a built-in cancel, but we can mark as cancelled
    this.processingOcr = false;
    this.ocrProgress = 0;
    this.ocrProgressStatus = '';
  }

  cancelUpload() {
    this.selectedFile = null;
    this.imagePreview = null;
    this.uploadForm.reset();
  }

  cancelResults() {
    this.currentStep = 'upload';
    this.detectedShifts = [];
    this.parseIssues = [];
    this.ocrRawText = '';
  }

  onShiftChange(index: number, updatedShift: DetectedShift) {
    this.detectedShifts[index] = updatedShift;
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
    this.detectedShifts.push(newShift);
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
        this.saveResults = results;
        this.savedCount = results.filter((r): r is { ok: true; ids: string[] } => r.ok).length;
        this.failedCount = results.filter((r): r is { ok: false; error: string } => !r.ok).length;
        this.currentStep = 'summary';

        if (this.savedCount > 0) {
          this.snackBar.open(`${this.savedCount} turno(s) guardado(s) correctamente`, 'Cerrar', { duration: 3000 });
        }
        if (this.failedCount > 0) {
          this.snackBar.open(`${this.failedCount} turno(s) fallaron al guardar`, 'Cerrar', { duration: 5000 });
        }
      },
      error: (err: unknown) => {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        this.snackBar.open('Error al guardar turnos: ' + message, 'Cerrar', { duration: 5000 });
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
    this.selectedFile = null;
    this.imagePreview = null;
    this.ocrRawText = '';
    this.detectedShifts = [];
    this.parseIssues = [];
    this.saveResults = [];
    this.savedCount = 0;
    this.failedCount = 0;
    this.uploadForm.reset();
  }
}

