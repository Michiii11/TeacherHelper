import {
  Component,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewEncapsulation,
  inject,
} from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import * as katex from "katex";
import { NgIf, NgForOf } from "@angular/common";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatPseudoCheckbox } from "@angular/material/core";
import { Subject } from "rxjs";

import { HttpService } from "../../service/http.service";
import { CreateExampleDTO, ExampleTypes } from "../../model/Example";
import { TranslatePipe, TranslateService } from "@ngx-translate/core";
import { MatProgressBar } from "@angular/material/progress-bar";
import { MatIcon } from "@angular/material/icon";
import { ExamplePreviewRendererService } from "../../service/example-preview-renderer.service";

type ExamplePreviewDialogData = {
  example?: CreateExampleDTO;
  exampleId?: string;
  schoolId?: number;
};

@Component({
  selector: "app-example-preview",
  standalone: true,
  imports: [
    TranslatePipe,
    MatProgressBar,
    MatIcon,
  ],
  templateUrl: "./example-preview.component.html",
  styleUrl: "./example-preview.component.scss",
  encapsulation: ViewEncapsulation.None,
})
export class ExamplePreviewComponent implements OnInit, OnChanges, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly data = inject<ExamplePreviewDialogData | null>(
    MAT_DIALOG_DATA,
    { optional: true },
  );
  private readonly http = inject(HttpService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly previewRenderer = inject(ExamplePreviewRendererService);
  private readonly translate = inject(TranslateService);

  readonly ExampleTypes = ExampleTypes;
  readonly defaultImageWidth = 320;
  private readonly variablePattern = /\[\[([a-zA-Z_][a-zA-Z0-9_-]*)\]\]/g;

  @Input() example: CreateExampleDTO | null = null;
  @Input() constructionImagePreviewUrl: string | null = null;
  @Input() constructionSolutionPreviewUrl: string | null = null;
  @Input() showHeader = true;

  isLoading = true;
  previewHtml: SafeHtml = "";

  showInstructionLabel(): boolean {
    return this.example?.displaySettings?.showInstructionLabel !== false;
  }

  showQuestionLabel(): boolean {
    return this.example?.displaySettings?.showQuestionLabel !== false;
  }

  showTaskImageLabel(): boolean {
    return this.example?.displaySettings?.showTaskImageLabel !== false;
  }

  @HostBinding("class.embedded-preview")
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
      this.refreshPreviewHtml();
      return;
    }

    const id = this.data?.exampleId;

    if (this.data?.example) {
      const normalized = this.withNormalizedImageWidths(this.data.example);
      this.example = await this.withAuthorizedConstructionImages(
        normalized,
        id,
      );
      this.refreshPreviewHtml();
      return;
    }

    if (id) {
      this.isLoading = true;
      this.http.getExample(id).subscribe({
        next: async (example) => {
          const normalized = this.withNormalizedImageWidths(example);
          this.example = await this.withAuthorizedConstructionImages(
            normalized,
            id,
          );
          this.refreshPreviewHtml();
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        },
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes["example"] ||
      changes["constructionImagePreviewUrl"] ||
      changes["constructionSolutionPreviewUrl"]
    ) {
      this.isLoading = false;
      this.refreshPreviewHtml();
    }
  }

  ngOnDestroy(): void {
    this.imageObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.imageObjectUrls.clear();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async withAuthorizedConstructionImages(
    example: CreateExampleDTO,
    exampleId?: string,
  ): Promise<CreateExampleDTO> {
    if (example.type !== ExampleTypes.CONSTRUCTION || !exampleId) {
      return example;
    }

    const [image, solutionUrl] = await Promise.all([
      this.loadExampleImageObjectUrl(exampleId, false),
      this.loadExampleImageObjectUrl(exampleId, true),
    ]);

    return {
      ...example,
      image: image || example.image || "",
      solutionUrl: solutionUrl || example.solutionUrl || "",
    };
  }

  private async loadExampleImageObjectUrl(
    exampleId: string,
    isSolution: boolean,
  ): Promise<string> {
    try {
      const objectUrl = await this.http.getExampleImageObjectUrl(
        exampleId,
        isSolution,
      );
      if (objectUrl) {
        this.imageObjectUrls.add(objectUrl);
      }
      return objectUrl || "";
    } catch {
      return "";
    }
  }

  getPreviewImageUrl(): string {
    return this.constructionImagePreviewUrl || this.example?.image || "";
  }

  private getExampleId(example: CreateExampleDTO): string | undefined {
    return (
      (example as CreateExampleDTO & { id?: string }).id || this.data?.exampleId
    );
  }

  getPreviewSolutionImageUrl(): string {
    return (
      this.constructionSolutionPreviewUrl || this.example?.solutionUrl || ""
    );
  }

  private refreshPreviewHtml(): void {
    if (!this.example) {
      this.previewHtml = this.sanitizer.bypassSecurityTrustHtml("");
      return;
    }

    const previewExample = this.buildRendererExample(this.example);
    const html = this.previewRenderer.buildExamplePreviewPanelHtml(
      previewExample,
      {
        getLetter: (index) => this.getLetter(index),
        labels: {
          instruction: this.translateOrFallback(
            "collection.instruction",
            "Angabe",
          ),
          question: this.translateOrFallback(
            "collection.question",
            "Aufgabenstellung",
          ),
          taskImage: this.translateOrFallback(
            "exampleDialog.taskImage",
            "Aufgabenbild",
          ),
          imagePreviewAlt: this.translateOrFallback(
            "exampleDialog.taskImagePreviewAlt",
            "Aufgabenbild Vorschau",
          ),
          noTaskImage: this.translateOrFallback(
            "exampleDialog.noTaskImage",
            "Kein Aufgabenbild ausgewählt.",
          ),
          noSolution: this.translateOrFallback("exampleDialog.noSolution", ""),
        },
      },
    );

    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private buildRendererExample(example: CreateExampleDTO): CreateExampleDTO {
    if (example.type !== ExampleTypes.CONSTRUCTION) {
      return example;
    }

    return {
      ...example,
      image:
        this.getPreviewImageUrl() ||
        (example as any).imageUrl ||
        (example as any).image ||
        "",
      imageUrl:
        this.getPreviewImageUrl() ||
        (example as any).imageUrl ||
        (example as any).image ||
        "",
      solutionUrl:
        this.getPreviewSolutionImageUrl() || (example as any).solutionUrl || "",
    } as CreateExampleDTO;
  }

  private translateOrFallback(key: string, fallback: string): string {
    const value = this.translate.instant(key);
    return value && value !== key ? value : fallback;
  }

  getResolvedText(value: string | null | undefined): string {
    return this.previewRenderer.getResolvedText(this.example, value);
  }

  private replaceVariablesOutsideLatex(
    value: string | null | undefined,
  ): string {
    const source = String(value ?? "");
    const mathPattern = /\$\$[\s\S]*?\$\$|\$[^$\n]*?\$/g;
    let cursor = 0;
    let result = "";
    let match: RegExpExecArray | null;

    const replaceVariables = (text: string): string =>
      text.replace(this.variablePattern, (_match, key: string) => {
        const variable = (this.example?.variables ?? []).find(
          (entry) => entry.key === key.trim(),
        );
        return variable?.defaultValue ?? "";
      });

    while ((match = mathPattern.exec(source)) !== null) {
      result += replaceVariables(source.slice(cursor, match.index));
      result += match[0];
      cursor = match.index + match[0].length;
    }

    result += replaceVariables(source.slice(cursor));
    return result;
  }

  renderMathText(value: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      this.previewRenderer.renderMathHtml(value, this.example?.variables),
    );
  }

  renderQuestionWithGapLabels(): SafeHtml {
    if (!this.example) {
      return this.sanitizer.bypassSecurityTrustHtml("");
    }

    return this.sanitizer.bypassSecurityTrustHtml(
      this.previewRenderer.buildQuestionHtml(this.example, {
        getLetter: (index) => this.getLetter(index),
      }),
    );
  }

  private renderMathHtml(value: string | null | undefined): string {
    const source = String(value ?? "");
    const mathTokens: string[] = [];
    const mathPattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

    const textWithMathTokens = source.replace(
      mathPattern,
      (_fullMatch, displayFormula, inlineFormula) => {
        const isDisplay = displayFormula !== undefined;
        const formula = isDisplay ? displayFormula : inlineFormula;
        const token = `@@MATH_TOKEN_${mathTokens.length}@@`;
        mathTokens.push(this.renderFormula(formula, isDisplay));
        return token;
      },
    );

    let html = this.renderMarkdownHtml(textWithMathTokens);
    mathTokens.forEach((formulaHtml, index) => {
      html = html.replace(
        new RegExp(`@@MATH_TOKEN_${index}@@`, "g"),
        formulaHtml,
      );
    });

    return html;
  }

  private renderMarkdownHtml(
    value: string | number | null | undefined,
  ): string {
    const source = String(value ?? "").replace(/\r\n?/g, "\n");
    if (!source.trim()) {
      return "";
    }

    const lines = source.split("\n");
    const blocks: string[] = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
        blocks.push("<p><br></p>");
        index += 1;
        continue;
      }

      if (/^\s*```/.test(line)) {
        const codeLines: string[] = [];
        index += 1;
        while (index < lines.length && !/^\s*```/.test(lines[index])) {
          codeLines.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) {
          index += 1;
        }
        blocks.push(
          `<pre><code>${this.escapeHtml(codeLines.join("\n"))}</code></pre>`,
        );
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        const quoteLines: string[] = [];
        while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
          quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
          index += 1;
        }
        blocks.push(
          `<blockquote>${quoteLines.map((item) => this.renderInlineMarkdown(item)).join("<br>")}</blockquote>`,
        );
        continue;
      }

      if (/^\s*[-*+]\s+/.test(line)) {
        const items: string[] = [];
        while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*[-*+]\s+/, ""));
          index += 1;
        }
        blocks.push(
          `<ul>${items.map((item) => `<li>${this.renderInlineMarkdown(item)}</li>`).join("")}</ul>`,
        );
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(line)) {
        const items: string[] = [];
        while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*\d+[.)]\s+/, ""));
          index += 1;
        }
        blocks.push(
          `<ol>${items.map((item) => `<li>${this.renderInlineMarkdown(item)}</li>`).join("")}</ol>`,
        );
        continue;
      }

      const paragraphLines: string[] = [];
      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^\s*```/.test(lines[index]) &&
        !/^\s*>\s?/.test(lines[index]) &&
        !/^\s*[-*+]\s+/.test(lines[index]) &&
        !/^\s*\d+[.)]\s+/.test(lines[index])
        ) {
        paragraphLines.push(lines[index]);
        index += 1;
      }
      blocks.push(
        `<p>${paragraphLines.map((item) => this.renderInlineMarkdown(item)).join("<br>")}</p>`,
      );
    }

    return blocks.join("");
  }

  private renderInlineMarkdown(
    value: string | number | null | undefined,
  ): string {
    return this.escapeHtml(value)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  }

  private renderFormula(formula: string, displayMode: boolean): string {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode,
        output: "mathml",
        throwOnError: false,
        strict: "ignore",
      });
    } catch {
      return this.escapeHtml(displayMode ? `$$${formula}$$` : `$${formula}$`);
    }
  }

  private escapeHtml(value: string | number | null | undefined): string {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private buildGapQuestionHtml(): string {
    const example = this.example;
    if (!example) {
      return "";
    }

    let gapIndex = 0;

    return this.renderTextWithGapPlaceholders(example.question || "", () => {
      const gap = (example.gaps ?? [])[gapIndex];
      const gapNumber = this.escapeHtml(String(gapIndex + 1));
      gapIndex += 1;

      if (example.gapFillType === "INPUT") {
        const width = this.normalizeGapInlineWidth(
          (
            gap as
              | { width?: number | string; solution?: string | null }
              | undefined
          )?.width,
          (gap as { solution?: string | null } | undefined)?.solution,
        );
        return `
          <span class="gap-inline gap-inline-input" style="width:${width}px;">
            <span class="gap-inline-label gap-inline-label-number">${gapNumber}</span>
            <span class="gap-inline-line"></span>
          </span>
        `;
      }

      return `
        <span class="gap-inline gap-inline-select">
          <span class="gap-inline-pill">
            <span class="gap-inline-pill-number">${gapNumber}</span>
          </span>
        </span>
      `;
    });
  }

  private renderTextWithGapPlaceholders(
    value: string,
    gapRenderer: () => string,
  ): string {
    const source = String(value ?? "");
    const gapTokens: string[] = [];
    const gapPattern = /\{\d+\}|\{Lücke \d+\}|_{3,}/g;

    const textWithGapTokens = source.replace(gapPattern, () => {
      const token = `@@GAP_TOKEN_${gapTokens.length}@@`;
      gapTokens.push(gapRenderer());
      return token;
    });

    let html = this.renderMathHtml(this.getResolvedText(textWithGapTokens));
    gapTokens.forEach((gapHtml, index) => {
      html = html.replace(new RegExp(`@@GAP_TOKEN_${index}@@`, "g"), gapHtml);
    });

    return html;
  }

  private normalizeGapInlineWidth(
    value: number | string | null | undefined,
    solution: string | null | undefined,
  ): number {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(90, Math.min(420, Math.round(parsed)));
    }

    const solutionLength = String(solution ?? "").trim().length;
    const estimated = 90 + solutionLength * 9;
    return Math.max(90, Math.min(420, estimated));
  }

  getQuestionWithGapLabels(): string {
    if (!this.example) {
      return "";
    }

    return this.previewRenderer.getQuestionWithGapLabels(
      this.example,
      (index) => this.getLetter(index),
    );
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

  private withNormalizedImageWidths(
    example: CreateExampleDTO,
  ): CreateExampleDTO {
    return {
      ...example,
      imageWidth: this.normalizeImageWidth(example.imageWidth),
      solutionImageWidth: this.normalizeImageWidth(example.solutionImageWidth),
    };
  }

  private normalizeImageWidth(value: number | null | undefined): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return this.previewRenderer.defaultImageWidth;
    }
    return Math.max(80, Math.min(1200, Math.round(parsed)));
  }
}
