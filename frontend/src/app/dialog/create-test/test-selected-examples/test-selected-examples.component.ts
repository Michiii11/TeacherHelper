import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';

import { TestExampleDTO, TestExampleVariableValues } from '../../../model/Test';

@Component({
  selector: 'app-test-selected-examples',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslateModule,
  ],
  templateUrl: './test-selected-examples.component.html',
  styleUrl: './test-selected-examples.component.scss',
})
export class TestSelectedExamplesComponent {
  @Input({ required: true }) selectedExamples: TestExampleDTO[] = [];

  @Input({ required: true }) getResolvedExampleHeading!: (example: TestExampleDTO['example'], values?: TestExampleVariableValues) => string;
  @Input({ required: true }) getExampleMeta!: (entry: TestExampleDTO) => string;
  @Input({ required: true }) getTaskSpacing!: (exampleId: string) => number;
  @Input({ required: true }) hasVariables!: (entry: TestExampleDTO) => boolean;
  @Input({ required: true }) getExampleVariables!: (entry: TestExampleDTO) => Array<{ key: string; defaultValue?: string | null }>;
  @Input({ required: true }) getVariableValue!: (entry: TestExampleDTO, key: string) => string;
  @Input({ required: true }) getResolvedEntryTitle!: (entry: TestExampleDTO) => string;

  @Output() moveExample = new EventEmitter<{ index: number; direction: -1 | 1 }>();
  @Output() removeExample = new EventEmitter<TestExampleDTO>();
  @Output() pointsInput = new EventEmitter<{ entry: TestExampleDTO; value: number | string | null }>();
  @Output() pointsBlur = new EventEmitter<TestExampleDTO>();
  @Output() spacingChange = new EventEmitter<{ exampleId: string; value: number | string | null }>();
  @Output() variableValueChange = new EventEmitter<{ entry: TestExampleDTO; key: string; value: string | null }>();
  @Output() dirty = new EventEmitter<void>();

  trackBySelectedExample = (_: number, entry: TestExampleDTO): string => entry.example.id;
  trackByVariableValue = (index: number, variable: { key: string }): string => variable.key || String(index);
}
