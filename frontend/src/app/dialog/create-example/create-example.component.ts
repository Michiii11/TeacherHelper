import {
  Component,
  HostListener, inject,
  OnDestroy, Pipe, PipeTransform
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {MatDialog, MatDialogActions, MatDialogContent, MatDialogRef} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { ExampleTypes, ExampleTypeLabels } from '../../model/Example';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import {MatTooltip} from '@angular/material/tooltip'
import {MatPseudoCheckbox} from '@angular/material/core'

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
    MatPseudoCheckbox
  ],
  templateUrl: './create-example.component.html',
  styleUrls: ['./create-example.component.scss']
})
export class CreateExampleComponent implements OnDestroy {
  // types
  readonly ExampleTypes = ExampleTypes;
  exampleTypes = Object.values(ExampleTypes).filter(v => typeof v === 'number') as ExampleTypes[];
  ExampleTypeLabels = ExampleTypeLabels;


  // common fields
  selectedExampleType: ExampleTypes = ExampleTypes.OPEN;
  instruction = '';
  question = '';
  hasUnsavedChanges = false;

  // multiple choice
  multipleChoiceOptions: string[] = ['', ''];
  correctOptions: boolean[] = [false, false];

  // half-open
  halfOpenAnswers: string[] = [''];

  // gap-fill
  gapFillType: 'select' | 'input' = 'select';
  gapFillGaps: { label: string; options: { text: string; correct: boolean }[] }[] = [];

  // construction
  imagePreview: string | null = null;

  // assign (refactored)
  assignLeftItems: string[] = ['Linkes Statement 1'];
  assignRightItems: string[] = ['Rechtes Statement A'];
  // assignConnections[i] = value of assignRightItems[j] or null
  assignConnections: (string | null)[] = [null];

  constructor(
    private dialogRef: MatDialogRef<CreateExampleComponent>,
    private dialog: MatDialog
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

  /* ----------------------
     Gap fill helpers
  ---------------------- */
  updateGapsFromText() {
    const regex = /\{Lücke (\d+)\}/g;
    const matches = Array.from(this.question.matchAll(regex));
    this.gapFillGaps = matches.map(() => ({
      label: '',
      options: this.gapFillType === 'select'
        ? [
          { text: '', correct: false },
          { text: '', correct: false },
          { text: '', correct: false }
        ]
        : []
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
    this.gapFillType = type;
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
  onImageSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview = reader.result as string;
      this.markDirty();
    };
    reader.readAsDataURL(file);
  }

  /* ----------------------
     Save & close
     (save -> console.log for now)
  ---------------------- */
  saveExample() {
    const payload: any = {
      type: this.selectedExampleType,
      instruction: this.instruction,
      question: this.question
    };

    // add type-specific
    if (this.selectedExampleType === ExampleTypes.MULTIPLE_CHOICE) {
      payload.options = this.multipleChoiceOptions;
      payload.correct = this.correctOptions;
    } else if (this.selectedExampleType === ExampleTypes.HALF_OPEN) {
      payload.answers = this.halfOpenAnswers;
    } else if (this.selectedExampleType === ExampleTypes.GAP_FILL) {
      payload.gaps = this.gapFillGaps;
      payload.gapFillType = this.gapFillType;
    } else if (this.selectedExampleType === ExampleTypes.CONSTRUCTION) {
      payload.image = this.imagePreview;
    } else if (this.selectedExampleType === ExampleTypes.ASSIGN) {
      payload.assigns = this.buildAssignPairs();
      payload.assignRightItems = this.assignRightItems;
    }

    console.log('[CreateExample] saving (mock):', payload);
    this.hasUnsavedChanges = false;
    this.dialogRef.close(payload);
  }

  /* ----------------------
     Close with confirm if unsaved
  ---------------------- */
  async closeDialog() {
    if (this.hasUnsavedChanges) {
      const confirmRef = this.dialog.open(ConfirmDialogComponent, {
        data: { message: 'Möchten Sie wirklich schließen? Nicht gespeicherte Änderungen gehen verloren.' }
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

  trackByIndex(index: number, item: any): number {
    return index;
  }

  getQuestionWithGapLabels(): string {
    let idx = 0;
    return this.question.replace(/\{Lücke \d+\}/g, () => {
      const label = this.gapFillGaps[idx]?.label?.trim();
      idx++;
      if (label) {
        return `_____(${label})_____`;
      } else {
        return `______________`;
      }
    });
  }
}
