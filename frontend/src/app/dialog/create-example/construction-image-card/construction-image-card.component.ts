import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { TranslateModule } from '@ngx-translate/core';

export type ConstructionImageKind = 'preview' | 'solution';

@Component({
  selector: 'app-construction-image-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatSliderModule, TranslateModule],
  templateUrl: './construction-image-card.component.html',
  styleUrls: ['./construction-image-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConstructionImageCardComponent {
  @Input({ required: true }) kind!: ConstructionImageKind;
  @Input({ required: true }) titleKey!: string;
  @Input({ required: true }) previewAltKey!: string;
  @Input({ required: true }) emptyIcon = 'image';
  @Input({ required: true }) emptyTextKey!: string;
  @Input({ required: true }) widthLabelKey!: string;
  @Input() previewUrl: string | null = null;
  @Input() selectedFile: File | null = null;
  @Input() width = 320;
  @Input() widthName = 'imageWidth';

  @Output() imageSelected = new EventEmitter<{ event: Event; kind: ConstructionImageKind }>();
  @Output() imageRemoved = new EventEmitter<ConstructionImageKind>();
  @Output() widthChange = new EventEmitter<number>();

  onWidthChange(value: number): void {
    this.width = value;
    this.widthChange.emit(value);
  }
}
