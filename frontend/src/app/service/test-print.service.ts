import { Injectable } from '@angular/core';

import { Example, ExampleTypes, Gap, Option } from '../model/Example';
import { CreateTestDTO, GradingLevel, TestExampleDTO } from '../model/Test';
import { Config } from '../config';

export type GradeMode = 'auto' | 'manual';

export type PersistedTestSettings = {
  defaultTaskSpacing?: number;
  taskSpacingMap?: Record<number, number> | Record<string, number>;
  gradingMode?: GradeMode;
  gradingSystemName?: string;
  gradingSchema?: GradingLevel[];
  gradePercentages?: Record<number, number> | Record<string, number>;
  manualGradeMinimums?: Record<number, number> | Record<string, number>;
  schoolName?: string;
  schoolLogoUrl?: string;
  school?: {
    name?: string;
    logoUrl?: string;
  } | null;
};

export type PrintableTest = CreateTestDTO & PersistedTestSettings;

export type TestBranding = {
  schoolName?: string;
  schoolLogoUrl?: string;
  showNameWhenLogoExists?: boolean;
};

export type TestPrintLabels = {
  name: string;
  class: string;
  date: string;
  achievedPoints: string;
  gradeHeader: string;
  gradingKey: string;
  points: string;
  exampleShort: string;
  goodLuck: string;
  untitled: string;
  solutionSuffix: string;
  solutionNote: string;
  noSolution: string;
  gap: string;
  imagePreviewAlt: string;
  previewTitle: string;
  previewSubtitle: string;
  question: string;
};

export type TestPrintOptions = {
  printCopies: number;
  includeSolutionSheet: boolean;
  getGradeRangeLabel: (gradeOrIndex: number) => string;
  getTaskSpacing: (exampleId: number) => number;
  getQuestionWithGapLabels: (example: Example) => string;
  getLetter: (index: number) => string;
  labels: TestPrintLabels;
  branding?: TestBranding;
};

@Injectable({ providedIn: 'root' })
export class TestPrintService {
  private readonly defaultImageWidth = 320;

  buildPreviewHtml(test: PrintableTest, selectedExamples: TestExampleDTO[], options: TestPrintOptions): string {
    return `
      <div class="test-print-root preview-mode">
        ${this.buildSharedStyles()}
        <div class="print-doc preview-doc">
          ${this.buildSingleTestDocument(test, selectedExamples, options)}
        </div>
      </div>
    `;
  }

  printTest(test: PrintableTest, selectedExamples: TestExampleDTO[], options: TestPrintOptions): boolean {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';

    document.body.appendChild(printFrame);

    const frameDocument = printFrame.contentWindow?.document;
    if (!frameDocument || !printFrame.contentWindow) {
      document.body.removeChild(printFrame);
      return false;
    }

    frameDocument.open();
    frameDocument.write(this.buildPrintHtml(test, selectedExamples, options));
    frameDocument.close();

    const cleanup = () => {
      setTimeout(() => {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      }, 500);
    };

    printFrame.onload = () => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      cleanup();
    };

    return true;
  }

  async exportPdf(test: PrintableTest, selectedExamples: TestExampleDTO[], options: TestPrintOptions): Promise<boolean> {
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = (html2pdfModule as any).default ?? html2pdfModule;

      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-100000px';
      wrapper.style.top = '0';
      wrapper.style.width = '210mm';
      wrapper.style.background = '#fff';
      wrapper.innerHTML = this.buildPdfBodyHtml(test, selectedExamples, options);

      document.body.appendChild(wrapper);

      const filename = this.buildFileName(test.name || options.labels.untitled || 'Test', 'pdf', options.includeSolutionSheet);

      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
          },
          jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
          },
          pagebreak: {
            mode: ['css', 'legacy'],
          },
        })
        .from(wrapper)
        .save();

      document.body.removeChild(wrapper);
      return true;
    } catch (error) {
      console.error('PDF export failed', error);
      return false;
    }
  }

  async exportWord(test: PrintableTest, selectedExamples: TestExampleDTO[], options: TestPrintOptions): Promise<boolean> {
    try {
      const docxModule = await import('html-docx-js-typescript');
      const asBlob = (docxModule as any).asBlob;

      const html = this.buildPrintHtml(test, selectedExamples, options);
      const blob = asBlob(html);

      const filename = this.buildFileName(test.name || options.labels.untitled || 'Test', 'docx', options.includeSolutionSheet);
      this.downloadBlob(blob, filename);

      return true;
    } catch (error) {
      console.error('Word export failed', error);
      return false;
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private buildFileName(baseName: string, extension: 'pdf' | 'docx', withSolution: boolean): string {
    const safeName = (baseName || 'Test')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '_');

    return `${safeName}${withSolution ? '_mit_Loesung' : ''}.${extension}`;
  }

  private escapeHtml(value: string | number | null | undefined): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private formatMultiline(value: string | number | null | undefined): string {
    return this.escapeHtml(value).replace(/\n/g, '<br>');
  }

  private buildPdfBodyHtml(test: PrintableTest, selectedExamples: TestExampleDTO[], options: TestPrintOptions): string {
    const studentDocs = this.buildStudentPagesHtml(test, selectedExamples, options);
    const solutionDocs = options.includeSolutionSheet
      ? this.buildSolutionPagesHtml(test, selectedExamples, options)
      : '';

    return `${this.buildSharedStyles()}${studentDocs}${solutionDocs}`;
  }

  private buildPrintHtml(test: PrintableTest, selectedExamples: TestExampleDTO[], options: TestPrintOptions): string {
    const studentDocs = this.buildStudentPagesHtml(test, selectedExamples, options);
    const solutionDocs = options.includeSolutionSheet
      ? this.buildSolutionPagesHtml(test, selectedExamples, options)
      : '';

    return `
      <!doctype html>
      <html lang="de">
        <head>
          <meta charset="utf-8" />
          <title>${this.escapeHtml(test.name || options.labels.untitled || 'Test')}</title>
          ${this.buildSharedStyles()}
        </head>
        <body>
          <div class="test-print-root">
            ${studentDocs}
            ${solutionDocs}
          </div>
        </body>
      </html>
    `;
  }

  private buildSharedStyles(): string {
    return `
      <style>
        @page { size: A4; margin: 10mm; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; }
        .page-break-before { page-break-before: always; break-before: page; }
        .test-print-root { width: 100%; }
        .print-doc {
          width: 100%;
          max-width: 860px;
          margin: 0 auto;
          background: #fff;
          color: #111;
        }
        .preview-mode .print-doc {
          border-radius: 16px;
          border: 1px solid #d7deea;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.10);
          padding: 2rem 2.2rem;
          background: #ffffff;
          color: #111111;
        }
        .brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 14px;
          min-height: 64px;
        }
        .brand-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }
        .brand-logo {
          width: 64px;
          height: 64px;
          object-fit: contain;
          border-radius: 10px;
          border: 1px solid #d8dde6;
          padding: 6px;
          background: #fff;
          flex: 0 0 auto;
        }
        .brand-name {
          font-size: 16px;
          font-weight: 700;
          line-height: 1.2;
        }
        .test-title { text-align: center; font-size: 22px; font-weight: 700; margin: 0 0 14px; }
        .meta-lines { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px; }
        .meta-line { display: flex; align-items: center; gap: 8px; }
        .meta-line span { white-space: nowrap; font-weight: 600; }
        .meta-line .line { border-bottom: 1px solid #222; height: 14px; width: 100%; }
        .header-tables.stacked { display: flex; flex-direction: column; gap: 10px; margin: 10px 0 12px; }
        .result-table { width: 100%; }
        table { border-collapse: separate; border-spacing: 0; width: 100%; }
        .compact-table th, .compact-table td, .answer-table-wrap td, .answer-table-wrap th,
        .assign-preview td, .assign-preview th, .gap-grid td, .gap-grid th {
          border-right: 1px solid #222;
          border-bottom: 1px solid #222;
          padding: 7px 9px;
          vertical-align: top;
        }
        .compact-table tr:first-child th, .compact-table tr:first-child td,
        .answer-table-wrap tr:first-child th, .answer-table-wrap tr:first-child td,
        .assign-preview table tr:first-child th, .assign-preview table tr:first-child td,
        .gap-grid table tr:first-child th, .gap-grid table tr:first-child td {
          border-top: 1px solid #222;
        }
        .compact-table th:first-child, .compact-table td:first-child,
        .answer-table-wrap th:first-child, .answer-table-wrap td:first-child,
        .assign-preview th:first-child, .assign-preview td:first-child,
        .gap-grid th:first-child, .gap-grid td:first-child {
          border-left: 1px solid #222;
        }
        .grading-title { margin: 0 0 6px; font-weight: 700; }
        .teacher-note { margin: 14px 0 10px; white-space: pre-line; text-align: center; line-height: 1.5; }
        .good-luck { text-align: center; margin: 0 0 8px; font-size: 15px; }
        .header-divider { border: none; border-top: 1px solid #222; margin: 10px 0 16px; }
        .task { page-break-inside: avoid; break-inside: avoid; }
        .task-head { display: flex; justify-content: space-between; gap: 12px; font-weight: 700; margin-bottom: 8px; font-size: 14px; }
        .task-points { white-space: nowrap; }
        .preview-panel { line-height: 1.4; }
        .task-instruction, .task-question { margin: 0 0 10px; white-space: pre-line; }
        .task-question.rich-gap-question { white-space: normal; }
        .gap-inline {
          display: inline-flex;
          vertical-align: middle;
          align-items: center;
          justify-content: center;
          margin: 0 0.2rem;
        }
        .gap-inline-select {
          min-width: 3.1rem;
        }
        .gap-inline-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2.8rem;
          min-height: 2.2rem;
          padding: 0.28rem 0.85rem;
          border-radius: 999px;
          border: 1px solid #94a3b8;
          background: #e2e8f0;
          color: #0f172a;
          font-weight: 700;
          line-height: 1;
        }
        .gap-inline-pill-number {
          font-size: 0.95rem;
        }
        .gap-inline-input {
          position: relative;
          min-height: 2rem;
          justify-content: flex-start;
          padding-left: 1.6rem;
          border-bottom: 2px solid #64748b;
        }
        .gap-inline-label {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          color: #475569;
          font-size: 0.78rem;
          font-weight: 700;
          line-height: 1;
        }
        .gap-inline-line {
          display: inline-block;
          width: 100%;
          height: 1px;
        }
        .gap-inline-solution {
          display: inline-block;
          width: 100%;
          padding-right: 0.3rem;
          font-weight: 600;
          line-height: 1.2;
        }
        .student-list > div, .solution-list > div { margin-bottom: 8px; }
        .solution-box { border: 1px solid #222; padding: 10px; min-height: 48px; white-space: pre-line; }
        .muted { color: #777; }
        .construction-preview { margin-top: 8px; }
        .image-preview { max-width: 100%; max-height: none; display: block; margin-bottom: 10px; object-fit: contain; }
        .construction-preview { overflow: visible; }
        .construction-space { min-height: 180px; border: 1px dashed #b6bcc7; }
        .answer-table-wrap, .assign-preview, .gap-grid { margin-top: 8px; }
        .checkbox-cell, .small, .letter-cell { width: 42px; text-align: center; }
        .gap-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
        .assign-preview { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .fill { width: 56px; }
        .solution-header { margin-bottom: 16px; }
        .solution-note { margin: 0 0 10px; color: #555; }
        .free-space { width: 100%; }
        .free-space.medium { min-height: 90px; }
        .free-space.large { min-height: 150px; }
      </style>
    `;
  }

  private buildStudentPagesHtml(test: PrintableTest, selectedExamples: TestExampleDTO[], options: TestPrintOptions): string {
    const copies = Math.max(1, Math.round(Number(options.printCopies || 1)));

    return Array.from({ length: copies }, (_, index) => `
      <section class="print-doc copy-doc ${index > 0 ? 'page-break-before' : ''}">
        ${this.buildSingleTestDocument(test, selectedExamples, options)}
      </section>
    `).join('');
  }

  private buildSingleTestDocument(test: PrintableTest, selectedExamples: TestExampleDTO[], options: TestPrintOptions): string {
    const tasks = selectedExamples
      .map((entry, i) => this.buildTaskHtml(entry, i, false, options))
      .join('');

    const labels = options.labels;
    const gradeLevels = this.getGradeLevels(test, options);
    const branding = this.resolveBranding(test, options.branding);

    return `
      <div class="test-header">
        ${this.buildBrandingHtml(branding)}
        <h2 class="test-title">${this.escapeHtml(test.name || labels.untitled)}</h2>

        <div class="meta-lines">
          <div class="meta-line"><span>${this.escapeHtml(labels.name)}:</span><div class="line"></div></div>
          <div class="meta-line"><span>${this.escapeHtml(labels.class)}:</span><div class="line"></div></div>
          <div class="meta-line"><span>${this.escapeHtml(labels.date)}:</span><div class="line"></div></div>
        </div>

        <div class="header-tables stacked">
          <table class="result-table compact-table">
            <tr><th>${this.escapeHtml(labels.achievedPoints)}</th><th>${this.escapeHtml(labels.gradeHeader)}</th></tr>
            <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
          </table>

          <div class="grading-box">
            <p class="grading-title">${this.escapeHtml(labels.gradingKey)}</p>
            <table class="grading-table compact-table">
              <tr>
                <td>${this.escapeHtml(labels.points)}</td>
                ${gradeLevels.map((_, index) => `<td>${this.escapeHtml(options.getGradeRangeLabel(index + 1))}</td>`).join('')}
              </tr>
              <tr>
                <td>${this.escapeHtml(labels.gradeHeader)}</td>
                ${gradeLevels.map(level => `<td>${this.escapeHtml(level.shortLabel || level.label || '')}</td>`).join('')}
              </tr>
            </table>
          </div>
        </div>

        ${test.note ? `<p class="teacher-note">${this.formatMultiline(test.note)}</p>` : ''}
        <h3 class="good-luck">${this.escapeHtml(labels.goodLuck)}</h3>
        <hr class="header-divider" />
      </div>

      ${tasks}
    `;
  }

  private buildBrandingHtml(branding: TestBranding): string {
    const showLogo = !!branding.schoolLogoUrl;
    const showName = !!branding.schoolName && (!showLogo || branding.showNameWhenLogoExists !== false);

    if (!showLogo && !showName) {
      return '';
    }

    return `
      <div class="brand-row">
        <div class="brand-left">
          ${showLogo ? `<img src="${this.escapeHtml(branding.schoolLogoUrl)}" alt="School logo" class="brand-logo" style="background: transparent !important;"/>` : ''}
          ${showName ? `<div class="brand-name">${this.escapeHtml(branding.schoolName)}</div>` : ''}
        </div>
      </div>
    `;
  }

  private buildSolutionPagesHtml(test: PrintableTest, selectedExamples: TestExampleDTO[], options: TestPrintOptions): string {
    const labels = options.labels;
    const tasks = selectedExamples
      .map((entry, i) => this.buildTaskHtml(entry, i, true, options))
      .join('');

    return `
      <section class="print-doc solution-doc page-break-before">
        <div class="test-header solution-header">
          <h2 class="test-title">${this.escapeHtml(test.name || labels.untitled)} ${this.escapeHtml(labels.solutionSuffix)}</h2>
          <p class="solution-note">${this.escapeHtml(labels.solutionNote)}</p>
          <hr class="header-divider" />
        </div>
        ${tasks}
      </section>
    `;
  }

  private buildTaskHtml(entry: TestExampleDTO, index: number, isSolution: boolean, options: TestPrintOptions): string {
    const exampleId = entry.example?.id ?? -1;
    const margin = options.getTaskSpacing(exampleId);
    const exampleLabel = options.labels.exampleShort;

    const schoolQuestion = options.labels.question;

    const header = `
      <div class="task-head">
        <div class="task-title">${this.escapeHtml(exampleLabel)} ${index + 1}${entry.title ? ': ' + this.escapeHtml(entry.title) : ''}</div>
        <div class="task-points">(${isSolution ? this.escapeHtml(entry.points || '__') : '__'} / ${this.escapeHtml(entry.points || '__')} P.)</div>
      </div>
    `;

    const instruction = entry.example.instruction
      ? `<p class="task-instruction">${this.formatMultiline(entry.example.instruction)}</p>`
      : '';

    const question = entry.example.type === ExampleTypes.GAP_FILL
      ? `<div class="task-question rich-gap-question">${isSolution && entry.example.gapFillType === 'INPUT' ? this.buildGapQuestionSolutionHtml(entry.example) : this.buildGapQuestionHtml(entry.example)}</div>`
      : `<p class="task-question">${this.formatMultiline(options.getQuestionWithGapLabels(entry.example))}</p>`;

    return `
      <div class="task print-task" style="margin-bottom:${margin}px;">
        ${header}
        <div class="preview-panel">
          ${instruction}
          <p><strong>${schoolQuestion}:</strong></p>
          ${question}
          ${this.buildTaskBodyHtml(entry.example, isSolution, options)}
        </div>
      </div>
    `;
  }

  private buildGapQuestionHtml(example: Example): string {
    const escapedQuestion = this.escapeHtml(example.question || '');
    let gapIndex = 0;

    return escapedQuestion
      .replace(/\n/g, '<br>')
      .replace(/\{\d+\}/g, () => {
        const gap = (example.gaps ?? [])[gapIndex];
        const gapNumber = this.escapeHtml(String(gapIndex + 1));
        gapIndex += 1;

        if (example.gapFillType === 'INPUT') {
          const width = this.normalizeGapInlineWidth((gap as any)?.width, (gap as any)?.solution);
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

  private buildGapQuestionSolutionHtml(example: Example): string {
    const escapedQuestion = this.escapeHtml(example.question || '');
    let gapIndex = 0;

    return escapedQuestion
      .replace(/\n/g, '<br>')
      .replace(/\{\d+\}/g, () => {
        const gap = (example.gaps ?? [])[gapIndex];
        const gapNumber = this.escapeHtml(String(gapIndex + 1));
        gapIndex += 1;

        if (example.gapFillType === 'INPUT') {
          const solution = this.escapeHtml(String((gap as any)?.solution ?? ''));
          const width = this.normalizeGapInlineWidth((gap as any)?.width, (gap as any)?.solution);
          return `
            <span class="gap-inline gap-inline-input" style="width:${width}px;">
              <span class="gap-inline-label gap-inline-label-number">${gapNumber}</span>
              <span class="gap-inline-solution">${solution || '&nbsp;'}</span>
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

  private normalizeGapInlineWidth(value: number | string | null | undefined, solution: string | null | undefined): number {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(90, Math.min(420, Math.round(parsed)));
    }

    const solutionLength = String(solution ?? '').trim().length;
    const estimated = 90 + solutionLength * 9;
    return Math.max(90, Math.min(420, estimated));
  }

  private buildTaskBodyHtml(example: Example, isSolution: boolean, options: TestPrintOptions): string {
    const labels = options.labels;

    switch (example.type) {
      case ExampleTypes.OPEN:
        return isSolution
          ? `<div class="solution-box">${this.formatMultiline((example as any).solution || '') || `<span class="muted">${this.escapeHtml(labels.noSolution)}</span>`}</div>`
          : `<div class="free-space large"></div>`;

      case ExampleTypes.HALF_OPEN:
        return isSolution
          ? `<div class="solution-list">${(example.answers ?? []).map(ans => `<div><strong>${this.escapeHtml(ans?.[0] ?? '')}</strong> = ${this.escapeHtml(ans?.[1] ?? '')}</div>`).join('')}</div>`
          : `
              <div class="solution-list student-list">
                ${(example.answers ?? []).map(ans => `<div>${this.escapeHtml(ans?.[0] ?? '')} = _________________________________</div>`).join('')}
              </div>
              <div class="free-space medium"></div>
            `;

      case ExampleTypes.CONSTRUCTION: {
        const image = isSolution
          ? this.getConstructionSolutionImage(example)
          : this.getConstructionTaskImage(example);

        const width = isSolution
          ? this.normalizeImageWidth((example as any).solutionImageWidth)
          : this.normalizeImageWidth((example as any).imageWidth);

        return `
          <div class="construction-preview">
            ${image ? `<img src="${this.escapeHtml(image)}" alt="${this.escapeHtml(labels.imagePreviewAlt)}" class="image-preview" style="width:${width}px;max-width:${width}px;height:auto;" />` : ''}
          </div>
        `;
      }

      case ExampleTypes.MULTIPLE_CHOICE:
        return `
          <div class="answer-table-wrap">
            <table>
              ${(example.options ?? []).map((opt: Option) => `
                <tr>
                  <td>${this.escapeHtml(opt.text)}</td>
                  <td class="small checkbox-cell">${isSolution && opt.correct ? '☒' : '☐'}</td>
                </tr>
              `).join('')}
            </table>
          </div>
        `;

      case ExampleTypes.GAP_FILL:
        if (example.gapFillType === 'SELECT') {
          return `
            <div class="gap-grid">
              ${(example.gaps ?? []).map((gap: Gap) => `
                <table>
                  <tr><th>${this.escapeHtml(gap.label || labels.gap)}</th></tr>
                  ${(gap.options ?? []).map((opt: Option) => `
                    <tr>
                      <td>${this.escapeHtml(opt.text)}</td>
                      <td class="small checkbox-cell">${isSolution && opt.correct ? '☒' : '☐'}</td>
                    </tr>
                  `).join('')}
                </table>
              `).join('')}
            </div>
          `;
        }

        return isSolution
          ? ''
          : `<div class="free-space medium"></div>`;

      case ExampleTypes.ASSIGN:
        return isSolution
          ? `
            <div class="solution-list">
              ${(example.assigns ?? []).map(assign => `<div>${this.escapeHtml(assign.left)} → ${this.escapeHtml(assign.right)}</div>`).join('')}
            </div>
          `
          : `
            <div class="assign-preview">
              <table class="leftSide">
                ${(example.assigns ?? []).map(assign => `
                  <tr>
                    <td>${this.escapeHtml(assign.left)}</td>
                    <td class="fill"></td>
                  </tr>
                `).join('')}
              </table>
              <table class="rightSide">
                ${(example.assignRightItems ?? []).map((right: string, j: number) => `
                  <tr>
                    <td class="fill letter-cell">${this.escapeHtml(options.getLetter(j))}</td>
                    <td>${this.escapeHtml(right)}</td>
                  </tr>
                `).join('')}
              </table>
            </div>
          `;

      default:
        return '';
    }
  }

  private getGradeLevels(test: PrintableTest, options: TestPrintOptions): GradingLevel[] {
    if (Array.isArray(test.gradingSchema) && test.gradingSchema.length) {
      return test.gradingSchema;
    }

    const legacyGradeLabels = ['1', '2', '3', '4', '5'];
    return legacyGradeLabels.map((label, index) => ({
      key: label,
      label,
      shortLabel: label,
      order: index,
      percentageFrom: 0,
      minimumPoints: 0,
    }));
  }

  private resolveBranding(test: PrintableTest, branding?: TestBranding): TestBranding {
    const schoolLogoUrl = branding?.schoolLogoUrl
      || test.schoolLogoUrl
      || test.school?.logoUrl
      || (test.school as any)?.logo
      || undefined;

    const schoolName = branding?.schoolName
      || test.schoolName
      || test.school?.name
      || undefined;

    return {
      schoolLogoUrl,
      schoolName,
      showNameWhenLogoExists: branding?.showNameWhenLogoExists ?? true,
    };
  }

  private getConstructionTaskImage(example: Example): string | null {
    if (!example?.id) {
      return (example as any).imageUrl || (example as any).image || null;
    }

    if ((example as any).imageUrl || (example as any).image) {
      return `${Config.API_URL}/example/${example.id}/construction-image`;
    }

    return null;
  }

  private getConstructionSolutionImage(example: Example): string | null {
    if (!example?.id) {
      return (example as any).solutionUrl || null;
    }

    if ((example as any).solutionUrl) {
      return `${Config.API_URL}/example/${example.id}/construction-solution-image`;
    }

    return this.getConstructionTaskImage(example);
  }

  private normalizeImageWidth(value: number | null | undefined): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return this.defaultImageWidth;
    }
    return Math.max(80, Math.min(1200, Math.round(parsed)));
  }
}
