import { Component, ElementRef, HostListener, ViewChild, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { MatPseudoCheckbox } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDivider } from '@angular/material/divider';
import { MatSliderModule } from '@angular/material/slider';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatAutocomplete, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';

import { BehaviorSubject, Subject, combineLatest, startWith } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

import {
  Assign,
  CreateExampleDTO,
  ExampleDifficulty,
  ExampleTypeLabels,
  ExampleTypes,
  Focus,
  Gap,
  Option
} from '../../model/Example';
import { HttpService } from '../../service/http.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-create-example',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatButtonToggleModule,
    MatDialogActions,
    MatDialogContent,
    MatTooltip,
    MatPseudoCheckbox,
    MatDivider,
    MatSliderModule,
    ReactiveFormsModule,
    MatChipsModule,
    MatAutocompleteTrigger,
    MatAutocomplete,
  ],
  templateUrl: './create-example.component.html',
  styleUrls: ['./create-example.component.scss']
})
export class CreateExampleComponent implements OnInit, OnDestroy {
  data = inject<{ schoolId: number; exampleId: number }>(MAT_DIALOG_DATA);
  private readonly destroy$ = new Subject<void>();

  private readonly http = inject(HttpService);

  // ------- UI state -------
  hasUnsavedChanges = false;
  isEditMode = false;

  // ------- form model -------
  example: CreateExampleDTO = {
    authToken: '',
    schoolId: this.data.schoolId,
    type: ExampleTypes.OPEN,
    instruction: '',
    question: '',
    answers: [['', '']] as string[][],
    options: [{ id: this.generateUniqueId(), text: '', correct: false }] as Option[],
    gapFillType: 'SELECT',
    gaps: [],
    assigns: [{ left: '', right: '' }] as Assign[],
    assignRightItems: [''],
    image: '',
    solution: '',
    solutionUrl: '',
    difficulty: ExampleDifficulty.EASY,
    focusList: []
  };

  // types
  readonly ExampleTypes = ExampleTypes;
  exampleTypes = Object.values(ExampleTypes) as ExampleTypes[];
  ExampleTypeLabels = ExampleTypeLabels;

  exampleDifficulties = [
    { value: ExampleDifficulty.EASY, label: 'Leicht' },
    { value: ExampleDifficulty.MEDIUM, label: 'Mittel' },
    { value: ExampleDifficulty.HARD, label: 'Schwer' },
    { value: ExampleDifficulty.VERY_HARD, label: 'Sehr schwer' },
    { value: ExampleDifficulty.EXPERT, label: 'Experte' }
  ];

  constructor(
    private dialogRef: MatDialogRef<CreateExampleComponent>,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    dialogRef.disableClose = true;

    dialogRef.backdropClick()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.closeDialog());

    dialogRef.keydownEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        if (event.key === 'Escape') this.closeDialog();
      });
  }

  // ---------------------------
  // Focus (tags): source + selection
  // ---------------------------
  private readonly focusSubject = new BehaviorSubject<Focus[]>([]);
  readonly focus$ = this.focusSubject.asObservable();

  private readonly selectedFocusSubject = new BehaviorSubject<Focus[]>([]);
  readonly selectedFocus$ = this.selectedFocusSubject.asObservable();

  inputCtrl = new FormControl<string>('');

  @ViewChild('inputEl') inputEl!: ElementRef<HTMLInputElement>;
  @ViewChild(MatAutocompleteTrigger) autocompleteTrigger!: MatAutocompleteTrigger;

  /**
   * Autocomplete list:
   * - Always show all available focuses minus selected ones.
   * - If user typed something => filter by query
   */
  readonly filteredFocusList = combineLatest([
    this.inputCtrl.valueChanges.pipe(startWith('')),
    this.focus$,
    this.selectedFocus$,
  ]).pipe(
    map(([rawValue, focuses, selected]) => {
      const query = this.normalizeLabel(typeof rawValue === 'string' ? rawValue : '');

      const selectedSet = new Set(selected.map(s => this.normalizeLabel(s.label)));

      return focuses
        // hide selected from suggestions
        .filter(f => !selectedSet.has(this.normalizeLabel(f.label)))
        // if user typed something, filter; otherwise show all (minus selected)
        .filter(f => !query || this.normalizeLabel(f.label).includes(query));
    })
  );

  ngOnInit(): void {
    // Load focus catalog
    this.http.getAllFocus(this.data.schoolId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(focuses => this.focusSubject.next(focuses));

    // Edit mode: load example then sync selected focuses
    if (this.data.exampleId) {
      this.http.getCreateExample(this.data.exampleId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.example = response;
            this.isEditMode = true;
            this.emitSelectedFocus();
          }
        });
    } else {
      this.emitSelectedFocus();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------------------------
  // Utility helpers
  // ---------------------------
  private normalizeLabel(label: string): string {
    return (label ?? '').trim().toLowerCase();
  }

  private emitSelectedFocus(): void {
    // new reference => combineLatest updates immediately
    this.selectedFocusSubject.next([...(this.example.focusList ?? [])]);
  }

  private clearFocusInput(): void {
    this.inputCtrl.setValue('');
    if (this.inputEl) this.inputEl.nativeElement.value = '';
  }

  generateUniqueId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  markDirty(): void {
    this.hasUnsavedChanges = true;
  }

  // ----------------------
  // Multiple choice
  // ----------------------
  addOption(): void {
    this.example.options.push({ id: this.generateUniqueId(), text: '', correct: false });
    this.markDirty();
  }

  removeOption(i: number): void {
    if (this.example.options.length <= 0) return;
    this.example.options.splice(i, 1);
    this.markDirty();
  }

  // ----------------------
  // Half-open
  // ----------------------
  addHalfOpenAnswer(): void {
    this.example.answers.push(['', '']);
    this.markDirty();
  }

  removeHalfOpenAnswer(i: number): void {
    if (this.example.answers.length <= 0) return;
    this.example.answers.splice(i, 1);
    this.markDirty();
  }

  // ----------------------
  // Assign (left / right lists + connections)
  // ----------------------
  addAssignLeftItem(): void {
    this.example.assigns.push({ left: '', right: '' });
    this.markDirty();
  }

  removeAssignLeftItem(i: number): void {
    this.example.assigns.splice(i, 1);
    this.markDirty();
  }

  addAssignRightItem(): void {
    this.example.assignRightItems.push('');
    this.markDirty();
  }

  removeAssignRightItem(i: number): void {
    this.example.assignRightItems.splice(i, 1);
    this.markDirty();
  }

  setAssignConnection(assign: Assign, rightValue: string | null): void {
    assign.right = rightValue || '';
    this.markDirty();
  }

  getLetter(i: number): string {
    return String.fromCharCode(65 + i);
  }

  // ----------------------
  // Gap fill helpers
  // ----------------------
  updateGapsFromText(): void {
    const regex = /\{Lücke (\d+)\}/g;
    const matches = Array.from(this.example.question.matchAll(regex));

    const oldGaps = [...this.example.gaps];
    const newGaps: Gap[] = [];

    matches.forEach(match => {
      const gapIndex = Number(match[1]) - 1;
      const existing = oldGaps[gapIndex];

      if (existing) {
        newGaps.push(existing);
      } else {
        newGaps.push({
          id: '',
          label: '',
          solution: '',
          options: this.example.gapFillType === 'SELECT'
            ? [{ id: this.generateUniqueId(), text: '', correct: false }]
            : []
        });
      }
    });

    this.example.gaps = newGaps;
  }

  insertGapAtCursor(): void {
    const textarea = document.querySelector('textarea[name="question"]') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    const nextIdx = (value.match(/\{Lücke (\d+)\}/g)?.length ?? 0) + 1;
    const gapText = `{Lücke ${nextIdx}}`;

    textarea.value = value.slice(0, start) + gapText + value.slice(end);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    this.markDirty();
    this.updateGapsFromText();
  }

  onGapFillTypeChange(type: 'SELECT' | 'INPUT'): void {
    this.example.gapFillType = type;
    this.updateGapsFromText();
    this.markDirty();
  }

  addGapOption(gi: number): void {
    this.example.gaps[gi].options = this.example.gaps[gi].options || [];
    this.example.gaps[gi].options.push({ text: '', correct: false } as Option);
    this.markDirty();
  }

  removeGapOption(gi: number, oi: number): void {
    this.example.gaps[gi].options.splice(oi, 1);
    this.markDirty();
  }

  // ----------------------
  // Construction image
  // ----------------------
  onImageSelected(event: Event, type: 'solution' | 'preview'): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (type === 'solution') {
        this.example.solutionUrl = reader.result as string;
      } else {
        this.example.image = reader.result as string;
      }
      this.markDirty();
    };
    reader.readAsDataURL(file);
  }

  // ----------------------
  // Save & close
  // ----------------------
  saveExample(): void {
    if (!this.example.instruction.trim() || !this.example.question.trim()) {
      this.snackBar.open('Bitte füllen Sie sowohl die Aufgabenstellung als auch die Angabe aus.', 'OK', {
        duration: 3000
      });
      return;
    }

    this.example.authToken = localStorage.getItem('teacher_authToken') || '';
    this.example.schoolId = Number(this.example.schoolId || this.data.schoolId);

    const request = this.isEditMode
      ? this.http.saveExample(this.data.exampleId, this.example)
      : this.http.createExample(this.example);

    request
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.hasUnsavedChanges = false;
          this.dialogRef.close(this.example);
        }
      });
  }

  async closeDialog(): Promise<void> {
    if (this.hasUnsavedChanges) {
      const confirmRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Warnung',
          message: 'Möchten Sie wirklich schließen? Nicht gespeicherte Änderungen gehen verloren.',
          cancelText: 'Abbrechen',
          confirmText: 'Schließen'
        }
      });

      const confirmed = await confirmRef.afterClosed().toPromise();
      if (!confirmed) return;
    }

    this.dialogRef.close();
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  // ----------------------
  // TrackBy + preview helpers
  // ----------------------
  trackByIndex(index: number): number {
    return index;
  }

  trackByOptionId(index: number, option: Option): string {
    return option.id;
  }

  trackByGapId(index: number, gap: Gap): string {
    return gap.id;
  }

  getQuestionWithGapLabels(): string {
    let idx = 0;
    return this.example.question.replace(/\{Lücke \d+\}/g, () => {
      const label = this.example.gaps[idx]?.label?.trim();
      idx++;
      return label ? `_____(${label})_____` : `______________`;
    });
  }

  getTooltip(): string {
    switch (this.example.type) {
      case ExampleTypes.OPEN:
        return 'Beim offenen Antwortformat kann die Bearbeitung der Aufgaben je nach Aufgabenstellung auf unterschiedliche Weise erfolgen.';
      case ExampleTypes.HALF_OPEN:
        return 'Beim halboffenen Antwortformat muss die richtige Antwort in eine vorgegebene Gleichung, Funktion etc. eingesetzt werden.';
      case ExampleTypes.CONSTRUCTION:
        return 'Bei diesem Antwortformat ist eine Abbildung, eine Grafik, ein Diagramm etc. vorgegeben.Diese Aufgaben erfordern die Ergänzung von Graphen, Punkten, Vektoren o. Ä. in die vorgegebene Darstellung.';
      case ExampleTypes.MULTIPLE_CHOICE:
        return 'Dieses Antwortformat ist durch einen Fragenstamm und mehreren Antwortmöglichkeiten gekennzeichnet. Aufgaben dieses Formats werden korrekt bearbeitet, indem die richtig zutreffenden Antwortmöglichkeiten angekreuzt werden.';
      case ExampleTypes.GAP_FILL:
        return 'Dieses Antwortformat ist durch einen Satz mit Lücken gekennzeichnet, d.h., im Aufgabentext sind die Stellen ausgewiesen, die ergänzt werden müssen. Für jede Lücke sind Antwortmöglichkeiten vorgegeben, oder wenn gewünscht auch ohne Antwortmöglichkeiten. Aufgaben dieses Formats werden korrekt bearbeitet, indem die Lücken durch Ankreuzen der beiden zutreffenden Antwortmöglichkeiten gefüllt werden, oder durch Eingabe der richtigen Antwort in die Lücke.';
      case ExampleTypes.ASSIGN:
        return 'Dieses Antwortformat ist durch Auswahlmöglichkeiten (z.B. Aussagen, Tabellen, Abbildungen) gekennzeichnet, die den vorgegebenen Antwortmöglichkeiten zugeordnet werden müssen. Aufgaben dieses Formats werden korrekt bearbeitet, indem man den Antwortmöglichkeiten durch Eintragen des entsprechenden Buchstabens (aus A bis F) jeweils die zutreffende Auswahlmöglichkeit zuordnet.';
      default:
        return '';
    }
  }

  // ---------------------------
  // Focus (chips + autocomplete) actions
  // ---------------------------
  showCreateOption(value: string | Focus | null): boolean {
    if (!value) return false;

    const label = this.normalizeLabel(typeof value === 'string' ? value : value.label);
    if (!label) return false;

    const existsInCatalog = this.focusSubject.value.some(f => this.normalizeLabel(f.label) === label);
    const alreadySelected = this.example.focusList.some(f => this.normalizeLabel(f.label) === label);

    return !existsInCatalog && !alreadySelected;
  }

  selected(event: MatAutocompleteSelectedEvent): void {
    const opt = event.option.value as Focus | string;

    const value: Focus =
      typeof opt === 'string'
        ? { id: 0, label: opt }
        : { id: opt.id, label: opt.label };

    this.addFocus(value);
    this.autocompleteTrigger.closePanel();
  }

  addFromInput(event: MatChipInputEvent): void {
    // Avoid double-add when user hits enter while panel open
    if (this.autocompleteTrigger?.panelOpen) return;

    const raw = (event.value ?? '').toString();
    const label = raw.trim();
    if (!label) return;

    this.addFocus({ id: 0, label });

    event.chipInput?.clear();
  }

  remove(focus: Focus): void {
    const removeLabel = this.normalizeLabel(focus.label);
    this.example.focusList = this.example.focusList.filter(f => this.normalizeLabel(f.label) !== removeLabel);

    // ✅ makes removed tag instantly available again in autocomplete
    this.emitSelectedFocus();
    this.markDirty();
  }

  private addFocus(value: Focus): void {
    const label = this.normalizeLabel(value.label);
    if (!label) {
      this.clearFocusInput();
      return;
    }

    // ✅ prevent duplicates in selection (case-insensitive)
    if (this.example.focusList.some(f => this.normalizeLabel(f.label) === label)) {
      this.clearFocusInput();
      return;
    }

    // If exists in catalog, use catalog object (keeps real id)
    const existing = this.focusSubject.value.find(f => this.normalizeLabel(f.label) === label);
    const focusToAdd: Focus = existing ? existing : { id: 0, label: value.label.trim() };

    this.example.focusList.push(focusToAdd);

    // ✅ makes selected tag instantly disappear from autocomplete
    this.emitSelectedFocus();
    this.markDirty();

    // If new, optimistically add to catalog and then replace with server-created id
    if (!existing) {
      const optimistic: Focus = { id: 0, label: focusToAdd.label };
      this.focusSubject.next([...this.focusSubject.value, optimistic]);

      this.http.createFocus(this.data.schoolId, { id: -1, label: focusToAdd.label })
        .pipe(takeUntil(this.destroy$))
        .subscribe(createdFocus => {
          // Update selected list (replace optimistic with persisted focus)
          const selIdx = this.example.focusList.findIndex(f => this.normalizeLabel(f.label) === this.normalizeLabel(createdFocus.label));
          if (selIdx !== -1) {
            this.example.focusList[selIdx] = createdFocus;
            this.emitSelectedFocus();
          }

          // Update catalog: replace optimistic with persisted focus
          const catalog = [...this.focusSubject.value];
          const catIdx = catalog.findIndex(f => this.normalizeLabel(f.label) === this.normalizeLabel(createdFocus.label));
          if (catIdx !== -1) {
            catalog[catIdx] = createdFocus;
            this.focusSubject.next(catalog);
          }
        });
    }

    this.clearFocusInput();
  }

  deleteFocus(focus: Focus, event: MouseEvent): void {
    event.stopPropagation();

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Warnung',
        message: 'Möchten Sie diesen Schwerpunkt wirklich löschen? Es kann sein das er noch bei anderen Beispielen verwenden wird.',
        cancelText: 'Abbrechen',
        confirmText: 'Löschen',
        requireConfirmation: true,
        confirmationText: 'Ich verstehe, dass diese Aktion nicht rückgängig gemacht werden kann.'
      },
    }).afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (!result) return;

        this.http.deleteFocus(this.data.schoolId, focus.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => {
            this.snackBar.open(`Der Schwerpunkt "${focus.label}" wurde gelöscht.`, 'OK', { duration: 3000 });
          });

        // remove from catalog
        this.focusSubject.next(this.focusSubject.value.filter(f => f.id !== focus.id));

        // remove from selection
        const removedLabel = this.normalizeLabel(focus.label);
        this.example.focusList = this.example.focusList.filter(f => this.normalizeLabel(f.label) !== removedLabel);

        // ✅ keeps autocomplete correct immediately
        this.emitSelectedFocus();
        this.markDirty();
      });
  }
}
