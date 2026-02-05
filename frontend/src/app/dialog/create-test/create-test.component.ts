import { Component, HostListener, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import {MatButton, MatIconButton} from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';

import { MatFormField } from '@angular/material/input';
import { MatInput } from '@angular/material/input';
import { MatLabel } from '@angular/material/input';

import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import {Example, ExampleOverviewDTO, ExampleTypes} from '../../model/Example';
import { TestCreationStates } from '../../model/Test';
import { HttpService } from '../../service/http.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import {MatPseudoCheckbox} from '@angular/material/core'

@Component({
  selector: 'app-create-test',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,

    MatButton,
    MatDialogActions,
    MatDialogContent,

    CdkTextareaAutosize,
    MatFormField,
    MatInput,
    MatLabel,

    MatAutocompleteModule,
    MatIconModule,
    MatDividerModule,
    MatIconButton,
    MatPseudoCheckbox,
  ],
  templateUrl: './create-test.component.html',
  styleUrl: './create-test.component.scss',
})
export class CreateTestComponent implements OnInit {
  data = inject<{ schoolId: number; testId: number }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<CreateTestComponent>);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private service = inject(HttpService);

  // -----------------------------
  // Test model
  // -----------------------------
  test = {
    authToken: '',
    schoolId: this.data.schoolId,
    name: '',
    exampleList: [] as Example[],
    duration: 0,
    state: TestCreationStates.DRAFT,
  };

  hasUnsavedChanges = false;
  isEditMode = false;

  // -----------------------------
  // Examples (available + selected)
  // -----------------------------
  private allExamplesSubject = new BehaviorSubject<Example[]>([]);
  private selectedExamplesSubject = new BehaviorSubject<Example[]>([]);

  /** Input control for autocomplete */
  exampleCtrl = new FormControl<string | Example>('');

  /** Filtered list for autocomplete (excludes selected) */
  filteredExamples$: Observable<Example[]> = combineLatest([
    this.allExamplesSubject.asObservable(),
    this.selectedExamplesSubject.asObservable(),
    this.exampleCtrl.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([all, selected, raw]) => {
      const selectedIds = new Set(selected.map((s) => s.id));
      const query = this.normalize(typeof raw === 'string' ? raw : this.displayExample(raw));

      // available = all - selected
      const available = all.filter((e) => !selectedIds.has(e.id));

      // if empty -> show ALL available
      if (!query) return available;

      // else filter
      return available.filter((e) => this.matchesQuery(e, query));
    })
  );

  constructor() {
    this.dialogRef.disableClose = true;
    this.dialogRef.backdropClick().subscribe(() => this.closeDialog());
    this.dialogRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') this.closeDialog();
    });
  }

  ngOnInit() {
    if (this.data.testId) {
      this.service.getCreateTest(this.data.testId).subscribe({
        next: (response) => {
          this.test = response;
          this.isEditMode = true;

          // Falls dein Backend beim Editieren bereits exampleList liefert:
          // -> Optional: hier könntest du die IDs zurück auf ExampleOverviewDTO mappen,
          // sobald allExamples geladen sind. (Wenn du das brauchst, sag kurz Bescheid.)
        },
      });
    }

    console.log(this.data.schoolId)

    this.service.getFullExamples(this.data.schoolId).subscribe((examples) => {
      this.allExamplesSubject.next(examples as Example[]);
      console.log('Loaded examples for school', this.data.schoolId, examples);
    });
  }

  // -----------------------------
  // Autocomplete display + selection
  // -----------------------------
  displayExample = (value: Example | string | null): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;

    // Kurz & hilfreich: Frage anzeigen (optional mit Typ/Schwierigkeit)
    return value.question?.trim() ?? '';
  };

  onExampleSelected(event: MatAutocompleteSelectedEvent) {
    const picked = event.option.value as Example;
    this.addExampleToSelection(picked);

    // input clear (so list shows all available again)
    this.exampleCtrl.setValue('');
  }

  addExampleToSelection(example: Example) {
    const current = this.selectedExamplesSubject.value;

    // prevent duplicates by id
    if (current.some((x) => x.id === example.id)) return;

    const next = [...current, example];
    this.selectedExamplesSubject.next(next);
    this.syncSelectionToTest(next);
    this.markDirty();
  }

  removeSelectedExample(example: Example) {
    const next = this.selectedExamplesSubject.value.filter((x) => x.id !== example.id);
    this.selectedExamplesSubject.next(next);
    this.syncSelectionToTest(next);
    this.markDirty();
  }

  get selectedExamples(): Example[] {
    return this.selectedExamplesSubject.value;
  }

  // -----------------------------
  // Persist / mapping
  // -----------------------------
  /**
   * Keep test.exampleList in sync.
   * Minimal mapping: only id is guaranteed, rest depends on your backend contract.
   */
  private syncSelectionToTest(selected: Example[]) {
    this.test.exampleList = selected.map((e) => ({ id: e.id } as unknown as Example));
  }

  protected saveTest() {
    // Implementiere hier deine bestehende Save-Logik (create/update) – ich lasse es bewusst clean,
    // weil ich deinen HttpService Contract nicht sehe.
    // Wichtig: this.test.exampleList ist bereits synchronisiert.
    this.hasUnsavedChanges = false;
    this.dialogRef.close(this.test);
  }

  // -----------------------------
  // Close / dirty handling
  // -----------------------------
  async closeDialog() {
    if (this.hasUnsavedChanges) {
      const confirmRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Warnung',
          message: 'Möchten Sie wirklich schließen? Nicht gespeicherte Änderungen gehen verloren.',
          cancelText: 'Abbrechen',
          confirmText: 'Schließen',
        },
      });
      const confirmed = await confirmRef.afterClosed().toPromise();
      if (!confirmed) return;
    }
    this.dialogRef.close();
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: BeforeUnloadEvent) {
    if (this.hasUnsavedChanges) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  markDirty() {
    this.hasUnsavedChanges = true;
  }

  // -----------------------------
  // Filtering helpers
  // -----------------------------
  private normalize(v: string): string {
    return (v ?? '').toString().trim().toLowerCase();
  }

  private matchesQuery(e: Example, query: string): boolean {
    // Du kannst hier beliebig erweitern
    const haystack = this.normalize(
      [
        e.question,
        e.instruction,
        e.admin.username,
        String(e.id),
        String(e.type ?? ''),
        String(e.difficulty ?? ''),
      ].join(' ')
    );
    return haystack.includes(query);
  }

  protected readonly ExampleTypes = ExampleTypes

  getQuestionWithGapLabels(example: Example): string {
    let idx = 0;
    return example.question.replace(/\{Lücke \d+\}/g, () => {
      const label = example.gaps[idx]?.label?.trim();
      idx++;
      return label ? `_____(${label})_____` : `______________`;
    });
  }

  getLetter(i: number): string {
    return String.fromCharCode(65 + i);
  }
}
