import { Component, HostListener, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';

import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

import {BehaviorSubject, combineLatest, Observable, Subject} from 'rxjs';
import {map, startWith, takeUntil} from 'rxjs/operators';

import { Example, ExampleTypes } from '../../model/Example';
import {CreateTestDTO, TestCreationStates, TestExample, TestExampleDTO} from '../../model/Test';
import { HttpService } from '../../service/http.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { MatPseudoCheckbox } from '@angular/material/core';

@Component({
  selector: 'app-create-test',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButton,
    MatAutocompleteModule,
    MatIconModule,
    MatDividerModule,
    MatPseudoCheckbox,
  ],
  templateUrl: './test-preview.component.html',
  styleUrl: './test-preview.component.scss',
})
export class TestPreviewComponent implements OnInit {
  data = inject<{ schoolId: number; testId: number }>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<TestPreviewComponent>);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private service = inject(HttpService);
  private readonly destroy$ = new Subject<void>();

  // -----------------------------
  // Test model
  // -----------------------------
  test: CreateTestDTO = {
    authToken: '',
    schoolId: this.data.schoolId,
    name: '',
    note: '',
    exampleList: [] as TestExample[],
    duration: 0,
    state: TestCreationStates.DRAFT,
  };

  hasUnsavedChanges = false;
  isEditMode = false;

  // -----------------------------
  // Examples (available + selected)
  // -----------------------------
  private allExamplesSubject = new BehaviorSubject<Example[]>([]);
  private selectedExamplesSubject = new BehaviorSubject<TestExampleDTO[]>([]);

  /** Input control for autocomplete */
  exampleCtrl = new FormControl<string | Example>('');

  /** Filtered list for autocomplete (excludes selected) */
  filteredExamples$: Observable<Example[]> = combineLatest([
    this.allExamplesSubject.asObservable(),
    this.selectedExamplesSubject.asObservable(),
    this.exampleCtrl.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([all, selected, raw]) => {
      const selectedIds = new Set(selected.map((s) => s.example.id));
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
      console.log(`Loading test with ID ${this.data.testId} for editing...`);
      this.service.getCreateTest(this.data.testId).subscribe({
        next: (response) => {
          this.test = response;
          console.log(this.test)
          this.isEditMode = true;

          // Keep UI selection in sync with backend payload (TestExample[])
          this.selectedExamplesSubject.next(this.test.exampleList ?? []);
        },
      });
    }

    this.service.getFullExamples(this.data.schoolId).subscribe((examples) => {
      this.allExamplesSubject.next(examples as Example[]);
    });
  }

  // -----------------------------
  // Autocomplete display + selection
  // -----------------------------
  displayExample = (value: Example | string | null): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.question?.trim() ?? '';
  };

  onExampleSelected(event: MatAutocompleteSelectedEvent) {
    const picked = event.option.value as Example;
    this.addExampleToSelection(picked);
    this.exampleCtrl.setValue('');
  }

  addExampleToSelection(example: Example) {
    const current = this.selectedExamplesSubject.value;

    if (current.some((x) => x.example?.id === example.id)) return;

    const newEntry: TestExample = {
      id: -1,
      example,
      points: 0,
      title: '',
      test: undefined as any,
    };

    const next: TestExampleDTO[] = [...current, newEntry];
    this.selectedExamplesSubject.next(next);
    this.test.exampleList = [...next];
    this.markDirty();
  }

  removeSelectedExample(entry: TestExampleDTO) {
    const next = this.selectedExamplesSubject.value.filter((x) => x.example.id !== entry.example.id);
    this.selectedExamplesSubject.next(next);
    this.test.exampleList = [...next];
    this.markDirty();
  }

  get selectedExamples(): TestExampleDTO[] {
    return this.selectedExamplesSubject.value;
  }

  // -----------------------------
  // Persist / mapping
  // -----------------------------
  /**
   * Keep test.exampleList in sync.
   */
  private syncSelectionToTest(selected: TestExampleDTO[]) {
    // CreateTestDTO expects TestExampleDTO[] => { example: Example, points: number }
    this.test.exampleList = [...selected];
  }

  protected saveTest() {
    this.hasUnsavedChanges = false;
    this.dialogRef.close(this.test);

    this.test.authToken = localStorage.getItem('teacher_authToken') || '';
    this.test.schoolId = Number(this.test.schoolId || this.data.schoolId);
    this.test.exampleList = this.selectedExamplesSubject.value;


    const request = this.isEditMode
      ? this.service.saveTest(this.data.testId, this.test)
      : this.service.createTest(this.test);

    request
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Test erfolgreich erstellt', 'OK', { duration: 3000 });
          this.hasUnsavedChanges = false;
          this.dialogRef.close(this.test);
        }
      });
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
    const haystack = this.normalize(
      [
        e.question,
        e.instruction,
        e.admin?.username ?? '',
        String(e.id),
        String(e.type ?? ''),
        String(e.difficulty ?? ''),
      ].join(' ')
    );
    return haystack.includes(query);
  }

  protected readonly ExampleTypes = ExampleTypes;

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

  printPreview() {
    document.title = this.test.name || 'Test';
    window.print();
  }
}
