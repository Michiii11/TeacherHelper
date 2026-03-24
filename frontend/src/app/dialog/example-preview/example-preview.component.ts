import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NgIf, NgForOf } from '@angular/common';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatPseudoCheckbox } from '@angular/material/core';
import { Subject, takeUntil } from 'rxjs';

import { HttpService } from '../../service/http.service';
import { CreateExampleDTO, ExampleTypes } from '../../model/Example';

type ExamplePreviewDialogData = {
  // bevorzugt: direkt übergeben (kein HTTP nötig)
  example?: CreateExampleDTO;

  // alternativ: per id laden
  exampleId?: number;
  schoolId?: number; // optional (falls dein DTO es braucht)
};

@Component({
  selector: 'app-example-preview',
  standalone: true,
  imports: [NgIf, NgForOf, MatPseudoCheckbox],
  templateUrl: './example-preview.component.html',
  styleUrl: './example-preview.component.scss',
})
export class ExamplePreviewComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly data = inject<ExamplePreviewDialogData>(MAT_DIALOG_DATA);
  private readonly http = inject(HttpService);

  readonly ExampleTypes = ExampleTypes;

  example!: CreateExampleDTO;

  ngOnInit(): void {
    const id = this.data?.exampleId;
    if (id) {
      this.http.getCreateExample(id).subscribe(example => {
        this.example = example;
      })
    }

    console.log(this.example)

    this.example = {
      authToken: '',
      schoolId: this.data?.schoolId ?? 0,
      type: ExampleTypes.OPEN,
      instruction: '',
      question: '',
      answers: [],
      options: [],
      gapFillType: 'SELECT',
      gaps: [],
      assigns: [],
      assignRightItems: [],
      image: '',
      solution: '',
      solutionUrl: '',
      focusList: [],
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getQuestionWithGapLabels(): string {
    const q = this.example?.question ?? '';
    if (this.example?.type !== ExampleTypes.GAP_FILL) return q;

    const gaps = this.example?.gaps ?? [];
    if (!gaps.length) return q;

    let i = 0;
    // ersetzt Sequenzen von mind. 3 underscores
    return q.replace(/_{3,}/g, (match) => {
      const label = gaps[i]?.label ?? this.getLetter(i);
      i++;
      return `${match} (${label})`;
    });
  }

  getLetter(index: number): string {
    // A, B, C...
    return String.fromCharCode(65 + (index % 26));
  }
}
