import { Injectable } from '@angular/core';

import { Example, ExampleTypes, Gap, Option } from '../model/Example';
import { CreateTestDTO, TestExampleDTO } from '../model/Test';
import { Config } from '../config';

export type GradeMode = 'auto' | 'manual';

export type PersistedTestSettings = {
  defaultTaskSpacing?: number;
  taskSpacingMap?: Record<number, number> | Record<string, number>;
  gradingMode?: GradeMode;
  gradePercentages?: Record<number, number> | Record<string, number>;
  manualGradeMinimums?: Record<number, number> | Record<string, number>;
};

export type PrintableTest = CreateTestDTO & PersistedTestSettings;

export type TestPrintOptions = {
  printCopies: number;
  includeSolutionSheet: boolean;
  getGradeRangeLabel: (grade: number) => string;
  getTaskSpacing: (exampleId: number) => number;
  getQuestionWithGapLabels: (example: Example) => string;
  getLetter: (index: number) => string;
};

@Injectable({ providedIn: 'root' })
export class TestPrintService {
  private readonly defaultImageWidth = 320;

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

      const filename = this.buildFileName(test.name || 'Test', 'pdf', options.includeSolutionSheet);

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

      const filename = this.buildFileName(test.name || 'Test', 'docx', options.includeSolutionSheet);
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

    return `
      <style>
        @page { size: A4; margin: 12mm; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #fff; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; }
        .page-break-before { page-break-before: always; break-before: page; }
        .print-doc { width: 100%; }
        .test-title { text-align: center; font-size: 22px; font-weight: 700; margin: 0 0 14px; }
        .meta-lines { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px; }
        .meta-line { display: flex; align-items: center; gap: 8px; }
        .meta-line span { white-space: nowrap; font-weight: 600; }
        .meta-line .line { border-bottom: 1px solid #222; height: 14px; width: 100%; }
        .header-tables.stacked { display: flex; flex-direction: column; gap: 10px; margin: 10px 0 12px; }
        .result-table { width: 220px; }
        table { border-collapse: collapse; width: 100%; }
        .compact-table th, .compact-table td, .answer-table-wrap td, .answer-table-wrap th,
        .assign-preview td, .assign-preview th, .gap-grid td, .gap-grid th {
          border: 1px solid #222;
          padding: 6px 8px;
          vertical-align: top;
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
        .student-list > div, .solution-list > div { margin-bottom: 8px; }
        .solution-box { border: 1px solid #222; padding: 10px; min-height: 48px; white-space: pre-line; }
        .muted { color: #777; }
        .construction-preview { margin-top: 8px; }
        .image-preview { max-width: 100%; max-height: 220px; display: block; margin-bottom: 10px; object-fit: contain; }
        .construction-space { min-height: 180px; border: 1px dashed #b6bcc7; }
        .answer-table-wrap, .assign-preview, .gap-grid { margin-top: 8px; }
        .checkbox-cell, .small, .letter-cell { width: 42px; text-align: center; }
        .gap-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
        .assign-preview { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .fill { width: 48px; }
        .solution-header { margin-bottom: 16px; }
        .solution-note { margin: 0 0 10px; color: #555; }
        .free-space { width: 100%; }
        .free-space.medium { min-height: 90px; }
        .free-space.large { min-height: 150px; }
      </style>

      ${studentDocs}
      ${solutionDocs}
    `;
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
          <title>${this.escapeHtml(test.name || 'Test')}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; }
            body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; }
            .page-break-before { page-break-before: always; break-before: page; }
            .print-doc { width: 100%; }
            .test-title { text-align: center; font-size: 22px; font-weight: 700; margin: 0 0 14px; }
            .meta-lines { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px; }
            .meta-line { display: flex; align-items: center; gap: 8px; }
            .meta-line span { white-space: nowrap; font-weight: 600; }
            .meta-line .line { border-bottom: 1px solid #222; height: 14px; width: 100%; }
            .header-tables.stacked { display: flex; flex-direction: column; gap: 10px; margin: 10px 0 12px; }
            .result-table { width: 220px; }
            table { border-collapse: collapse; width: 100%; }
            .compact-table th, .compact-table td, .answer-table-wrap td, .answer-table-wrap th, .assign-preview td, .assign-preview th, .gap-grid td, .gap-grid th { border: 1px solid #222; padding: 6px 8px; vertical-align: top; }
            .grading-title { margin: 0 0 6px; font-weight: 700; }
            .teacher-note { margin: 14px 0 10px; white-space: pre-line; text-align: center; line-height: 1.5; }
            .good-luck { text-align: center; margin: 0 0 8px; font-size: 15px; }
            .header-divider { border: none; border-top: 1px solid #222; margin: 10px 0 16px; }
            .task { page-break-inside: avoid; break-inside: avoid; }
            .task-head { display: flex; justify-content: space-between; gap: 12px; font-weight: 700; margin-bottom: 8px; font-size: 14px; }
            .task-points { white-space: nowrap; }
            .preview-panel { line-height: 1.4; }
            .task-instruction, .task-question { margin: 0 0 10px; white-space: pre-line; }
            .student-list > div, .solution-list > div { margin-bottom: 8px; }
            .solution-box { border: 1px solid #222; padding: 10px; min-height: 48px; white-space: pre-line; }
            .muted { color: #777; }
            .construction-preview { margin-top: 8px; }
            .image-preview { max-width: 100%; max-height: 220px; display: block; margin-bottom: 10px; object-fit: contain; }
            .construction-space { min-height: 180px; border: 1px dashed #b6bcc7; }
            .answer-table-wrap, .assign-preview, .gap-grid { margin-top: 8px; }
            .checkbox-cell, .small, .letter-cell { width: 42px; text-align: center; }
            .gap-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
            .assign-preview { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .fill { width: 48px; }
            .solution-header { margin-bottom: 16px; }
            .solution-note { margin: 0 0 10px; color: #555; }
            .free-space { width: 100%; }
            .free-space.medium { min-height: 90px; }
            .free-space.large { min-height: 150px; }
          </style>
        </head>
        <body>
          ${studentDocs}
          ${solutionDocs}
        </body>
      </html>
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

    return `
      <div class="test-header">
        <h2 class="test-title">${this.escapeHtml(test.name || 'Unbenannter Test')}</h2>

        <div class="meta-lines">
          <div class="meta-line"><span>Name:</span><div class="line"></div></div>
          <div class="meta-line"><span>Klasse:</span><div class="line"></div></div>
          <div class="meta-line"><span>Datum:</span><div class="line"></div></div>
        </div>

        <div class="header-tables stacked">
          <table class="result-table compact-table">
            <tr><th>Erreichte Punkte</th><th>Note</th></tr>
            <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
          </table>

          <div class="grading-box">
            <p class="grading-title">Notenschlüssel</p>
            <table class="grading-table compact-table">
              <tr>
                <td>Punkte</td>
                <td>${this.escapeHtml(options.getGradeRangeLabel(1))}</td>
                <td>${this.escapeHtml(options.getGradeRangeLabel(2))}</td>
                <td>${this.escapeHtml(options.getGradeRangeLabel(3))}</td>
                <td>${this.escapeHtml(options.getGradeRangeLabel(4))}</td>
                <td>${this.escapeHtml(options.getGradeRangeLabel(5))}</td>
              </tr>
              <tr><td>Note</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>
            </table>
          </div>
        </div>

        ${test.note ? `<p class="teacher-note">${this.formatMultiline(test.note)}</p>` : ''}
        <h3 class="good-luck">Viel Erfolg!</h3>
        <hr class="header-divider" />
      </div>

      ${tasks}
    `;
  }

  private buildSolutionPagesHtml(test: PrintableTest, selectedExamples: TestExampleDTO[], options: TestPrintOptions): string {
    const tasks = selectedExamples
      .map((entry, i) => this.buildTaskHtml(entry, i, true, options))
      .join('');

    return `
      <section class="print-doc solution-doc page-break-before">
        <div class="test-header solution-header">
          <h2 class="test-title">${this.escapeHtml(test.name || 'Unbenannter Test')} – Lösung</h2>
          <p class="solution-note">Diese Seiten enthalten die Musterlösungen.</p>
          <hr class="header-divider" />
        </div>
        ${tasks}
      </section>
    `;
  }

  private buildTaskHtml(entry: TestExampleDTO, index: number, isSolution: boolean, options: TestPrintOptions): string {
    const exampleId = entry.example?.id ?? -1;
    const margin = options.getTaskSpacing(exampleId);

    const header = `
      <div class="task-head">
        <div class="task-title">Bsp. ${index + 1}${entry.title ? ': ' + this.escapeHtml(entry.title) : ''}</div>
        <div class="task-points">(${isSolution ? this.escapeHtml(entry.points || '__') : '__'} / ${this.escapeHtml(entry.points || '__')} P.)</div>
      </div>
    `;

    const instruction = entry.example.instruction
      ? `<p class="task-instruction">${this.formatMultiline(entry.example.instruction)}</p>`
      : '';

    const question = `<p class="task-question">${this.formatMultiline(options.getQuestionWithGapLabels(entry.example))}</p>`;

    return `
      <div class="task print-task" style="margin-bottom:${margin}px;">
        ${header}
        <div class="preview-panel">
          ${instruction}
          ${question}
          ${this.buildTaskBodyHtml(entry.example, isSolution, options)}
        </div>
      </div>
    `;
  }

  private buildTaskBodyHtml(example: Example, isSolution: boolean, options: TestPrintOptions): string {
    switch (example.type) {
      case ExampleTypes.OPEN:
        return isSolution
          ? `<div class="solution-box">${this.formatMultiline((example as any).solution || '') || '<span class="muted">Keine Lösung hinterlegt.</span>'}</div>`
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

        const width = this.normalizeImageWidth((example as any).imageWidth);

        return `
          <div class="construction-preview">
            ${image ? `<img src="${this.escapeHtml(image)}" alt="Vorschau" class="image-preview" style="width:${width}px;" />` : ''}
            ${isSolution ? '' : '<div class="construction-space"></div>'}
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
                  <tr><th>${this.escapeHtml(gap.label || 'Lücke')}</th></tr>
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
          ? `<div class="solution-list">${(example.gaps ?? []).map(gap => `<div><strong>${this.escapeHtml(gap.label || 'Lücke')}</strong>: ${this.escapeHtml((gap as any).solution || '')}</div>`).join('')}</div>`
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
