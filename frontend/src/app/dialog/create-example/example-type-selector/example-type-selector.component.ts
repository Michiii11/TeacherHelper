import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

import { ExampleTypeLabels, ExampleTypes } from '../../../model/Example';

@Component({
  selector: 'app-example-type-selector',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslateModule],
  templateUrl: './example-type-selector.component.html',
  styleUrls: ['./example-type-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExampleTypeSelectorComponent {
  @Input({ required: true }) exampleTypes: ExampleTypes[] = [];
  @Input({ required: true }) selectedType!: ExampleTypes;
  @Input() typeLabels = ExampleTypeLabels;
  @Input() tooltipResolver: (type: ExampleTypes) => string = () => '';

  @Output() selectedTypeChange = new EventEmitter<ExampleTypes>();

  readonly ExampleTypes = ExampleTypes;

  selectType(type: ExampleTypes): void {
    if (type !== this.selectedType) {
      this.selectedTypeChange.emit(type);
    }
  }
}
