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
  private static readonly MAX_FILE_SIZE_MB = 2;
  private readonly allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

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
  @Input() maxSizeMb = ConstructionImageCardComponent.MAX_FILE_SIZE_MB;

  @Output() imageSelected = new EventEmitter<{ event: Event; kind: ConstructionImageKind }>();
  @Output() imageDropped = new EventEmitter<{ file: File; kind: ConstructionImageKind }>();
  @Output() imageRemoved = new EventEmitter<ConstructionImageKind>();
  @Output() widthChange = new EventEmitter<number>();
  @Output() fileTooLarge = new EventEmitter<{ kind: ConstructionImageKind; maxSizeMb: number }>();
  @Output() invalidFileType = new EventEmitter<ConstructionImageKind>();

  isDragOver = false;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!this.isValidFile(file)) {
      input.value = '';
      return;
    }

    this.imageSelected.emit({ event, kind: this.kind });
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const currentTarget = event.currentTarget as HTMLElement | null;
    const relatedTarget = event.relatedTarget as Node | null;

    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }

    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const file = event.dataTransfer?.files?.[0];
    if (!file || !this.isValidFile(file)) {
      return;
    }

    this.imageDropped.emit({ file, kind: this.kind });
  }

  onWidthChange(value: number): void {
    this.width = value;
    this.widthChange.emit(value);
  }

  private isValidFile(file: File): boolean {
    if (!this.allowedImageTypes.includes(file.type)) {
      this.invalidFileType.emit(this.kind);
      return false;
    }

    if (file.size > this.maxSizeMb * 1024 * 1024) {
      this.fileTooLarge.emit({ kind: this.kind, maxSizeMb: this.maxSizeMb });
      return false;
    }

    return true;
  }
}
