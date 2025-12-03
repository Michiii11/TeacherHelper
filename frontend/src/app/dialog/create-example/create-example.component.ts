import {Component, HostListener, inject, OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';

import {MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatButtonToggleModule} from '@angular/material/button-toggle';

import {CreateExampleDTO, ExampleDifficulty, ExampleTypeLabels, ExampleTypes} from '../../model/Example';
import {ConfirmDialogComponent} from '../confirm-dialog/confirm-dialog.component';
import {MatTooltip} from '@angular/material/tooltip'
import {MatPseudoCheckbox} from '@angular/material/core'
import {MatSnackBar} from '@angular/material/snack-bar'
import {HttpClient} from '@angular/common/http'
import {HttpService} from '../../service/http.service'
import {MatDivider} from '@angular/material/divider'
import {MatSlider, MatSliderModule, MatSliderRangeThumb, MatSliderThumb} from '@angular/material/slider'

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
    MatSliderModule
  ],
  templateUrl: './create-example.component.html',
  styleUrls: ['./create-example.component.scss']
})
export class CreateExampleComponent implements OnDestroy {
  data = inject<{ schoolId: number; exampleId: number }>(MAT_DIALOG_DATA);

  example = {} as CreateExampleDTO;
  service = inject(HttpService)

  // types
  readonly ExampleTypes = ExampleTypes;
  exampleTypes = Object.values(ExampleTypes).filter(v => typeof v === 'number') as ExampleTypes[];
  ExampleTypeLabels = ExampleTypeLabels;

  exampleDifficulties = [
    { value: ExampleDifficulty.EASY, label: 'Leicht' },
    { value: ExampleDifficulty.MEDIUM, label: 'Mittel' },
    { value: ExampleDifficulty.HARD, label: 'Schwer' },
    { value: ExampleDifficulty.VERY_HARD, label: 'Sehr schwer' },
    { value: ExampleDifficulty.EXPERT, label: 'Experte' }
  ];
  exampleDifficulty = { value: ExampleDifficulty.EASY, label: 'Easy' };


  // common fields
  selectedExampleType: ExampleTypes = ExampleTypes.OPEN;
  hasUnsavedChanges = false;

  // multiple choice
  multipleChoiceOptions: string[] = ['', ''];
  correctOptions: boolean[] = [false, false];

  // half-open
  halfOpenAnswers: string[] = [''];
  halfOpenCorrectAnswers: string[] = [''];

  // gap-fill
  gapFillGaps: { label: string; options: { text: string; correct: boolean }[] }[] = [];
  gapFillCorrectAnswers: string[] = [];

  // construction
  solutionPreview: string | null = null;

  // assign (refactored)
  assignLeftItems: string[] = [''];
  assignRightItems: string[] = [''];
  // assignConnections[i] = value of assignRightItems[j] or null
  assignConnections: (string | null)[] = [null];

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
          console.log('[CreateExample] loaded example:', response);
        }
      })
    }
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
    this.multipleChoiceOptions.push('');
    this.correctOptions.push(false);
    this.markDirty();
  }

  removeOption(i: number) {
    if (this.multipleChoiceOptions.length <= 2) return; // keep at least 2
    this.multipleChoiceOptions.splice(i, 1);
    this.correctOptions.splice(i, 1);
    this.markDirty();
  }

  /* ----------------------
     Half-open
  ---------------------- */
  addHalfOpenAnswer() {
    this.halfOpenAnswers.push('');
    this.markDirty();
  }

  removeHalfOpenAnswer(i: number) {
    if (this.halfOpenAnswers.length <= 1) return;
    this.halfOpenAnswers.splice(i, 1);
    this.markDirty();
  }

  /* ----------------------
     Assign (left / right lists + connections)
     - Left and Right items are editable.
     - For each left item there is a select to connect to a right item (or "Keine")
  ---------------------- */
  addAssignLeftItem() {
    this.assignLeftItems.push('');
    this.assignConnections.push(null);
    this.markDirty();
  }

  removeAssignLeftItem(i: number) {
    this.assignLeftItems.splice(i, 1);
    this.assignConnections.splice(i, 1);
    this.markDirty();
  }

  addAssignRightItem() {
    this.assignRightItems.push('');
    this.markDirty();
  }

  removeAssignRightItem(i: number) {
    const removed = this.assignRightItems[i];
    this.assignRightItems.splice(i, 1);
    // remove connections to this right item (set to null)
    this.assignConnections = this.assignConnections.map(conn => (conn === removed ? null : conn));
    this.markDirty();
  }

  // when a left item changes the selected connection index (string value)
  setAssignConnection(leftIndex: number, rightValue: string | null) {
    this.assignConnections[leftIndex] = rightValue;
    this.markDirty();
  }

  // builds structured assigns for saving
  buildAssignPairs() {
    return this.assignLeftItems.map((left, i) => ({
      left,
      right: this.assignConnections[i] // maybe null
    }));
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
    const oldGaps = this.gapFillGaps;

    this.gapFillGaps = matches.map((match, i) => {
      const oldGap = oldGaps[i];
      return oldGap
        ? { ...oldGap }
        : {
          label: '',
          options: this.example.gapFillType === 'select'
            ? [
              { text: '', correct: false },
              { text: '', correct: false },
              { text: '', correct: false }
            ]
            : []
        };
    });
  }

  extractGapsFromQuestion(text: string): { label: string; options: { text: string; correct: boolean }[] }[] {
    const regex = /\{Lücke (\d+)\}/g;
    const matches = Array.from(text.matchAll(regex));
    return matches.map(() => ({
      label: '',
      options: []
    }));
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

  onGapFillTypeChange(type: 'select' | 'input') {
    this.example.gapFillType = type;
    this.updateGapsFromText();
    this.markDirty();
  }

  addGapOption(gi: number) {
    this.gapFillGaps[gi].options = this.gapFillGaps[gi].options || [];
    this.gapFillGaps[gi].options.push({ text: '', correct: false });
    this.markDirty();
  }

  removeGapOption(gi: number, oi: number) {
    this.gapFillGaps[gi].options.splice(oi, 1);
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
        this.solutionPreview = reader.result as string;
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
     (save -> console.log for now)
  ---------------------- */
  saveExample() {
    if (!this.example.instruction.trim() || !this.example.question.trim()) {
      this.snackBar.open('Bitte füllen Sie sowohl die Aufgabenstellung als auch die Angabe aus.', 'OK', {
        duration: 3000
      });
      return;
    }

    /*

    const payload: any = {
      type: this.selectedExampleType,
      instruction: this.instruction,
      question: this.question
    };

    // add type-specific
    if (this.selectedExampleType === ExampleTypes.MULTIPLE_CHOICE) {
      payload.options = [];
      for (let i = 0; i < this.multipleChoiceOptions.length; i++) {
        payload.options.push({text: this.multipleChoiceOptions[i], isCorrect: this.correctOptions[i]});
      }
    } else if (this.selectedExampleType === ExampleTypes.HALF_OPEN) {
      payload.answers = this.halfOpenAnswers;
      payload.halfOpenCorrectAnswers = this.halfOpenCorrectAnswers;
    } else if (this.selectedExampleType === ExampleTypes.GAP_FILL) {
      payload.gaps = this.gapFillGaps;
      payload.gapFillType = this.gapFillType;
      payload.gapFillCorrectAnswers = this.gapFillCorrectAnswers;
    } else if (this.selectedExampleType === ExampleTypes.CONSTRUCTION) {
      payload.image = this.imagePreview;
      payload.solutionUrl = this.solutionPreview;
    } else if (this.selectedExampleType === ExampleTypes.ASSIGN) {
      payload.assigns = this.buildAssignPairs();
      payload.assignRightItems = this.assignRightItems;
    }

    payload.authToken = localStorage.getItem('teacher_authToken') || ''
    payload.answer = this.answer
    payload.difficulty = this.exampleDifficulties[this.exampleDifficulty.value].value*/

    this.example.authToken = localStorage.getItem('teacher_authToken') || ''
    this.example.schoolId = this.example.schoolId || this.data.schoolId

    this.http.createExample(this.example).subscribe({
      next: (response) => {
        console.log('[CreateExample] saving (mock):', this.example);
        console.log(response);
        this.hasUnsavedChanges = false;
        this.dialogRef.close(this.example);
      }
    })
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

  ngOnDestroy(): void {
    // nothing to cleanup now
  }

  trackByIndex(index: number, item: any) {
    return index;
  }

  getQuestionWithGapLabels(): string {
    let idx = 0;
    return this.example.question.replace(/\{Lücke \d+\}/g, () => {
      const label = this.gapFillGaps[idx]?.label?.trim();
      idx++;
      if (label) {
        return `_____(${label})_____`;
      } else {
        return `______________`;
      }
    });
  }

  getTooltip() {
    switch (this.selectedExampleType){
      case ExampleTypes.OPEN: return "Beim offenen Antwortformat kann die Bearbeitung der Aufgaben je nach Aufgabenstellung auf unterschiedliche Weise erfolgen.";

      case ExampleTypes.HALF_OPEN: return "Beim halboffenen Antwortformat muss die richtige Antwort in eine vorgegebene Gleichung, Funktion etc. eingesetzt werden.";

      case ExampleTypes.CONSTRUCTION: return "Bei diesem Antwortformat ist eine Abbildung, eine Grafik, ein Diagramm etc. vorgegeben.Diese Aufgaben erfordern die Ergänzung von Graphen, Punkten, Vektoren o. Ä. in die vorgegebene Darstellung."

      case ExampleTypes.MULTIPLE_CHOICE: return "Dieses Antwortformat ist durch einen Fragenstamm und mehreren Antwortmöglichkeiten gekennzeichnet. Aufgaben dieses Formats werden korrekt bearbeitet, indem die richtig zutreffenden Antwortmöglichkeiten angekreuzt werden. ";

      case ExampleTypes.GAP_FILL: return "Dieses Antwortformat ist durch einen Satz mit Lücken gekennzeichnet, d.h., im Aufgabentext sind die Stellen ausgewiesen, die ergänzt werden müssen. Für jede Lücke sind Antwortmöglichkeiten vorgegeben, oder wenn gewünscht auch ohne Antwortmöglichkeiten. Aufgaben dieses Formats werden korrekt bearbeitet, indem die Lücken durch Ankreuzen der beiden zutreffenden Antwortmöglichkeiten gefüllt werden, oder durch Eingabe der richtigen Antwort in die Lücke.";

      case ExampleTypes.ASSIGN: return "Dieses Antwortformat ist durch Auswahlmöglichkeiten (z.B. Aussagen, Tabellen, Abbildungen) gekennzeichnet, die den vorgegebenen Antwortmöglichkeiten zugeordnet werden müssen. Aufgaben dieses Formats werden korrekt bearbeitet, indem man den Antwortmöglichkeiten durch Eintragen des entsprechenden Buchstabens (aus A bis F) jeweils die zutreffende Auswahlmöglichkeit zuordnet.";
    }

    return ""
  }
}
