import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NgIf, NgForOf } from '@angular/common';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatPseudoCheckbox } from '@angular/material/core';
import { Subject } from 'rxjs';

import { HttpService } from '../../service/http.service';
import { CreateExampleDTO, ExampleTypes } from '../../model/Example';

type ExamplePreviewDialogData = {
  example?: CreateExampleDTO;
  exampleId?: string;
  schoolId?: number;
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
  readonly defaultImageWidth = 320;

  example!: CreateExampleDTO;

  private readonly imageObjectUrls = new Set<string>();

  async ngOnInit(): Promise<void> {
    const id = this.data?.exampleId;

    if (this.data?.example) {
      const normalized = this.withNormalizedImageWidths(this.data.example);
      this.example = await this.withAuthorizedConstructionImages(normalized, id);
      return;
    }

    if (id) {
      this.http.getExample(id).subscribe({
        next: async (example) => {
          const normalized = this.withNormalizedImageWidths(example);
          this.example = await this.withAuthorizedConstructionImages(normalized, id);
        }
      });
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

    const image = example.image
      ? await this.loadExampleImageObjectUrl(exampleId, false)
      : '';

    const solutionUrl = example.solutionUrl
      ? await this.loadExampleImageObjectUrl(exampleId, true)
      : '';

    return {
      ...example,
      image,
      solutionUrl,
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

  getQuestionWithGapLabels(): string {
    const q = this.example?.question ?? '';
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
