import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SafeHtml } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogActions } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-test-print-preview-pane',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogActions,
    MatIconModule,
    MatProgressBarModule,
    TranslateModule,
  ],
  templateUrl: './test-print-preview-pane.component.html',
  styleUrl: './test-print-preview-pane.component.scss',
})
export class TestPrintPreviewPaneComponent {
  @Input() previewHtml: SafeHtml = '';
  @Input() printCopies = 1;
  @Input() includeSolutionSheet = false;
  @Input() isSaving = false;

  @Output() printCopiesChange = new EventEmitter<number | string | null>();
  @Output() includeSolutionSheetChange = new EventEmitter<boolean>();
  @Output() printRequested = new EventEmitter<void>();
  @Output() closeRequested = new EventEmitter<void>();
  @Output() saveRequested = new EventEmitter<void>();
  @Output() increaseCopies = new EventEmitter<void>();
  @Output() decreaseCopies = new EventEmitter<void>();
}
