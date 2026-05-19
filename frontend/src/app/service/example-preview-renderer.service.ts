import { Injectable } from "@angular/core";
import * as katex from "katex";

import {
  CreateExampleDTO,
  Example,
  ExampleTypes,
  Gap,
  Option,
} from "../model/Example";

export type ExamplePreviewRendererLabels = {
  instruction?: string;
  question?: string;
  taskImage?: string;
  imagePreviewAlt?: string;
  noTaskImage?: string;
  noSolution?: string;
};

export type ExamplePreviewRendererOptions = {
  isSolution?: boolean;
  labels?: ExamplePreviewRendererLabels;
  getLetter?: (index: number) => string;
};

@Injectable({ providedIn: "root" })
export class ExamplePreviewRendererService {
  readonly defaultImageWidth = 320;
  private readonly variablePattern = /\[\[([a-zA-Z_][a-zA-Z0-9_-]*)\]\]/g;

  getResolvedText(
    example:
      | Pick<Example, "variables">
      | Pick<CreateExampleDTO, "variables">
      | null
      | undefined,
    value: string | number | null | undefined,
  ): string {
    return this.replaceVariablesOutsideLatex(value, example?.variables);
  }

  renderMathHtml(
    value: string | number | null | undefined,
    variables?:
      | { key?: string; defaultValue?: string | number | null }[]
      | null,
  ): string {
    const source = this.replaceVariablesOutsideLatex(value, variables);
    const mathTokens: string[] = [];
    const mathPattern =
      /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([^)]+?)\\\)/g;

    const textWithMathTokens = source.replace(
      mathPattern,
      (
        _fullMatch,
        dollarDisplayFormula,
        bracketDisplayFormula,
        dollarInlineFormula,
        parenInlineFormula,
      ) => {
        const isDisplay =
          dollarDisplayFormula !== undefined ||
          bracketDisplayFormula !== undefined;
        const formula =
          dollarDisplayFormula ??
          bracketDisplayFormula ??
          dollarInlineFormula ??
          parenInlineFormula ??
          "";
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

  renderMathInlineHtml(
    value: string | number | null | undefined,
    variables?:
      | { key?: string; defaultValue?: string | number | null }[]
      | null,
  ): string {
    return this.toInlineHtml(this.renderMathHtml(value, variables));
  }

  buildQuestionHtml(
    example: Example | CreateExampleDTO,
    options: ExamplePreviewRendererOptions = {},
  ): string {
    if (example.type === ExampleTypes.GAP_FILL) {
      return options.isSolution && example.gapFillType === "INPUT"
        ? this.buildGapQuestionSolutionHtml(example)
        : this.buildGapQuestionHtml(example);
    }

    return this.renderMathHtml(
      this.getQuestionWithGapLabels(example, options.getLetter),
      example.variables,
    );
  }

  buildExamplePreviewPanelHtml(
    example: Example | CreateExampleDTO,
    options: ExamplePreviewRendererOptions = {},
  ): string {
    const labels = options.labels ?? {};
    const displaySettings = this.getDisplaySettings(example);
    const showInstructionLabel = displaySettings.showInstructionLabel !== false;
    const showQuestionLabel = displaySettings.showQuestionLabel !== false;
    const instructionLabel = labels.instruction ?? "Angabe";
    const questionLabel = labels.question ?? "Aufgabenstellung";

    return `
      <div class="preview-panel">
        <div>
          ${showInstructionLabel ? `<p><strong>${this.escapeHtml(instructionLabel)}:</strong></p>` : ""}
          <div class="rich-text multiline-text">${this.renderMathHtml(example.instruction, example.variables)}</div>
        </div>

        ${showQuestionLabel ? `<p><strong>${this.escapeHtml(questionLabel)}:</strong></p>` : ""}

        <div>
          <div class="rich-text multiline-text">${this.buildQuestionHtml(example, options)}</div>
        </div>

        ${this.buildBodyHtml(example, options)}
      </div>
    `;
  }

  buildBodyHtml(
    example: Example | CreateExampleDTO,
    options: ExamplePreviewRendererOptions = {},
  ): string {
    const labels = options.labels ?? {};
    const getLetter =
      options.getLetter ?? ((index: number) => this.getLetter(index));
    const isSolution = options.isSolution === true;

    switch (example.type) {
      case ExampleTypes.OPEN:
        return isSolution
          ? `<div class="solution-box rich-text multiline-text">${this.renderMathHtml((example as any).solution || "", example.variables) || `<span class="muted">${this.escapeHtml(labels.noSolution ?? "")}</span>`}</div>`
          : "";

      case ExampleTypes.HALF_OPEN:
        return `
          <div class="half-open-preview">
            ${(example.answers ?? [])
          .map((ans) =>
            isSolution
              ? `<div class="half-open-item"><span class="half-open-label">${this.renderMathInlineHtml(ans?.[0] ?? "", example.variables)}</span><span class="half-open-equals" aria-hidden="true">&nbsp;=&nbsp;</span><span class="half-open-solution">${this.renderMathInlineHtml(ans?.[1] ?? "", example.variables)}</span></div>`
              : `<div class="half-open-item"><span class="half-open-label">${this.renderMathInlineHtml(ans?.[0] ?? "", example.variables)}</span><span class="half-open-equals" aria-hidden="true">&nbsp;=&nbsp;</span><span class="half-open-line" aria-hidden="true"></span></div>`,
          )
          .join("")}
          </div>
        `;

      case ExampleTypes.CONSTRUCTION: {
        const image = isSolution
          ? this.getConstructionSolutionImage(example)
          : this.getConstructionTaskImage(example);
        const width = isSolution
          ? this.normalizeImageWidth((example as any).solutionImageWidth)
          : this.normalizeImageWidth((example as any).imageWidth);
        const displaySettings = this.getDisplaySettings(example);
        const showTaskImageLabel =
          !isSolution && displaySettings.showTaskImageLabel !== false;
        const taskImageLabel = labels.taskImage ?? "Aufgabenbild";
        const noTaskImage = labels.noTaskImage ?? "";

        return `
          <div class="construction-preview">
            <div>
              ${showTaskImageLabel ? `<p><strong>${this.escapeHtml(taskImageLabel)}</strong></p>` : ""}
              ${
          image
            ? `<div class="image-preview-frame"><img src="${this.escapeHtml(image)}" alt="${this.escapeHtml(labels.imagePreviewAlt ?? "")}" class="image-preview" style="width:${width}px;max-width:100%;height:auto;" /></div>`
            : noTaskImage
              ? `<p>${this.escapeHtml(noTaskImage)}</p>`
              : ""
        }
            </div>
          </div>
        `;
      }

      case ExampleTypes.MULTIPLE_CHOICE:
        return `
          <div class="multiple-choice-preview">
            <table>
              ${(example.options ?? [])
          .map(
            (option: Option) => `
                <tr>
                  <td>${this.renderMathHtml(option.text, example.variables)}</td>
                  <td class="small checkbox-cell">${isSolution && option.correct ? "☒" : "☐"}</td>
                </tr>
              `,
          )
          .join("")}
            </table>
          </div>
        `;

      case ExampleTypes.GAP_FILL:
        if (example.gapFillType === "SELECT") {
          return `
            <div class="gap-fill-preview">
              ${(example.gaps ?? [])
            .map(
              (gap: Gap, gapIndex: number) => `
                <table>
                  <tr><th colspan="2">${this.escapeHtml(String(gapIndex + 1))}</th></tr>
                  ${(gap.options ?? [])
                .map(
                  (opt: Option) => `
                    <tr>
                      <td>${this.renderMathHtml(opt.text, example.variables)}</td>
                      <td class="small checkbox-cell">${isSolution && opt.correct ? "☒" : "☐"}</td>
                    </tr>
                  `,
                )
                .join("")}
                </table>
              `,
            )
            .join("")}
            </div>
          `;
        }
        return "";

      case ExampleTypes.ASSIGN:
        return isSolution
          ? `
            <div class="solution-list">
              ${(example.assigns ?? []).map((assign) => `<div>${this.renderMathHtml(assign.left, example.variables)} → ${this.renderMathHtml(assign.right, example.variables)}</div>`).join("")}
            </div>
          `
          : `
            <div class="assign-preview">
              <table class="leftSide">
                ${(example.assigns ?? [])
            .map(
              (assign) => `
                  <tr>
                    <td>${this.renderMathHtml(assign.left, example.variables)}</td>
                    <td class="fill"></td>
                  </tr>
                `,
            )
            .join("")}
              </table>

              <table class="rightSide">
                ${(example.assignRightItems ?? [])
            .map(
              (right: string, index: number) => `
                  <tr>
                    <td class="fill letter-cell">${this.escapeHtml(getLetter(index))}</td>
                    <td>${this.renderMathHtml(right, example.variables)}</td>
                  </tr>
                `,
            )
            .join("")}
              </table>
            </div>
          `;

      default:
        return "";
    }
  }

  getQuestionWithGapLabels(
    example: Example | CreateExampleDTO,
    getLetter: (index: number) => string = (index) => this.getLetter(index),
  ): string {
    const q = this.getResolvedText(example, example?.question);
    if (example?.type !== ExampleTypes.GAP_FILL) {
      return q;
    }

    const gaps = example?.gaps ?? [];
    if (!gaps.length) {
      return q;
    }

    let i = 0;
    return this.replaceOutsideLatex(q, (text) =>
      text.replace(/_{3,}/g, (match) => {
        const label = (gaps[i] as any)?.label ?? getLetter(i);
        i += 1;
        return `${match} (${label})`;
      }),
    );
  }

  getLetter(index: number): string {
    return String.fromCharCode(65 + (index % 26));
  }

  normalizeImageWidth(value: number | string | null | undefined): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return this.defaultImageWidth;
    }
    return Math.max(80, Math.min(1200, Math.round(parsed)));
  }

  buildPreviewCss(): string {
    return `
      .preview-panel {
        background: var(--bg-soft, transparent);
        color: var(--text, #111);
        overflow-wrap: normal;
        word-break: normal;
      }
      .preview-panel p {
        margin: 0 0 0.9rem;
        color: var(--text-muted, #333);
      }
      .preview-panel strong { color: var(--text, #111); }
      .multiline-text,
      .rich-text {
        white-space: normal;
        overflow-wrap: normal;
        word-break: normal;
      }
      .rich-text math,
      .rich-text code,
      .gap-inline,
      .gap-inline * { white-space: nowrap; }
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
      .teacher-note pre { margin: 0 0 0.25rem; }
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
      .teacher-note pre:last-child { margin-bottom: 0; }
      .rich-text ul,
      .rich-text ol,
      .solution-box ul,
      .solution-box ol,
      .teacher-note ul,
      .teacher-note ol { padding-left: 1.45rem; }
      .rich-text li,
      .solution-box li,
      .teacher-note li { margin: 0.18rem 0; }
      .rich-text code,
      .solution-box code,
      .teacher-note code {
        padding: 0.12rem 0.35rem;
        border: 1px solid var(--border, #cbd5e1);
        border-radius: 0.35rem;
        background: var(--bg-code, #f1f5f9);
        color: var(--text, #111);
        font-family: Consolas, Menlo, Monaco, monospace;
        font-size: 0.92em;
      }
      .rich-text pre,
      .solution-box pre,
      .teacher-note pre {
        padding: 0.7rem 0.85rem;
        border: 1px solid var(--border, #cbd5e1);
        border-radius: 0.7rem;
        background: var(--bg-code-block, #f8fafc);
        overflow-x: auto;
        white-space: pre-wrap;
      }
      .rich-text pre code,
      .solution-box pre code,
      .teacher-note pre code { padding: 0; border: 0; background: transparent; }
      .rich-text blockquote,
      .solution-box blockquote,
      .teacher-note blockquote {
        padding: 0.55rem 0.8rem;
        border-left: 3px solid var(--primary, #64748b);
        border-radius: 0 0.65rem 0.65rem 0;
        background: var(--blockquote-bg, #f8fafc);
      }
      .gap-inline {
        display: inline-flex;
        vertical-align: middle;
        align-items: center;
        justify-content: center;
        margin: 0 0.2rem;
        white-space: nowrap;
      }
      .gap-inline-select { min-width: 3.1rem; }
      .gap-inline-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 2.8rem;
        min-height: 2.2rem;
        padding: 0.28rem 0.85rem;
        border-radius: 999px;
        border: 1px solid var(--gap-border, #94a3b8);
        background: var(--gap-bg, #e2e8f0);
        color: var(--text, #0f172a);
        font-weight: 700;
        line-height: 1;
      }
      .gap-inline-pill-number { font-size: 0.95rem; }
      .gap-inline-input {
        position: relative;
        min-height: 2rem;
        justify-content: flex-start;
        padding-left: 1.6rem;
        border-bottom: 2px solid var(--text-soft, #64748b);
      }
      .gap-inline-label {
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-soft, #475569);
        font-size: 0.78rem;
        font-weight: 700;
        line-height: 1;
      }
      .gap-inline-line { display: inline-block; width: 100%; height: 1px; }
      .gap-inline-solution {
        display: inline-block;
        width: 100%;
        padding-right: 0.3rem;
        font-weight: 600;
        line-height: 1.2;
      }
      .construction-preview {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .construction-section { margin-top: 0.2rem; }
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
        margin-top: 0.75rem;
        table-layout: fixed;
      }
      .multiple-choice-preview td,
      .gap-fill-preview td,
      .gap-fill-preview th,
      .assign-preview td {
        padding: 0.7rem 0.8rem;
        border: 1px solid var(--border, #d7deea);
        vertical-align: middle;
        overflow-wrap: normal;
        word-break: normal;
        color: var(--text-muted, #333);
      }
      .gap-fill-preview {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }
      .gap-fill-preview th {
        text-align: center;
        font-weight: 800;
        color: var(--text, #111);
        background: var(--table-head-bg, #f8fafc);
      }
      .assign-preview {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }
      .fill { width: 56px; }
      .small,
      .checkbox-cell {
        width: 48px;
        text-align: center;
      }
      .half-open-preview {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        margin-top: 0.8rem;
        overflow-x: auto;
      }
      .half-open-item {
        display: inline-flex;
        align-items: baseline;
        gap: 0;
        width: max-content;
        max-width: 100%;
        min-height: 1.8rem;
        white-space: nowrap;
      }
      .half-open-label {
        display: inline-flex;
        align-items: baseline;
        min-width: 0;
        white-space: nowrap;
      }
      .half-open-label p {
        display: inline;
        margin: 0;
      }
      .half-open-label .katex-display {
        display: inline-block;
        margin: 0;
      }
      .half-open-equals {
        display: inline-block;
        flex: 0 0 auto;
        white-space: nowrap;
        line-height: 1;
      }
      .half-open-line {
        display: inline-block;
        flex: 0 0 9rem;
        width: 9rem;
        height: 0.95em;
        border-bottom: 1.5px solid currentColor;
      }
      .half-open-solution {
        display: inline-flex;
        align-items: baseline;
        min-width: 3rem;
        white-space: nowrap;
        font-weight: 600;
      }
    `;
  }

  private buildGapQuestionHtml(example: Example | CreateExampleDTO): string {
    let gapIndex = 0;

    return this.renderTextWithGapPlaceholders(
      example.question || "",
      () => {
        const gap = (example.gaps ?? [])[gapIndex];
        const gapNumber = this.escapeHtml(String(gapIndex + 1));
        gapIndex += 1;

        if (example.gapFillType === "INPUT") {
          const width = this.normalizeGapInlineWidth(
            (gap as any)?.width,
            (gap as any)?.solution,
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
      },
      example.variables,
    );
  }

  private buildGapQuestionSolutionHtml(
    example: Example | CreateExampleDTO,
  ): string {
    let gapIndex = 0;

    return this.renderTextWithGapPlaceholders(
      example.question || "",
      () => {
        const gap = (example.gaps ?? [])[gapIndex];
        const gapNumber = this.escapeHtml(String(gapIndex + 1));
        gapIndex += 1;

        if (example.gapFillType === "INPUT") {
          const solution = this.renderMathHtml(
            String((gap as any)?.solution ?? ""),
            example.variables,
          );
          const width = this.normalizeGapInlineWidth(
            (gap as any)?.width,
            (gap as any)?.solution,
          );
          return `
          <span class="gap-inline gap-inline-input" style="width:${width}px;">
            <span class="gap-inline-label gap-inline-label-number">${gapNumber}</span>
            <span class="gap-inline-solution">${solution || "&nbsp;"}</span>
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
      },
      example.variables,
    );
  }

  private renderTextWithGapPlaceholders(
    value: string,
    gapRenderer: () => string,
    variables?: Example["variables"] | CreateExampleDTO["variables"],
  ): string {
    const source = String(value ?? "");
    const gapTokens: string[] = [];
    const gapPattern = /\{\d+\}|\{Lücke \d+\}|_{3,}/g;

    const textWithGapTokens = this.replaceOutsideLatex(source, (text) =>
      text.replace(gapPattern, () => {
        const token = `@@GAP_TOKEN_${gapTokens.length}@@`;
        gapTokens.push(gapRenderer());
        return token;
      }),
    );

    let html = this.renderMathHtml(textWithGapTokens, variables);
    gapTokens.forEach((gapHtml, index) => {
      html = html.replace(new RegExp(`@@GAP_TOKEN_${index}@@`, "g"), gapHtml);
    });

    return html;
  }

  private replaceVariablesOutsideLatex(
    value: string | number | null | undefined,
    variables?:
      | { key?: string; defaultValue?: string | number | null }[]
      | null,
  ): string {
    // With [[variable]] placeholders we can safely replace everywhere, including inside LaTeX.
    // Example: $\frac{[[zaehler]]}{[[nenner]]}$ -> $\frac{10}{2}$
    return this.replaceVariables(String(value ?? ""), variables);
  }

  private replaceVariables(
    value: string | number | null | undefined,
    variables?:
      | {
      key?: string;
      defaultValue?: string | number | null;
      value?: string | number | null;
    }[]
      | null,
  ): string {
    const variableMap = new Map<string, string>();

    for (const variable of variables ?? []) {
      const key = String(variable?.key ?? "").trim();
      if (!key) {
        continue;
      }

      const rawValue = variable.defaultValue ?? variable.value;
      if (rawValue === undefined || rawValue === null) {
        continue;
      }

      variableMap.set(key, String(rawValue));
    }

    return String(value ?? "").replace(
      this.variablePattern,
      (match, key: string) => {
        const normalizedKey = key.trim();

        // Only replace declared [[variable]] placeholders. Unknown placeholders stay visible.
        return variableMap.has(normalizedKey)
          ? variableMap.get(normalizedKey)!
          : match;
      },
    );
  }

  private replaceOutsideLatex(
    value: string,
    replacer: (text: string) => string,
  ): string {
    const source = String(value ?? "");
    const mathPattern =
      /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$\n]*?\$|\\\([\s\S]*?\\\)/g;
    let cursor = 0;
    let result = "";
    let match: RegExpExecArray | null;

    while ((match = mathPattern.exec(source)) !== null) {
      result += replacer(source.slice(cursor, match.index));
      result += match[0];
      cursor = match.index + match[0].length;
    }

    result += replacer(source.slice(cursor));
    return result;
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

  private getConstructionTaskImage(
    example: Example | CreateExampleDTO,
  ): string | null {
    return (example as any)?.imageUrl || (example as any)?.image || null;
  }

  private getConstructionSolutionImage(
    example: Example | CreateExampleDTO,
  ): string | null {
    return (
      (example as any)?.solutionUrl || this.getConstructionTaskImage(example)
    );
  }

  private getDisplaySettings(example: Example | CreateExampleDTO): {
    showInstructionLabel: boolean;
    showQuestionLabel: boolean;
    showTaskImageLabel: boolean;
  } {
    let settings: any = (example as any)?.displaySettings;

    if (typeof settings === "string") {
      try {
        settings = JSON.parse(settings);
      } catch {
        settings = {};
      }
    }

    if (!settings || typeof settings !== "object") {
      settings = {};
    }

    return {
      showInstructionLabel: settings.showInstructionLabel !== false,
      showQuestionLabel: settings.showQuestionLabel !== false,
      showTaskImageLabel: settings.showTaskImageLabel !== false,
    };
  }

  private toInlineHtml(html: string): string {
    return String(html ?? "")
      .trim()
      .replace(/^<p>/, "")
      .replace(/<\/p>$/, "")
      .replace(/<\/p>\s*<p>/g, "<br>");
  }

  private escapeHtml(value: string | number | null | undefined): string {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}
