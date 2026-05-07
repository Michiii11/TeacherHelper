import { Injectable, inject } from '@angular/core';
import * as katex from 'katex';

import { Example, ExampleTypes, Gap, Option } from '../model/Example';
import { CreateTestDTO, GradingLevel, TestExampleDTO } from '../model/Test';
import { ExamplePreviewRendererService } from './example-preview-renderer.service';

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
  instruction?: string;
  taskImage?: string;
};

export type TestPrintOptions = {
  printCopies: number;
  includeSolutionSheet: boolean;
  getGradeRangeLabel: (gradeOrIndex: number) => string;
  getTaskSpacing: (exampleId: string) => number;
  getQuestionWithGapLabels: (example: Example) => string;
  getLetter: (index: number) => string;
  labels: TestPrintLabels;
  branding?: TestBranding;
};

@Injectable({ providedIn: 'root' })
export class TestPrintService {
  private readonly previewRenderer = inject(ExamplePreviewRendererService);
  private readonly defaultImageWidth = 320;
  private readonly variablePattern = /\{([a-zA-Z_][a-zA-Z0-9_-]*)\}/g;

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

    printFrame.onload = async () => {
      await this.waitForImages(frameDocument);
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


  private async waitForImages(doc: Document): Promise<void> {
    const images = Array.from(doc.images ?? []);

    if (!images.length) {
      return;
    }

    await Promise.all(images.map(image => {
      if (image.complete) {
        return Promise.resolve();
      }

      return new Promise<void>(resolve => {
        image.onload = () => resolve();
        image.onerror = () => resolve();
      });
    }));
  }

  private escapeHtml(value: string | number | null | undefined): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Applies a replacement only outside LaTeX segments.
   * Important: LaTeX uses braces as syntax, e.g. $\frac{a}{b}$.
   * Those braces must never be treated as task variables or gap placeholders.
   */
  private replaceOutsideLatex(value: string, replacer: (text: string) => string): string {
    const source = String(value ?? '');
    const mathPattern = /\$\$[\s\S]*?\$\$|\$[^$\n]*?\$/g;
    let cursor = 0;
    let result = '';
    let match: RegExpExecArray | null;

    while ((match = mathPattern.exec(source)) !== null) {
      result += replacer(source.slice(cursor, match.index));
      result += match[0];
      cursor = match.index + match[0].length;
    }

    result += replacer(source.slice(cursor));
    return result;
  }

  private formatMultiline(
    value: string | number | null | undefined,
    variables?: { key?: string; defaultValue?: string | number | null }[] | null
  ): string {
    return this.previewRenderer.renderMathHtml(value, variables);
  }

  /**
   * 1:1 wie ExamplePreviewComponent:
   * - zuerst LaTeX durch Tokens ersetzen
   * - dann normalen Text/Markdown rendern
   * - danach KaTeX-HTML wieder einsetzen
   */
  private renderMathHtml(value: string | null | undefined): string {
    const source = String(value ?? '');
    const mathTokens: string[] = [];
    const mathPattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

    const textWithMathTokens = source.replace(mathPattern, (_fullMatch, displayFormula, inlineFormula) => {
      const isDisplay = displayFormula !== undefined;
      const formula = isDisplay ? displayFormula : inlineFormula;
      const token = `@@MATH_TOKEN_${mathTokens.length}@@`;
      mathTokens.push(this.renderFormula(formula, isDisplay));
      return token;
    });

    let html = this.renderMarkdownHtml(textWithMathTokens);
    mathTokens.forEach((formulaHtml, index) => {
      html = html.replace(new RegExp(`@@MATH_TOKEN_${index}@@`, 'g'), formulaHtml);
    });

    return html;
  }

  private replaceVariables(
    value: string | number | null | undefined,
    variables?: { key?: string; defaultValue?: string | number | null; value?: string | number | null }[] | null
  ): string {
    const variableMap = new Map<string, string>();

    for (const variable of variables ?? []) {
      const key = String(variable?.key ?? '').trim();
      if (!key) {
        continue;
      }

      const rawValue = variable.defaultValue ?? variable.value;
      if (rawValue === undefined || rawValue === null) {
        continue;
      }

      variableMap.set(key, String(rawValue));
    }

    return String(value ?? '').replace(this.variablePattern, (match, key: string) => {
      const normalizedKey = key.trim();
      return variableMap.has(normalizedKey) ? variableMap.get(normalizedKey)! : match;
    });
  }

  private replaceVariablesOutsideLatex(
    value: string | number | null | undefined,
    variables?: { key?: string; defaultValue?: string | number | null }[] | null
  ): string {
    return this.replaceOutsideLatex(String(value ?? ''), (text) => this.replaceVariables(text, variables));
  }

  private renderMarkdownHtml(value: string | number | null | undefined): string {
    const source = String(value ?? '').replace(/\r\n?/g, '\n');
    if (!source.trim()) {
      return '';
    }

    const lines = source.split('\n');
    const blocks: string[] = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
        blocks.push('<p><br></p>');
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
        blocks.push(`<pre><code>${this.escapeHtml(codeLines.join('\n'))}</code></pre>`);
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        const quoteLines: string[] = [];
        while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
          quoteLines.push(lines[index].replace(/^\s*>\s?/, ''));
          index += 1;
        }
        blocks.push(`<blockquote>${quoteLines.map(item => this.renderInlineMarkdown(item)).join('<br>')}</blockquote>`);
        continue;
      }

      if (/^\s*[-*+]\s+/.test(line)) {
        const items: string[] = [];
        while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*[-*+]\s+/, ''));
          index += 1;
        }
        blocks.push(`<ul>${items.map(item => `<li>${this.renderInlineMarkdown(item)}</li>`).join('')}</ul>`);
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(line)) {
        const items: string[] = [];
        while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*\d+[.)]\s+/, ''));
          index += 1;
        }
        blocks.push(`<ol>${items.map(item => `<li>${this.renderInlineMarkdown(item)}</li>`).join('')}</ol>`);
        continue;
      }

      const paragraphLines: string[] = [];
      while (
        index < lines.length
        && lines[index].trim()
        && !/^\s*```/.test(lines[index])
        && !/^\s*>\s?/.test(lines[index])
        && !/^\s*[-*+]\s+/.test(lines[index])
        && !/^\s*\d+[.)]\s+/.test(lines[index])
        ) {
        paragraphLines.push(lines[index]);
        index += 1;
      }
      blocks.push(`<p>${paragraphLines.map(item => this.renderInlineMarkdown(item)).join('<br>')}</p>`);
    }

    return blocks.join('');
  }

  private renderInlineMarkdown(value: string | number | null | undefined): string {
    return this.escapeHtml(value)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  }

  private renderFormula(formula: string, displayMode: boolean): string {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode,
        output: 'mathml',
        throwOnError: false,
        strict: 'ignore',
      });
    } catch {
      return this.escapeHtml(displayMode ? `$$${formula}$$` : `$${formula}$`);
    }
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
          justify-content: center;
          gap: 18px;
          margin: 0 0 16px;
          min-height: 64px;
          width: 100%;
        }
        .brand-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          width: 100%;
          text-align: center;
        }
        .brand-logo {
          width: 40px;
          height: 40px;
          object-fit: contain;
          border-radius: 14px;
          flex: 0 0 auto;
        }
        .brand-name {
          font-size: 17px;
          font-weight: 800;
          line-height: 1.2;
          color: #111;
          overflow-wrap: anywhere;
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
        .teacher-note { margin: 14px 0 10px; white-space: normal; text-align: center; line-height: 1.5; }
        .good-luck { text-align: center; margin: 0 0 8px; font-size: 15px; }
        .header-divider { border: none; border-top: 1px solid #222; margin: 10px 0 16px; }
        .task { page-break-inside: avoid; break-inside: avoid; }
        .task-head { display: flex; justify-content: space-between; gap: 12px; font-weight: 700; margin-bottom: 8px; font-size: 14px; }
        .task-points { white-space: nowrap; }
        .preview-panel { line-height: 1.4; overflow-wrap: normal; word-break: normal; }
        .task-instruction, .task-question { margin: 0 0 10px; white-space: normal; overflow-wrap: normal; word-break: normal; }
        .task-instruction math, .task-question math, .solution-box math,
        .task-instruction code, .task-question code, .solution-box code,
        .gap-inline, .gap-inline * { white-space: nowrap; }
        .task-question.rich-gap-question { white-space: normal; }
        .task-instruction p, .task-question p, .solution-box p, .teacher-note p,
        .task-instruction ul, .task-question ul, .solution-box ul, .teacher-note ul,
        .task-instruction ol, .task-question ol, .solution-box ol, .teacher-note ol,
        .task-instruction blockquote, .task-question blockquote, .solution-box blockquote, .teacher-note blockquote,
        .task-instruction pre, .task-question pre, .solution-box pre, .teacher-note pre {
          margin: 0 0 8px;
        }
        .task-instruction p:last-child, .task-question p:last-child, .solution-box p:last-child, .teacher-note p:last-child,
        .task-instruction ul:last-child, .task-question ul:last-child, .solution-box ul:last-child, .teacher-note ul:last-child,
        .task-instruction ol:last-child, .task-question ol:last-child, .solution-box ol:last-child, .teacher-note ol:last-child,
        .task-instruction blockquote:last-child, .task-question blockquote:last-child, .solution-box blockquote:last-child, .teacher-note blockquote:last-child,
        .task-instruction pre:last-child, .task-question pre:last-child, .solution-box pre:last-child, .teacher-note pre:last-child {
          margin-bottom: 0;
        }
        .task-instruction ul, .task-question ul, .solution-box ul, .teacher-note ul,
        .task-instruction ol, .task-question ol, .solution-box ol, .teacher-note ol {
          padding-left: 22px;
        }
        .task-instruction li, .task-question li, .solution-box li, .teacher-note li {
          margin: 2px 0;
        }
        .task-instruction code, .task-question code, .solution-box code, .teacher-note code {
          padding: 1px 4px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          background: #f1f5f9;
          font-family: Consolas, Menlo, Monaco, monospace;
          font-size: 0.92em;
        }
        .task-instruction pre, .task-question pre, .solution-box pre, .teacher-note pre {
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #f8fafc;
          white-space: pre-wrap;
        }
        .task-instruction pre code, .task-question pre code, .solution-box pre code, .teacher-note pre code {
          padding: 0;
          border: 0;
          background: transparent;
        }
        .task-instruction blockquote, .task-question blockquote, .solution-box blockquote, .teacher-note blockquote {
          padding: 6px 10px;
          border-left: 3px solid #64748b;
          background: #f8fafc;
          color: #334155;
        }
        .gap-inline {
          display: inline-flex;
          vertical-align: middle;
          align-items: center;
          justify-content: center;
          margin: 0 0.2rem;
          white-space: nowrap;
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
        .construction-preview {
          display: flex;
          align-items: flex-start;
          width: 100%;
          max-width: 100%;
          margin-top: 8px;
          overflow: hidden;
        }
        .image-preview {
          display: block;
          max-width: 100%;
          max-height: 680px;
          height: auto;
          margin-bottom: 10px;
          object-fit: contain;
          object-position: center;
          border-radius: 14px;
        }
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


        /* Task content uses the same inner rendering rules as ExamplePreviewComponent,
           but without wrapping the whole question in an additional card/frame. */
        .preview-panel {
          padding: 0;
          border-radius: 0;
          background: transparent;
          border: 0;
          color: #111;
          line-height: 1.4;
          overflow-wrap: normal;
          word-break: normal;
          overflow-x: visible;
          overflow-y: visible;
        }
        .preview-panel p {
          margin: 0 0 0.9rem;
          color: #333;
        }
        .preview-panel strong {
          color: #111;
        }
        .multiline-text,
        .rich-text,
        .task-instruction,
        .task-question {
          white-space: normal;
          overflow-wrap: normal;
          word-break: normal;
        }
        .rich-text math,
        .rich-text code,
        .gap-inline,
        .gap-inline * {
          white-space: nowrap;
        }
        .rich-text p,
        .rich-text ul,
        .rich-text ol,
        .rich-text blockquote,
        .rich-text pre,
        .solution-box p,
        .solution-box ul,
        .solution-box ol,
        .solution-box blockquote,
        .solution-box pre,
        .teacher-note p,
        .teacher-note ul,
        .teacher-note ol,
        .teacher-note blockquote,
        .teacher-note pre {
          margin: 0 0 0.25rem;
        }
        .rich-text p:last-child,
        .rich-text ul:last-child,
        .rich-text ol:last-child,
        .rich-text blockquote:last-child,
        .rich-text pre:last-child,
        .solution-box p:last-child,
        .solution-box ul:last-child,
        .solution-box ol:last-child,
        .solution-box blockquote:last-child,
        .solution-box pre:last-child,
        .teacher-note p:last-child,
        .teacher-note ul:last-child,
        .teacher-note ol:last-child,
        .teacher-note blockquote:last-child,
        .teacher-note pre:last-child {
          margin-bottom: 0;
        }
        .rich-text ul,
        .rich-text ol,
        .solution-box ul,
        .solution-box ol,
        .teacher-note ul,
        .teacher-note ol {
          padding-left: 1.45rem;
        }
        .rich-text li,
        .solution-box li,
        .teacher-note li {
          margin: 0.18rem 0;
        }
        .rich-text code,
        .solution-box code,
        .teacher-note code {
          padding: 0.12rem 0.35rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.35rem;
          background: #f1f5f9;
          font-family: Consolas, Menlo, Monaco, monospace;
          font-size: 0.92em;
        }
        .rich-text pre,
        .solution-box pre,
        .teacher-note pre {
          padding: 0.7rem 0.85rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.7rem;
          background: #f8fafc;
          overflow-x: auto;
          white-space: pre-wrap;
        }
        .rich-text pre code,
        .solution-box pre code,
        .teacher-note pre code {
          padding: 0;
          border: 0;
          background: transparent;
        }
        .rich-text blockquote,
        .solution-box blockquote,
        .teacher-note blockquote {
          padding: 0.55rem 0.8rem;
          border-left: 3px solid #64748b;
          border-radius: 0 0.65rem 0.65rem 0;
          background: #f8fafc;
        }
        .construction-preview {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 0.8rem;
          overflow: visible;
        }
        .image-preview {
          display: block;
          width: auto;
          height: auto;
          object-fit: contain;
          object-position: center;
          border-radius: 14px;
        }
        .multiple-choice-preview table,
        .gap-fill-preview table,
        .assign-preview table {
          width: 100%;
          border-collapse: collapse;
          border-spacing: 0;
          margin-top: 0.75rem;
          table-layout: fixed;
        }
        .multiple-choice-preview td,
        .gap-fill-preview td,
        .gap-fill-preview th,
        .assign-preview td {
          border: 1px solid #d7deea;
          padding: 0.7rem 0.8rem;
          vertical-align: middle;
          overflow-wrap: normal;
          word-break: normal;
          color: #333;
        }
        .gap-fill-preview {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          margin-top: 0.8rem;
        }
        .gap-fill-preview th {
          text-align: center;
          font-weight: 800;
          color: #111;
          background: #f8fafc;
        }
        .assign-preview {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
          margin-top: 0.8rem;
        }
        .fill {
          width: 56px;
        }
        .small,
        .checkbox-cell {
          width: 48px;
          text-align: center;
        }
        .half-open-preview {
          margin-top: 0.8rem;
        }
        .preview-panel {
          --text: #111;
          --text-muted: #333;
          --text-soft: #64748b;
          --border: #d7deea;
          --primary: #64748b;
          --bg-soft: transparent;
          --bg-code: #f1f5f9;
          --bg-code-block: #f8fafc;
          --blockquote-bg: #f8fafc;
          --gap-border: #94a3b8;
          --gap-bg: #e2e8f0;
          --table-head-bg: #f8fafc;
        }
        ${this.previewRenderer.buildPreviewCss()}
        @media print {
          .preview-panel {
            background: #fff;
            border-color: transparent;
            padding: 0;
            border-radius: 0;
            overflow: visible;
          }
        }

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

        ${test.note ? `<div class="teacher-note">${this.formatMultiline(test.note)}</div>` : ''}
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
    const branding = this.resolveBranding(test, options.branding);
    const tasks = selectedExamples
      .map((entry, i) => this.buildTaskHtml(entry, i, true, options))
      .join('');

    return `
      <section class="print-doc solution-doc page-break-before">
        <div class="test-header solution-header">
          ${this.buildBrandingHtml(branding)}
          <h2 class="test-title">${this.escapeHtml(test.name || labels.untitled)} ${this.escapeHtml(labels.solutionSuffix)}</h2>
          <p class="solution-note">${this.escapeHtml(labels.solutionNote)}</p>
          <hr class="header-divider" />
        </div>
        ${tasks}
      </section>
    `;
  }

  private resolveExplicitTaskTitle(entry: TestExampleDTO): string {
    const rawTitle = String(
      (entry as any).taskTitle ??
      (entry as any).customTitle ??
      (entry as any).taskName ??
      (entry as any).title ??
      ''
    ).trim();

    if (!rawTitle) {
      return '';
    }

    const example = entry.example as any;
    const autoGeneratedTitleSources = [
      example?.instruction,
      example?.question,
      example?.title,
      example?.name,
    ];

    const normalizedTitle = this.normalizeComparableText(rawTitle);
    const looksLikeAutoGeneratedTitle = autoGeneratedTitleSources.some(source => {
      const normalizedSource = this.normalizeComparableText(source);
      return !!normalizedSource && normalizedSource === normalizedTitle;
    });

    return looksLikeAutoGeneratedTitle ? '' : rawTitle;
  }

  private normalizeComparableText(value: string | number | null | undefined): string {
    return String(value ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
  }


  /**
   * Test/Edit entries can carry variable values outside entry.example.variables.
   * ExamplePreviewComponent receives a live Example object, but Test/Print receives
   * a TestExampleDTO. Normalize it into the same shape before rendering.
   */
  private getPrintableExample(entry: TestExampleDTO): Example {
    const example = this.clonePlain(entry.example) as Example;
    const entryVariableValues = this.extractEntryVariableValues(entry);

    (example as any).displaySettings = this.normalizeDisplaySettings((example as any).displaySettings);

    const existingVariables = Array.isArray(example.variables) ? example.variables : [];
    const normalizedVariables = existingVariables.map(variable => {
      const key = String(variable?.key ?? '').trim();

      return {
        ...variable,
        defaultValue: String(key && entryVariableValues.has(key) ? entryVariableValues.get(key) ?? '' : variable?.defaultValue ?? ''),
      };
    });

    const knownKeys = new Set(normalizedVariables.map(variable => String(variable?.key ?? '').trim()).filter(Boolean));

    for (const [key, value] of entryVariableValues.entries()) {
      const normalizedKey = String(key ?? '').trim();
      if (!normalizedKey || knownKeys.has(normalizedKey)) {
        continue;
      }

      normalizedVariables.push({
        id: normalizedKey,
        key: normalizedKey,
        defaultValue: String(value ?? ''),
      } as any);
    }

    example.variables = normalizedVariables as any;

    return example;
  }

  private normalizeDisplaySettings(value: unknown): { showInstructionLabel: boolean; showQuestionLabel: boolean; showTaskImageLabel: boolean } {
    let settings: any = value;

    if (typeof settings === 'string') {
      try {
        settings = JSON.parse(settings);
      } catch {
        settings = {};
      }
    }

    if (!settings || typeof settings !== 'object') {
      settings = {};
    }

    return {
      showInstructionLabel: settings.showInstructionLabel !== false,
      showQuestionLabel: settings.showQuestionLabel !== false,
      showTaskImageLabel: settings.showTaskImageLabel !== false,
    };
  }

  private clonePlain<T>(value: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value ?? null));
  }

  private extractEntryVariableValues(entry: TestExampleDTO): Map<string, string> {
    const result = new Map<string, string>();
    const candidateContainers = [
      (entry as any).variableValues,
      (entry as any).variables,
      (entry as any).testVariables,
      (entry as any).variableValueMap,
      (entry as any).resolvedVariables,
      (entry as any).exampleVariables,
      (entry as any).values,
    ];

    for (const container of candidateContainers) {
      this.collectVariableValues(container, result);
    }

    return result;
  }

  private collectVariableValues(value: unknown, target: Map<string, string>): void {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(item => this.collectVariableValues(item, target));
      return;
    }

    if (typeof value !== 'object') {
      return;
    }

    const record = value as Record<string, any>;
    const explicitKey = String(
      record['key'] ??
      record['name'] ??
      record['variableKey'] ??
      record['variableName'] ??
      record['variable']?.key ??
      ''
    ).trim();

    if (explicitKey) {
      const rawValue =
        record['value'] ??
        record['defaultValue'] ??
        record['resolvedValue'] ??
        record['currentValue'] ??
        record['text'];

      if (rawValue !== undefined && rawValue !== null) {
        target.set(explicitKey, String(rawValue));
      }

      return;
    }

    for (const [key, rawValue] of Object.entries(record)) {
      if (rawValue === undefined || rawValue === null) {
        continue;
      }

      if (typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
        target.set(String(key).trim(), String(rawValue));
      }
    }
  }

  private buildTaskHtml(entry: TestExampleDTO, index: number, isSolution: boolean, options: TestPrintOptions): string {
    const example = this.getPrintableExample(entry);
    const exampleId = example?.id ?? '';
    const margin = options.getTaskSpacing(exampleId);
    const exampleLabel = options.labels.exampleShort;
    const taskTitle = this.resolveExplicitTaskTitle({ ...entry, example });

    const header = `
      <div class="task-head">
        <div class="task-title">${this.escapeHtml(exampleLabel)} ${index + 1}: ${taskTitle ? this.escapeHtml(taskTitle) : ''}</div>
        <div class="task-points">(${isSolution ? this.escapeHtml(entry.points || '__') : '__'} / ${this.escapeHtml(entry.points || '__')} P.)</div>
      </div>
    `;

    return `
      <div class="task print-task" style="margin-bottom:${margin}px;">
        ${header}
        ${this.previewRenderer.buildExamplePreviewPanelHtml(example, {
      isSolution,
      getLetter: (letterIndex) => options.getLetter(letterIndex),
      labels: {
        instruction: options.labels.instruction || 'Angabe',
        question: options.labels.question,
        taskImage: options.labels.taskImage || 'Aufgabenbild',
        imagePreviewAlt: options.labels.imagePreviewAlt,
        noSolution: options.labels.noSolution,
      },
    })}
        ${this.buildSolutionFreeSpaceHtml(example, isSolution)}
      </div>
    `;
  }

  private buildSolutionFreeSpaceHtml(example: Example, isSolution: boolean): string {
    if (isSolution) {
      return '';
    }

    if (example.type === ExampleTypes.OPEN) {
      return `<div class="free-space large"></div>`;
    }

    if (example.type === ExampleTypes.GAP_FILL && example.gapFillType === 'INPUT') {
      return `<div class="free-space medium"></div>`;
    }

    return '';
  }

  private getQuestionWithGapLabels(example: Example, options: TestPrintOptions): string {
    const q = this.replaceVariablesOutsideLatex(example?.question, example?.variables);
    if (example?.type !== ExampleTypes.GAP_FILL) {
      return q;
    }

    const gaps = example?.gaps ?? [];
    if (!gaps.length) {
      return q;
    }

    let i = 0;
    return this.replaceOutsideLatex(q, (text) => text.replace(/_{3,}/g, (match) => {
      const label = (gaps[i] as any)?.label ?? options.getLetter(i);
      i += 1;
      return `${match} (${label})`;
    }));
  }

  private buildGapQuestionHtml(example: Example): string {
    let gapIndex = 0;

    return this.renderTextWithGapPlaceholders(example.question || '', () => {
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
    }, example.variables);
  }

  private buildGapQuestionSolutionHtml(example: Example): string {
    let gapIndex = 0;

    return this.renderTextWithGapPlaceholders(example.question || '', () => {
      const gap = (example.gaps ?? [])[gapIndex];
      const gapNumber = this.escapeHtml(String(gapIndex + 1));
      gapIndex += 1;

      if (example.gapFillType === 'INPUT') {
        const solution = this.formatMultiline(String((gap as any)?.solution ?? ''), example.variables);
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
    }, example.variables);
  }

  private renderTextWithGapPlaceholders(value: string, gapRenderer: () => string, variables?: Example['variables']): string {
    const source = String(value ?? '');
    const gapTokens: string[] = [];
    const gapPattern = /\{\d+\}|\{Lücke \d+\}|_{3,}/g;

    const textWithGapTokens = this.replaceOutsideLatex(source, (text) => text.replace(gapPattern, () => {
      const token = `@@GAP_TOKEN_${gapTokens.length}@@`;
      gapTokens.push(gapRenderer());
      return token;
    }));

    let html = this.formatMultiline(textWithGapTokens, variables);
    gapTokens.forEach((gapHtml, index) => {
      html = html.replace(new RegExp(`@@GAP_TOKEN_${index}@@`, 'g'), gapHtml);
    });

    return html;
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
          ? `<div class="solution-box rich-text multiline-text">${this.formatMultiline((example as any).solution || '', example.variables) || `<span class="muted">${this.escapeHtml(labels.noSolution)}</span>`}</div>`
          : `<div class="free-space large"></div>`;

      case ExampleTypes.HALF_OPEN:
        return isSolution
          ? `<div class="half-open-preview solution-list">${(example.answers ?? []).map(ans => `<p><strong>${this.formatMultiline(ans?.[0] ?? '', example.variables)}</strong> = ${this.formatMultiline(ans?.[1] ?? '', example.variables)}</p>`).join('')}</div>`
          : `
              <div class="half-open-preview solution-list student-list">
                ${(example.answers ?? []).map(ans => `<p>${this.formatMultiline(ans?.[0] ?? '', example.variables)} = ___________________</p>`).join('')}
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

        const displaySettings = (example as any).displaySettings ?? {};
        const showTaskImageLabel = !isSolution && displaySettings.showTaskImageLabel !== false;
        const taskImageLabel = labels.taskImage || 'Aufgabenbild';

        return `
          <div class="construction-preview">
            ${showTaskImageLabel ? `<p><strong>${this.escapeHtml(taskImageLabel)}:</strong></p>` : ''}
            ${image ? `<img src="${this.escapeHtml(image)}" alt="${this.escapeHtml(labels.imagePreviewAlt)}" class="image-preview" style="width:${width}px;max-width:100%;height:auto;" />` : ''}
          </div>
        `;
      }

      case ExampleTypes.MULTIPLE_CHOICE:
        return `
          <div class="multiple-choice-preview answer-table-wrap">
            <table>
              ${(example.options ?? []).map((opt: Option) => `
                <tr>
                  <td>${this.formatMultiline(opt.text, example.variables)}</td>
                  <td class="small checkbox-cell">${isSolution && opt.correct ? '☒' : '☐'}</td>
                </tr>
              `).join('')}
            </table>
          </div>
        `;

      case ExampleTypes.GAP_FILL:
        if (example.gapFillType === 'SELECT') {
          return `
            <div class="gap-fill-preview gap-grid">
              ${(example.gaps ?? []).map((gap: Gap, gapIndex: number) => `
                <table>
                  <tr><th colspan="2">${this.escapeHtml(String(gapIndex + 1))}</th></tr>
                  ${(gap.options ?? []).map((opt: Option) => `
                    <tr>
                      <td>${this.formatMultiline(opt.text, example.variables)}</td>
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
              ${(example.assigns ?? []).map(assign => `<div>${this.formatMultiline(assign.left, example.variables)} → ${this.formatMultiline(assign.right, example.variables)}</div>`).join('')}
            </div>
          `
          : `
            <div class="assign-preview">
              <table class="leftSide">
                ${(example.assigns ?? []).map(assign => `
                  <tr>
                    <td>${this.formatMultiline(assign.left, example.variables)}</td>
                    <td class="fill"></td>
                  </tr>
                `).join('')}
              </table>
              <table class="rightSide">
                ${(example.assignRightItems ?? []).map((right: string, j: number) => `
                  <tr>
                    <td class="fill letter-cell">${this.escapeHtml(options.getLetter(j))}</td>
                    <td>${this.formatMultiline(right, example.variables)}</td>
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
    return (example as any)?.imageUrl || (example as any)?.image || null;
  }

  private getConstructionSolutionImage(example: Example): string | null {
    return (example as any)?.solutionUrl || this.getConstructionTaskImage(example);
  }

  private normalizeImageWidth(value: number | null | undefined): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return this.defaultImageWidth;
    }
    return Math.max(80, Math.min(1200, Math.round(parsed)));
  }
}
