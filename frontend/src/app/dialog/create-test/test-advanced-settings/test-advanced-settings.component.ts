import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';

import { GradingLevel } from '../../../model/Test';

type GradeMode = 'auto' | 'manual';
type GradePresetKey = 'AT' | 'DE' | 'US' | 'MITARBEIT' | 'CUSTOM';

@Component({
  selector: 'app-test-advanced-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslateModule,
  ],
  templateUrl: './test-advanced-settings.component.html',
  styleUrl: './test-advanced-settings.component.scss',
})
export class TestAdvancedSettingsComponent {
  @Input() defaultTaskSpacing = 48;
  @Input() gradingModeSelection: GradeMode = 'auto';
  @Input() useAutomaticGrading = true;
  @Input() gradingSchema: GradingLevel[] = [];
  @Input() totalPoints = 0;
  @Input() gradeTableHeading = '';

  @Input({ required: true }) getGradeRangeLabelByIndex!: (index: number) => string;
  @Input({ required: true }) trackByGradingLevel!: (index: number, level: GradingLevel) => string;

  @Output() defaultSpacingChanged = new EventEmitter<number | string | null>();
  @Output() applySpacingToEveryTask = new EventEmitter<void>();
  @Output() gradingModeChanged = new EventEmitter<GradeMode>();
  @Output() resetGradingRequested = new EventEmitter<void>();
  @Output() gradingPresetSelected = new EventEmitter<GradePresetKey>();
  @Output() automaticThresholdInput = new EventEmitter<{ level: GradingLevel; value: number | string | null }>();
  @Output() manualThresholdInput = new EventEmitter<{ level: GradingLevel; value: number | string | null }>();
  @Output() levelBlur = new EventEmitter<void>();
  @Output() levelDirty = new EventEmitter<void>();
  @Output() levelMoved = new EventEmitter<{ index: number; direction: -1 | 1 }>();
  @Output() levelRemoved = new EventEmitter<number>();
  @Output() levelAdded = new EventEmitter<void>();
}
