import {Component, HostListener, inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';

import {MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatButtonToggleModule} from '@angular/material/button-toggle';

import {
  Assign,
  CreateExampleDTO,
  ExampleDifficulty,
  ExampleTypeLabels,
  ExampleTypes, Focus,
  Gap,
  Option
} from '../../model/Example';
import {ConfirmDialogComponent} from '../confirm-dialog/confirm-dialog.component';
import {MatTooltip} from '@angular/material/tooltip'
import {MatPseudoCheckbox} from '@angular/material/core'
import {MatSnackBar} from '@angular/material/snack-bar'
import {HttpClient} from '@angular/common/http'
import {HttpService} from '../../service/http.service'
import {MatDivider} from '@angular/material/divider'
import {MatSlider, MatSliderModule, MatSliderRangeThumb, MatSliderThumb} from '@angular/material/slider'
import {MatChip, MatChipInput, MatChipsModule} from '@angular/material/chips'
import {MatAutocomplete, MatAutocompleteTrigger} from '@angular/material/autocomplete'
import {Observable, startWith} from 'rxjs'
import {map} from 'rxjs/operators'

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
  ],
  templateUrl: './create-example.component.html',
  styleUrls: ['./create-example.component.scss']
})
export class CreateExampleComponent implements OnInit {
  data = inject<{ schoolId: number; exampleId: number }>(MAT_DIALOG_DATA);

  example = {
    authToken: '',
    schoolId: this.data.schoolId,
    type: ExampleTypes.OPEN,
    instruction: '',
    question: '',
    answers: [['', '']] as string[][],
    options: [{id: this.generateUniqueId(), text: '', correct: false }] as Option[],
    gapFillType: 'SELECT',
    gaps: [],
    assigns: [{ left: '', right: '' }] as Assign[],
    assignRightItems: [""],
    image: '',
    solution: '',
    solutionUrl: '',
    difficulty: ExampleDifficulty.EASY,
    focusList: []
  } as CreateExampleDTO;
  service = inject(HttpService)

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

  // common fields
  hasUnsavedChanges = false;
  isEditMode = false;

  constructor(
    private dialogRef: MatDialogRef<CreateExampleComponent>,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    dialogRef.disableClose = true;
    dialogRef.backdropClick().subscribe(() => {
      this.closeDialog();
    });
    dialogRef.keydownEvents().subscribe(event => {
      if (event.key === 'Escape') {
        this.closeDialog();
      }
    });
  }

  ngOnInit(){
    if(this.data.exampleId){
      console.log(this.data.exampleId)
      this.service.getCreateExample(this.data.exampleId).subscribe({
        next: (response) => {
          this.example = response;
          this.isEditMode = true;
          console.log('[CreateExample] loaded example:', response);
        }
      })
    }

    this.service.getAllFocus(this.data.schoolId).subscribe(focuses => {
      this.allFocusList = focuses;
      this.filteredFocusList = this.focusCtrl.valueChanges.pipe(
        startWith(''),
        map(val => {
          if (val === null) return this.allFocusList; // falls input leer
          return this._filter(val);
        })
      );
    });
  }

  generateUniqueId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /* ----------------------
     General helpers
  ---------------------- */
  markDirty() {
    this.hasUnsavedChanges = true;
  }

  /* ----------------------
     Multiple choice
  ---------------------- */
  addOption() {
    this.example.options.push({ id: this.generateUniqueId(), text: '', correct: false });
    this.markDirty();
  }

  removeOption(i: number) {
    if (this.example.options.length <= 0) return; // keep at least 2
    this.example.options.splice(i, 1);
    this.markDirty();
  }

  /* ----------------------
     Half-open
  ---------------------- */
  addHalfOpenAnswer() {
    this.example.answers.push(['', '']);
    this.markDirty();
  }

  removeHalfOpenAnswer(i: number) {
    if (this.example.answers.length <= 0) return;
    this.example.answers.splice(i, 1);
    this.markDirty();
  }

  /* ----------------------
     Assign (left / right lists + connections)
     - Left and Right items are editable.
     - For each left item there is a select to connect to a right item (or "Keine")
  ---------------------- */
  addAssignLeftItem() {
    this.example.assigns.push({ left: '', right: '' });
    this.markDirty();
  }

  removeAssignLeftItem(i: number) {
    this.example.assigns.splice(i, 1);
    this.markDirty();
  }

  addAssignRightItem() {
    this.example.assignRightItems.push('');
    this.markDirty();
  }

  removeAssignRightItem(i: number) {
    const removed = this.example.assignRightItems[i];
    this.example.assignRightItems.splice(i, 1);
    this.markDirty();
  }

  // when a left item changes the selected connection index (string value)
  setAssignConnection(assign: Assign, rightValue: string | null) {
    assign.right = rightValue || ""
    this.markDirty();
  }

  getLetter(i: number): string {
    return String.fromCharCode(65 + i);
  }

  /* ----------------------
     Gap fill helpers
  ---------------------- */
  updateGapsFromText() {
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
            ? [{
              id: this.generateUniqueId(),
              text: '',
              correct: false
            }]
            : []
        });
      }
    });

    this.example.gaps = newGaps;
  }

  insertGapAtCursor() {
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

  onGapFillTypeChange(type: 'SELECT' | 'INPUT') {
    this.example.gapFillType = type;
    this.updateGapsFromText();
    this.markDirty();
  }

  addGapOption(gi: number) {
    this.example.gaps[gi].options = this.example.gaps[gi].options || [];
    this.example.gaps[gi].options.push({ text: '', correct: false } as Option);
    this.markDirty();
  }

  removeGapOption(gi: number, oi: number) {
    this.example.gaps[gi].options.splice(oi, 1);
    this.markDirty();
  }

  /* ----------------------
     Construction image
  ---------------------- */
  onImageSelected(event: Event, type: 'solution' | 'preview') {
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


  http = inject(HttpService)

  /* ----------------------
     Save & close
  ---------------------- */
  saveExample() {
    if (!this.example.instruction.trim() || !this.example.question.trim()) {
      this.snackBar.open('Bitte füllen Sie sowohl die Aufgabenstellung als auch die Angabe aus.', 'OK', {
        duration: 3000
      });
      return;
    }

    this.example.authToken = localStorage.getItem('teacher_authToken') || ''
    this.example.schoolId = Number(this.example.schoolId || this.data.schoolId)

    console.log(this.example)
    const request = this.isEditMode
      ? this.http.saveExample(this.data.exampleId, this.example)
      : this.http.createExample(this.example);

    request.subscribe({
      next: (response) => {
        this.hasUnsavedChanges = false;
        this.dialogRef.close(this.example);
      }
    });
  }

  /* ----------------------
     Close with confirm if unsaved
  ---------------------- */
  async closeDialog() {
    if (this.hasUnsavedChanges) {
      const confirmRef = this.dialog.open(ConfirmDialogComponent, {
        data: { title: 'Warnung', message: 'Möchten Sie wirklich schließen? Nicht gespeicherte Änderungen gehen verloren.', cancelText: 'Abbrechen', confirmText: 'Schließen' }
      });
      const confirmed = await confirmRef.afterClosed().toPromise();
      if (!confirmed) return;
    }
    this.dialogRef.close();
  }

  /* ----------------------
     Warn on browser/tab close
     (native beforeunload)
  ---------------------- */
  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: BeforeUnloadEvent) {
    if (this.hasUnsavedChanges) {
      event.preventDefault();
      // Chrome requires returnValue set
      event.returnValue = '';
    }
  }

  trackByIndex(index: number, item: any) {
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
      if (label) {
        return `_____(${label})_____`;
      } else {
        return `______________`;
      }
    });
  }

  getTooltip() {
    switch (this.example.type){
      case ExampleTypes.OPEN: return "Beim offenen Antwortformat kann die Bearbeitung der Aufgaben je nach Aufgabenstellung auf unterschiedliche Weise erfolgen.";

      case ExampleTypes.HALF_OPEN: return "Beim halboffenen Antwortformat muss die richtige Antwort in eine vorgegebene Gleichung, Funktion etc. eingesetzt werden.";

      case ExampleTypes.CONSTRUCTION: return "Bei diesem Antwortformat ist eine Abbildung, eine Grafik, ein Diagramm etc. vorgegeben.Diese Aufgaben erfordern die Ergänzung von Graphen, Punkten, Vektoren o. Ä. in die vorgegebene Darstellung."

      case ExampleTypes.MULTIPLE_CHOICE: return "Dieses Antwortformat ist durch einen Fragenstamm und mehreren Antwortmöglichkeiten gekennzeichnet. Aufgaben dieses Formats werden korrekt bearbeitet, indem die richtig zutreffenden Antwortmöglichkeiten angekreuzt werden. ";

      case ExampleTypes.GAP_FILL: return "Dieses Antwortformat ist durch einen Satz mit Lücken gekennzeichnet, d.h., im Aufgabentext sind die Stellen ausgewiesen, die ergänzt werden müssen. Für jede Lücke sind Antwortmöglichkeiten vorgegeben, oder wenn gewünscht auch ohne Antwortmöglichkeiten. Aufgaben dieses Formats werden korrekt bearbeitet, indem die Lücken durch Ankreuzen der beiden zutreffenden Antwortmöglichkeiten gefüllt werden, oder durch Eingabe der richtigen Antwort in die Lücke.";

      case ExampleTypes.ASSIGN: return "Dieses Antwortformat ist durch Auswahlmöglichkeiten (z.B. Aussagen, Tabellen, Abbildungen) gekennzeichnet, die den vorgegebenen Antwortmöglichkeiten zugeordnet werden müssen. Aufgaben dieses Formats werden korrekt bearbeitet, indem man den Antwortmöglichkeiten durch Eintragen des entsprechenden Buchstabens (aus A bis F) jeweils die zutreffende Auswahlmöglichkeit zuordnet.";
    }

    return ""
  }



  focusCtrl = new FormControl('');
  filteredFocusList: Observable<Focus[]> = new Observable<Focus[]>();
  selectedFocusList: Focus[] = [];
  allFocusList: Focus[] = [];
  allowNewFocus = true;

  private _filter(value: string | Focus): Focus[] {
    const filterValue = typeof value === 'string' ? value.toLowerCase() : value.label.toLowerCase();
    return this.allFocusList.filter(focus => focus.label.toLowerCase().includes(filterValue));
  }

  selectFocus(event: any) {
    const selected: Focus = event.option.value;
    if (!this.selectedFocusList.find(f => f.id === selected.id)) {
      this.selectedFocusList.push(selected);
    }
    this.focusCtrl.setValue('');
  }

  removeFocus(focus: Focus) {
    this.selectedFocusList = this.selectedFocusList.filter(f => f.id !== focus.id);
  }

  createFocus(label: string) {
    this.service.createFocus(this.data.schoolId, { label }).subscribe(newFocus => {
      this.allFocusList.push(newFocus);
      this.selectedFocusList.push(newFocus);
      this.focusCtrl.setValue('');
    });
  }

  addFocusFromInput(event: any) {
    const inputValue = event.value?.trim();
    if (inputValue) this.createFocus(inputValue);
    event.input.value = '';
    this.focusCtrl.setValue('');
  }
}
