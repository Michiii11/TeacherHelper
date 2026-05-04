import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';

import { Focus } from '../../../model/Example';

@Component({
  selector: 'app-example-focus-selector',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslateModule,
  ],
  templateUrl: './example-focus-selector.component.html',
  styleUrls: ['./example-focus-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExampleFocusSelectorComponent {
  @Input() focuses: Focus[] = [];
  @Input({ required: true }) inputCtrl!: FormControl<string | null>;
  @Input({ required: true }) filteredFocusList!: Observable<Focus[]>;
  @Input() showCreateOption: (value: string | Focus | null) => boolean = () => false;

  @Output() focusRemoved = new EventEmitter<Focus>();
  @Output() focusDeleted = new EventEmitter<{ focus: Focus; event: MouseEvent }>();
  @Output() focusSelected = new EventEmitter<MatAutocompleteSelectedEvent>();
  @Output() focusInputTokenEnd = new EventEmitter<MatChipInputEvent>();

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;
}
