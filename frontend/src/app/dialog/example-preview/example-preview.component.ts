import { Component, HostBinding, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, inject } from '@angular/core';
import { NgIf, NgForOf } from '@angular/common';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatPseudoCheckbox } from '@angular/material/core';
import { Subject } from 'rxjs';

import { HttpService } from '../../service/http.service';
import { CreateExampleDTO, ExampleTypes } from '../../model/Example';
import {TranslatePipe} from '@ngx-translate/core'
import {MatProgressBar} from '@angular/material/progress-bar'
import {MatIcon} from '@angular/material/icon'

type ExamplePreviewDialogData = {
  example?: CreateExampleDTO;
  exampleId?: string;
  schoolId?: number;
};

@Component({
  selector: 'app-example-preview',
  standalone: true,
  imports: [NgIf, NgForOf, MatPseudoCheckbox, TranslatePipe, MatProgressBar, MatIcon],
  templateUrl: './example-preview.component.html',
  styleUrl: './example-preview.component.scss',
})
export class ExamplePreviewComponent implements OnInit, OnChanges, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly data = inject<ExamplePreviewDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly http = inject(HttpService);

  readonly ExampleTypes = ExampleTypes;
  readonly defaultImageWidth = 320;
  private readonly variablePattern = /\{([a-zA-Z_][a-zA-Z0-9_-]*)\}/g;

  @Input() example: CreateExampleDTO | null = null;
  @Input() constructionImagePreviewUrl: string | null = null;
  @Input() constructionSolutionPreviewUrl: string | null = null;
  @Input() showHeader = true;

  isLoading = true;

  @HostBinding('class.embedded-preview')
  get embeddedPreview(): boolean {
    return !this.showHeader;
  }

  private readonly imageObjectUrls = new Set<string>();

  async ngOnInit(): Promise<void> {
    this.isLoading = false;

    // Embedded previews receive the example object directly from the create dialog.
    // Do not clone or replace it here, otherwise later ngModel mutations in the parent
    // no longer reach this preview immediately.
    if (this.example) {
      return;
    }

    const id = this.data?.exampleId;

    if (this.data?.example) {
      const normalized = this.withNormalizedImageWidths(this.data.example);
      this.example = await this.withAuthorizedConstructionImages(normalized, id);
      return;
    }

    if (id) {
      this.isLoading = true;
      this.http.getExample(id).subscribe({
        next: async (example) => {
          const normalized = this.withNormalizedImageWidths(example);
          this.example = await this.withAuthorizedConstructionImages(normalized, id);
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        }
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['example']) {
      this.isLoading = false;
    }
  }

  ngOnDestroy(): void {
    this.imageObjectUrls.forEach(url => URL.revokeObjectURL(url));
    this.imageObjectUrls.clear();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async withAuthorizedConstructionImages(example: CreateExampleDTO, exampleId?: string): Promise<CreateExampleDTO> {
    if (example.type !== ExampleTypes.CONSTRUCTION || !exampleId) {
      return example;
    }

    const [image, solutionUrl] = await Promise.all([
      this.loadExampleImageObjectUrl(exampleId, false),
      this.loadExampleImageObjectUrl(exampleId, true),
    ]);

    return {
      ...example,
      image: image || example.image || '',
      solutionUrl: solutionUrl || example.solutionUrl || '',
    };
  }

  private async loadExampleImageObjectUrl(exampleId: string, isSolution: boolean): Promise<string> {
    try {
      const objectUrl = await this.http.getExampleImageObjectUrl(exampleId, isSolution);
      if (objectUrl) {
        this.imageObjectUrls.add(objectUrl);
      }
      return objectUrl || '';
    } catch {
      return '';
    }
  }

  getPreviewImageUrl(): string {
    return this.constructionImagePreviewUrl || this.example?.image || '';
  }

  private getExampleId(example: CreateExampleDTO): string | undefined {
    return (example as CreateExampleDTO & { id?: string }).id || this.data?.exampleId;
  }

  getPreviewSolutionImageUrl(): string {
    return this.constructionSolutionPreviewUrl || this.example?.solutionUrl || '';
  }


  getResolvedText(value: string | null | undefined): string {
    return (value ?? '').replace(this.variablePattern, (_match, key: string) => {
      const variable = (this.example?.variables ?? []).find(entry => entry.key === key.trim());
      return variable?.defaultValue ?? '';
    });
  }

  getQuestionWithGapLabels(): string {
    const q = this.getResolvedText(this.example?.question);
    if (this.example?.type !== ExampleTypes.GAP_FILL) return q;

    const gaps = this.example?.gaps ?? [];
    if (!gaps.length) return q;

    let i = 0;
    return q.replace(/_{3,}/g, (match) => {
      const label = gaps[i]?.label ?? this.getLetter(i);
      i++;
      return `${match} (${label})`;
    });
  }

  getLetter(index: number): string {
    return String.fromCharCode(65 + (index % 26));
  }

  getImageWidth(example: CreateExampleDTO | null | undefined): number {
    return this.normalizeImageWidth(example?.imageWidth);
  }

  getSolutionImageWidth(example: CreateExampleDTO | null | undefined): number {
    return this.normalizeImageWidth(example?.solutionImageWidth);
  }

  private withNormalizedImageWidths(example: CreateExampleDTO): CreateExampleDTO {
    return {
      ...example,
      imageWidth: this.normalizeImageWidth(example.imageWidth),
      solutionImageWidth: this.normalizeImageWidth(example.solutionImageWidth),
    };
  }

  private normalizeImageWidth(value: number | null | undefined): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return this.defaultImageWidth;
    }
    return Math.max(80, Math.min(1200, Math.round(parsed)));
  }
}
