import { Component, ElementRef, HostListener, ViewChild, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';

import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { MatPseudoCheckbox } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDivider } from '@angular/material/divider';
import { MatSliderModule } from '@angular/material/slider';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatAutocomplete, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';

import { BehaviorSubject, Subject, combineLatest, firstValueFrom, startWith } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

import {
  Assign,
  CreateExampleDTO,
  ExampleTypeLabels,
  ExampleTypes,
  Focus,
  Gap,
  Option,
  ExampleVariable, ExampleDisplaySettings
} from '../../model/Example';
import { HttpService } from '../../service/http.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { ExampleTypeSelectorComponent } from './example-type-selector/example-type-selector.component';
import { ExamplePreviewComponent } from '../example-preview/example-preview.component';
import { ExampleFocusSelectorComponent } from './example-focus-selector/example-focus-selector.component';
import { ConstructionImageCardComponent } from './construction-image-card/construction-image-card.component';

type EditorToolbarAction = string;
type EditorToolbarItem = {
  label: string;
  icon?: string;
  action: EditorToolbarAction;
  insert: string;
  example?: string;
  tooltip?: string;
  shortcut?: string;
};

type ProofreadingIssue = {
  id: string;
  targetKey: string;
  start: number;
  end: number;
  original: string;
  suggestion: string;
  messageKey: string;
  messageParams?: Record<string, unknown>;
};

export const defaultExampleDisplaySettings: ExampleDisplaySettings = {
  showInstructionLabel: false,
  showQuestionLabel: true,
  showTaskImageLabel: true
};

type VariableTarget =
  | { type: 'instruction' | 'question' | 'solution' }
  | { type: 'halfOpenAnswer'; index: number; answerIndex: 0 | 1 }
  | { type: 'option'; index: number }
  | { type: 'gapSolution'; index: number }
  | { type: 'gapOption'; gapIndex: number; optionIndex: number }
  | { type: 'assignLeft'; index: number }
  | { type: 'assignRight'; index: number }
  | null;

type TextSelectionState = {
  targetKey: string;
  start: number;
  end: number;
};

@Component({
  selector: 'app-create-example',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatButtonToggleModule,
    MatDialogActions,
    MatTooltip,
    MatSliderModule,
    ReactiveFormsModule,
    TextFieldModule,
    MatChipsModule,
    TranslateModule,
    MatProgressBar,
    ExampleTypeSelectorComponent,
    ExamplePreviewComponent,
    ExampleFocusSelectorComponent,
    ConstructionImageCardComponent,
  ],
  templateUrl: './create-example.component.html',
  styleUrls: ['./create-example.component.scss']
})
export class CreateExampleComponent implements OnInit, OnDestroy {
  data = inject<{ schoolId: string; exampleId: string, folderId: string }>(MAT_DIALOG_DATA);
  private readonly destroy$ = new Subject<void>();

  private readonly http = inject(HttpService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly translate = inject(TranslateService);

  hasUnsavedChanges = false;
  isEditMode = false;
  isSaving = false;
  isExampleLoading = true;

  selectedConstructionImageFile: File | null = null;
  selectedConstructionSolutionFile: File | null = null;

  constructionImagePreviewUrl: string | null = null;
  constructionSolutionPreviewUrl: string | null = null;

  readonly maxImageBytes = 2 * 1024 * 1024;
  readonly allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  readonly defaultImageWidth = 320;

  readonly textLimits = {
    instruction: 30000,
    question: 30000,
    solution: 30000,
    halfOpenAnswer: 255,
    halfOpenCorrectAnswer: 255,
    option: 255,
    gapSolution: 255,
    gapOption: 255,
    assignLeft: 255,
    assignRight: 255,
    variableDefaultValue: 255,
  } as const;

  isDraggingConstructionPreview = false;
  isDraggingConstructionSolution = false;

  activeVariableTarget: VariableTarget = null;
  private activeTextSelection: TextSelectionState | null = null;
  previewCollapsed = false;
  variablesCollapsed = true;
  editorCollapsed = false;
  displaySettingsCollapsed = true;
  activeEditorToolbarGroupIndex = 0;
  tagsCollapsed = true;
  proofreadingOpen = false;
  proofreadIssues: ProofreadingIssue[] = [];

  get editorSpellcheckLang(): string {
    const language = this.translate.currentLang || this.translate.defaultLang || 'de';
    return language.toLowerCase().startsWith('en') ? 'en' : 'de-AT';
  }

  get isGreekToolbarActive(): boolean {
    return this.editorToolbarGroups[this.activeEditorToolbarGroupIndex]?.label === 'exampleDialog.editor.groups.greek';
  }

  readonly editorToolbarGroups = [
    {
      label: 'exampleDialog.editor.groups.start',
      items: [
        { label: 'exampleDialog.editor.commands.bold', icon: 'format_bold', action: 'bold', insert: '**Text**', shortcut: 'Strg+B' },
        { label: 'exampleDialog.editor.commands.italic', icon: 'format_italic', action: 'italic', insert: '*Text*', shortcut: 'Strg+I' },
        { label: 'exampleDialog.editor.commands.up', icon: 'superscript', action: 'power', insert: '^{}', example: '$x^2$', shortcut: 'Alt + +' },
        { label: 'exampleDialog.editor.commands.down', icon: 'subscript', action: 'index', insert: '_{}', example: '$x_1$', shortcut: 'Alt + -' },
        { label: 'exampleDialog.editor.commands.inlineFormula', icon: 'functions', action: 'inlineFormula', insert: 'x', example: '$x$', shortcut: 'Strg+M' },
        { label: 'exampleDialog.editor.commands.bulletList', icon: 'format_list_bulleted', action: 'bulletList', insert: '- Text' },
        { label: 'exampleDialog.editor.commands.numberedList', icon: 'format_list_numbered', action: 'numberedList', insert: '1. Text' },
        { label: 'exampleDialog.editor.commands.code', icon: 'code', action: 'inlineCode', insert: '`Text`' },
        { label: 'exampleDialog.editor.commands.strike', icon: 'strikethrough_s', action: 'strike', insert: '~~Text~~' },
      ],
    },
    {
      label: 'exampleDialog.editor.groups.formulas',
      items: [
        { label: 'exampleDialog.editor.commands.displayFormula', icon: 'calculate', action: 'displayFormula', insert: '\\frac{}{}', example: '$$\\frac{a}{b}$$' },
        { label: 'exampleDialog.editor.commands.frac', icon: 'functions', action: 'frac', insert: '\\frac{}{}', example: '$\\frac{a}{b}$' },
        { label: 'exampleDialog.editor.commands.sqrt', icon: 'data_object', action: 'sqrt', insert: '\\sqrt{}', example: '$\\sqrt{x}$' },
        { label: 'n√', icon: 'data_object', action: 'nthRoot', insert: '\\sqrt[]{}', example: '$\\sqrt[n]{x}$' },
        { label: 'exampleDialog.editor.commands.textUnit', icon: 'straighten', action: 'textUnit', insert: '\\,\\text{}', example: '$10\\,\\text{mm}$' },
        { label: 'exampleDialog.editor.commands.sum', icon: 'functions', action: 'sum', insert: '\\sum_{}^{}', example: '$\\sum_{i=1}^{n} i$' },
        { label: 'exampleDialog.editor.commands.integral', icon: 'functions', action: 'integral', insert: '\\int_{}^{}', example: '$\\int_a^b f(x)\\,dx$' },
        { label: 'exampleDialog.editor.commands.vector', icon: 'arrow_forward', action: 'vector', insert: '\\vec{}', example: '$\\vec{a}$' },
        { label: 'exampleDialog.editor.commands.aligned', icon: 'reorder', action: 'aligned', insert: '\\begin{aligned}\n&= \\\\\n&=\n\\end{aligned}', example: '$$\\begin{aligned} a&=b+c \\\\ d&=e+f \\end{aligned}$$' },
      ],
    },
    {
      label: 'exampleDialog.editor.groups.greek',
      items: [
        { label: "α", action: 'greek_alpha', insert: "\\alpha", example: "$\\alpha$" },
        { label: "β", action: 'greek_beta', insert: "\\beta", example: "$\\beta$" },
        { label: "γ", action: 'greek_gamma', insert: "\\gamma", example: "$\\gamma$" },
        { label: "δ", action: 'greek_delta', insert: "\\delta", example: "$\\delta$" },
        { label: "ε", action: 'greek_epsilon', insert: "\\epsilon", example: "$\\epsilon$" },
        { label: "ζ", action: 'greek_zeta', insert: "\\zeta", example: "$\\zeta$" },
        { label: "η", action: 'greek_eta', insert: "\\eta", example: "$\\eta$" },
        { label: "θ", action: 'greek_theta', insert: "\\theta", example: "$\\theta$" },
        { label: "ι", action: 'greek_iota', insert: "\\iota", example: "$\\iota$" },
        { label: "κ", action: 'greek_kappa', insert: "\\kappa", example: "$\\kappa$" },
        { label: "λ", action: 'greek_lambda', insert: "\\lambda", example: "$\\lambda$" },
        { label: "μ", action: 'greek_mu', insert: "\\mu", example: "$\\mu$" },
        { label: "ν", action: 'greek_nu', insert: "\\nu", example: "$\\nu$" },
        { label: "ξ", action: 'greek_xi', insert: "\\xi", example: "$\\xi$" },
        { label: "ο", action: 'greek_omicron', insert: "o", example: "$o$" },
        { label: "π", action: 'greek_pi', insert: "\\pi", example: "$\\pi$" },
        { label: "ρ", action: 'greek_rho', insert: "\\rho", example: "$\\rho$" },
        { label: "σ", action: 'greek_sigma', insert: "\\sigma", example: "$\\sigma$" },
        { label: "τ", action: 'greek_tau', insert: "\\tau", example: "$\\tau$" },
        { label: "υ", action: 'greek_upsilon', insert: "\\upsilon", example: "$\\upsilon$" },
        { label: "φ", action: 'greek_phi', insert: "\\phi", example: "$\\phi$" },
        { label: "χ", action: 'greek_chi', insert: "\\chi", example: "$\\chi$" },
        { label: "ψ", action: 'greek_psi', insert: "\\psi", example: "$\\psi$" },
        { label: "ω", action: 'greek_omega', insert: "\\omega", example: "$\\omega$" },
        { label: "ϵ", action: 'greek_varepsilon', insert: "\\varepsilon", example: "$\\varepsilon$" },
        { label: "ϑ", action: 'greek_vartheta', insert: "\\vartheta", example: "$\\vartheta$" },
        { label: "ϖ", action: 'greek_varpi', insert: "\\varpi", example: "$\\varpi$" },
        { label: "ϱ", action: 'greek_varrho', insert: "\\varrho", example: "$\\varrho$" },
        { label: "ς", action: 'greek_varsigma', insert: "\\varsigma", example: "$\\varsigma$" },
        { label: "ϕ", action: 'greek_varphi', insert: "\\varphi", example: "$\\varphi$" },
        { label: "Α", action: 'greek_Alpha', insert: "Α", example: "$Α$" },
        { label: "Β", action: 'greek_Beta', insert: "Β", example: "$Β$" },
        { label: "Γ", action: 'greek_Gamma', insert: "\\Gamma", example: "$\\Gamma$" },
        { label: "Δ", action: 'greek_Delta', insert: "\\Delta", example: "$\\Delta$" },
        { label: "Ε", action: 'greek_Epsilon', insert: "Ε", example: "$Ε$" },
        { label: "Ζ", action: 'greek_Zeta', insert: "Ζ", example: "$Ζ$" },
        { label: "Η", action: 'greek_Eta', insert: "Η", example: "$Η$" },
        { label: "Θ", action: 'greek_Theta', insert: "\\Theta", example: "$\\Theta$" },
        { label: "Ι", action: 'greek_Iota', insert: "Ι", example: "$Ι$" },
        { label: "Κ", action: 'greek_Kappa', insert: "Κ", example: "$Κ$" },
        { label: "Λ", action: 'greek_Lambda', insert: "\\Lambda", example: "$\\Lambda$" },
        { label: "Μ", action: 'greek_Mu', insert: "Μ", example: "$Μ$" },
        { label: "Ν", action: 'greek_Nu', insert: "Ν", example: "$Ν$" },
        { label: "Ξ", action: 'greek_Xi', insert: "\\Xi", example: "$\\Xi$" },
        { label: "Ο", action: 'greek_Omicron', insert: "Ο", example: "$Ο$" },
        { label: "Π", action: 'greek_Pi', insert: "\\Pi", example: "$\\Pi$" },
        { label: "Ρ", action: 'greek_Rho', insert: "Ρ", example: "$Ρ$" },
        { label: "Σ", action: 'greek_Sigma', insert: "\\Sigma", example: "$\\Sigma$" },
        { label: "Τ", action: 'greek_Tau', insert: "Τ", example: "$Τ$" },
        { label: "Υ", action: 'greek_Upsilon', insert: "\\Upsilon", example: "$\\Upsilon$" },
        { label: "Φ", action: 'greek_Phi', insert: "\\Phi", example: "$\\Phi$" },
        { label: "Χ", action: 'greek_Chi', insert: "Χ", example: "$Χ$" },
        { label: "Ψ", action: 'greek_Psi', insert: "\\Psi", example: "$\\Psi$" },
        { label: "Ω", action: 'greek_Omega', insert: "\\Omega", example: "$\\Omega$" },
      ],
    },
    {
      label: 'exampleDialog.editor.groups.symbols',
      items: [
        { label: '·', action: 'cdot', insert: '\\cdot', example: '$a\\cdot b$' },
        { label: '×', action: 'times', insert: '\\times', example: '$a\\times b$' },
        { label: '≤', action: 'leq', insert: '\\le', example: '$a\\le b$' },
        { label: '≥', action: 'geq', insert: '\\ge', example: '$a\\ge b$' },
        { label: '≈', action: 'approx', insert: '\\approx', example: '$a\\approx b$' },
        { label: '°', action: 'degree', insert: '^\\circ', example: '$90^\\circ$' },
        { label: 'π', action: 'pi', insert: '\\pi', example: '$\\pi$' },
      ],
    },
  ] as ReadonlyArray<{ label: string; items: ReadonlyArray<EditorToolbarItem> }>;

  get activeEditorToolbarItems(): ReadonlyArray<EditorToolbarItem> {
    return this.editorToolbarGroups[this.activeEditorToolbarGroupIndex]?.items ?? [];
  }

  example: CreateExampleDTO = {
    collectionId: this.data.schoolId,
    type: ExampleTypes.OPEN,
    instruction: '',
    question: '',
    answers: [['', '']] as string[][],
    options: [{ id: this.generateUniqueId(), text: '', correct: false }] as Option[],
    gapFillType: 'SELECT',
    gaps: [],
    assigns: [{ left: '', right: '' }] as Assign[],
    assignRightItems: [''],
    image: '',
    solution: '',
    solutionUrl: '',
    focusList: [],
    variables: [],
    imageWidth: this.defaultImageWidth,
    solutionImageWidth: this.defaultImageWidth,
    folderId: this.data.folderId,
    displaySettings: defaultExampleDisplaySettings
  };

  readonly ExampleTypes = ExampleTypes;
  exampleTypes = Object.values(ExampleTypes) as ExampleTypes[];
  ExampleTypeLabels = ExampleTypeLabels;

  private readonly variablePattern = /\[\[([a-zA-Z_][a-zA-Z0-9_-]*)\]\]/g;

  constructor(
    private dialogRef: MatDialogRef<CreateExampleComponent>,
    private dialog: MatDialog,
    protected snackBar: MatSnackBar
  ) {
    this.dialogRef.disableClose = true;

    this.dialogRef.backdropClick()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.closeDialog());

    this.dialogRef.keydownEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        if (event.key === 'Escape') this.closeDialog();
      });
  }

  private readonly focusSubject = new BehaviorSubject<Focus[]>([]);
  readonly focus$ = this.focusSubject.asObservable();

  private readonly selectedFocusSubject = new BehaviorSubject<Focus[]>([]);
  readonly selectedFocus$ = this.selectedFocusSubject.asObservable();

  inputCtrl = new FormControl<string>('');

  @ViewChild('inputEl') inputEl!: ElementRef<HTMLInputElement>;
  @ViewChild(MatAutocompleteTrigger) autocompleteTrigger!: MatAutocompleteTrigger;

  readonly filteredFocusList = combineLatest([
    this.inputCtrl.valueChanges.pipe(startWith('')),
    this.focus$,
    this.selectedFocus$,
  ]).pipe(
    map(([rawValue, focuses, selected]) => {
      const query = this.normalizeLabel(typeof rawValue === 'string' ? rawValue : '');
      const selectedSet = new Set(selected.map(s => this.normalizeLabel(s.label)));

      return focuses
        .filter(f => !selectedSet.has(this.normalizeLabel(f.label)))
        .filter(f => !query || this.normalizeLabel(f.label).includes(query));
    })
  );


  private revokeObjectUrl(url: string | null): void {
    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  private setConstructionImagePreviewUrl(url: string | null): void {
    this.revokeObjectUrl(this.constructionImagePreviewUrl);
    this.constructionImagePreviewUrl = url;
  }

  private setConstructionSolutionPreviewUrl(url: string | null): void {
    this.revokeObjectUrl(this.constructionSolutionPreviewUrl);
    this.constructionSolutionPreviewUrl = url;
  }

  private async loadStoredConstructionImagePreview(isSolution: boolean): Promise<string | null> {
    if (!this.data.exampleId) {
      return null;
    }

    try {
      return await this.http.getExampleImageObjectUrl(this.data.exampleId, isSolution);
    } catch {
      return null;
    }
  }

  ngOnInit(): void {
    this.isExampleLoading = true;

    this.http.getAllFocus(this.data.schoolId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: focuses => this.focusSubject.next(focuses),
        error: () => this.focusSubject.next([])
      });

    if (this.data.exampleId) {
      this.http.getExample(this.data.exampleId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: async (response) => {
            this.example = {
              ...response,
              imageWidth: response.imageWidth ?? this.defaultImageWidth,
              solutionImageWidth: response.solutionImageWidth ?? this.defaultImageWidth,
              variables: response.variables ?? [],
              displaySettings: {
                ...defaultExampleDisplaySettings,
                ...(response.displaySettings ?? {})
              }
            };
            this.isEditMode = true;

            if (this.data.exampleId) {
              this.setConstructionImagePreviewUrl(
                this.example.type === ExampleTypes.CONSTRUCTION && this.example.image
                  ? await this.loadStoredConstructionImagePreview(false)
                  : null
              );

              this.setConstructionSolutionPreviewUrl(
                this.example.solutionUrl
                  ? await this.loadStoredConstructionImagePreview(true)
                  : null
              );
            }

            this.normalizeLoadedGapState();
            this.syncVariablesFromContent();
            this.emitSelectedFocus();
            this.isExampleLoading = false;
          },
          error: () => {
            this.isExampleLoading = false;
            this.openTranslatedSnack('dialog.backend.actionFailed');
          }
        });
    } else {
      this.normalizeLoadedGapState();
      this.syncVariablesFromContent();
      this.emitSelectedFocus();
      this.isExampleLoading = false;
    }
  }

  ngOnDestroy(): void {
    this.revokeObjectUrl(this.constructionImagePreviewUrl);
    this.revokeObjectUrl(this.constructionSolutionPreviewUrl);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  openTranslatedSnack(messageKey: string, actionKey = 'common.ok', duration = 3000, params?: Record<string, unknown>): void {
    this.snackBar.open(this.t(messageKey, params), this.t(actionKey), { duration });
  }

  generateUniqueId(): string {
    return crypto.randomUUID();
  }

  private normalizeLabel(label: string): string {
    return (label ?? '').trim().toLowerCase();
  }

  private emitSelectedFocus(): void {
    this.selectedFocusSubject.next([...(this.example.focusList ?? [])]);
  }

  private clearFocusInput(): void {
    this.inputCtrl.setValue('');
    if (this.inputEl) this.inputEl.nativeElement.value = '';
  }

  markDirty(): void {
    this.hasUnsavedChanges = true;
  }

  setVariableTarget(target: VariableTarget, event?: Event): void {
    this.activeVariableTarget = target;
    this.captureTextSelection(target, event);
  }

  rememberActiveCursor(event?: Event): void {
    this.captureTextSelection(this.activeVariableTarget, event);
  }

  private captureTextSelection(target: VariableTarget, event?: Event): void {
    if (!target) return;

    const element = (event?.target ?? document.activeElement) as HTMLInputElement | HTMLTextAreaElement | null;
    const isTextElement = !!element && (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT');

    if (!isTextElement) return;

    this.activeTextSelection = {
      targetKey: this.getVariableTargetKey(target),
      start: element.selectionStart ?? 0,
      end: element.selectionEnd ?? element.selectionStart ?? 0
    };
  }

  private getVariableTargetKey(target: VariableTarget): string {
    if (!target) return 'none';

    switch (target.type) {
      case 'instruction':
      case 'question':
      case 'solution':
        return target.type;
      case 'halfOpenAnswer':
        return `${target.type}:${target.index}:${target.answerIndex}`;
      case 'gapOption':
        return `${target.type}:${target.gapIndex}:${target.optionIndex}`;
      default:
        return `${target.type}:${(target as { index: number }).index}`;
    }
  }

  private normalizeVariableKey(key: string | null | undefined): string {
    return (key ?? '').trim();
  }

  private getVariableSourceTexts(): string[] {
    const parts: string[] = [
      this.example.instruction ?? '',
      this.example.question ?? '',
      this.example.solution ?? '',
      ...(this.example.answers ?? []).flatMap(answer => [answer?.[0] ?? '', answer?.[1] ?? '']),
      ...(this.example.options ?? []).map(option => option?.text ?? ''),
      ...(this.example.gaps ?? []).flatMap(gap => [
        gap?.label ?? '',
        gap?.solution ?? '',
        ...((gap?.options ?? []).map(option => option?.text ?? '')),
      ]),
      ...(this.example.assigns ?? []).flatMap(assign => [assign?.left ?? '', assign?.right ?? '']),
      ...(this.example.assignRightItems ?? []),
    ];

    return parts.filter(Boolean);
  }


  private replaceVariables(value: string | null | undefined): string {
    return String(value ?? '').replace(this.variablePattern, (_match, key: string) => {
      const variable = (this.example.variables ?? []).find(entry => entry.key === key.trim());
      return variable?.defaultValue ?? '';
    });
  }


  runEditorToolbarAction(action: EditorToolbarAction): void {
    switch (action) {
      case 'bold':
        this.wrapSelectionOrInsert('**', '**', 'Text');
        break;
      case 'italic':
        this.wrapSelectionOrInsert('*', '*', 'Text');
        break;
      case 'strike':
        this.wrapSelectionOrInsert('~~', '~~', 'Text');
        break;
      case 'inlineCode':
        this.wrapSelectionOrInsert('`', '`', 'Text');
        break;
      case 'proofread':
        this.runProofreadingForActiveTarget();
        break;
      case 'bulletList':
        this.applyLinePrefixOrInsert('- ', 'Text');
        break;
      case 'numberedList':
        this.applyNumberedListOrInsert();
        break;
      case 'inlineFormula':
        this.insertFormulaSnippet('x');
        break;
      case 'displayFormula':
        this.insertDisplayFormulaSnippet('\\frac{}{}');
        break;
      case 'frac':
        this.insertFormulaSnippet('\\frac{}{}');
        break;
      case 'sqrt':
        this.insertFormulaSnippet('\\sqrt{}');
        break;
      case 'nthRoot':
        this.insertFormulaSnippet('\\sqrt[]{}');
        break;
      case 'power':
        this.insertFormulaSnippet('^{}');
        break;
      case 'index':
        this.insertFormulaSnippet('_{}');
        break;
      case 'cdot':
        this.insertFormulaSnippet('\\cdot');
        break;
      case 'times':
        this.insertFormulaSnippet('\\times');
        break;
      case 'leq':
        this.insertFormulaSnippet('\\le');
        break;
      case 'geq':
        this.insertFormulaSnippet('\\ge');
        break;
      case 'approx':
        this.insertFormulaSnippet('\\approx');
        break;
      case 'degree':
        this.insertFormulaSnippet('^\\circ');
        break;
      case 'pi':
        this.insertFormulaSnippet('\\pi');
        break;
      case 'textUnit':
        this.insertFormulaSnippet('\\,\\text{}');
        break;
      case 'sum':
        this.insertFormulaSnippet('\\sum_{}^{}');
        break;
      case 'integral':
        this.insertFormulaSnippet('\\int_{}^{}');
        break;
      case 'vector':
        this.insertFormulaSnippet('\\vec{}');
        break;
      case 'aligned':
        this.insertDisplayFormulaSnippet('\\begin{aligned}\n&= \\\\n&=\n\\end{aligned}');
        break;
      case 'alpha':
        this.insertFormulaSnippet('\\alpha');
        break;
      case 'beta':
        this.insertFormulaSnippet('\\beta');
        break;
      case 'gamma':
        this.insertFormulaSnippet('\\gamma');
        break;
      case 'delta':
        this.insertFormulaSnippet('\\delta');
        break;
      case 'epsilon':
        this.insertFormulaSnippet('\\varepsilon');
        break;
      case 'lambda':
        this.insertFormulaSnippet('\\lambda');
        break;
      case 'mu':
        this.insertFormulaSnippet('\\mu');
        break;
      case 'omega':
        this.insertFormulaSnippet('\\omega');
        break;
      case 'theta':
        this.insertFormulaSnippet('\\theta');
        break;
      case 'sigma':
        this.insertFormulaSnippet('\\sigma');
        break;
      default: {
        const item = this.findToolbarItem(action);
        if (item?.insert) {
          this.insertFormulaSnippet(item.insert);
        }
        break;
      }
    }
  }

  getToolbarTooltip(item: EditorToolbarItem): string {
    const parts: string[] = [];

    if (item.insert) {
      parts.push(`${this.t('exampleDialog.editor.tooltip.insert')}: ${item.insert}`);
    }

    if (item.example) {
      parts.push(`${this.t('exampleDialog.editor.tooltip.example')}: ${item.example}`);
    }

    if (item.shortcut) {
      parts.push(`${this.t('exampleDialog.editor.tooltip.shortcut')}: ${item.shortcut}`);
    }

    if (!parts.length) {
      parts.push(this.t('exampleDialog.editor.tooltip.click'));
    }

    return parts.join('\n');
  }

  private findToolbarItem(action: EditorToolbarAction): EditorToolbarItem | undefined {
    return this.editorToolbarGroups
      .flatMap(group => [...group.items])
      .find(item => item.action === action);
  }

  private runProofreadingForActiveTarget(): void {
    const context = this.getCurrentSelectionContext();
    const target = context?.target ?? this.activeVariableTarget ?? ({ type: 'question' } as VariableTarget);

    if (!target) {
      this.proofreadIssues = [];
      this.proofreadingOpen = true;
      return;
    }

    const targetKey = this.getVariableTargetKey(target);
    const value = context?.value ?? this.getTargetText(target);
    this.proofreadIssues = this.buildProofreadingIssues(value, targetKey);
    this.proofreadingOpen = true;
  }

  closeProofreading(): void {
    this.proofreadingOpen = false;
  }

  applyProofreadingIssue(issue: ProofreadingIssue): void {
    const target = this.resolveVariableTargetFromKey(issue.targetKey);
    if (!target) {
      return;
    }

    const currentValue = this.getTargetText(target);
    const currentSlice = currentValue.slice(issue.start, issue.end);

    if (currentSlice !== issue.original) {
      this.runProofreadingForActiveTarget();
      return;
    }

    const nextValue = currentValue.slice(0, issue.start) + issue.suggestion + currentValue.slice(issue.end);
    this.setTargetText(target, nextValue);
    this.activeVariableTarget = target;
    this.activeTextSelection = {
      targetKey: issue.targetKey,
      start: issue.start + issue.suggestion.length,
      end: issue.start + issue.suggestion.length,
    };
    this.afterTextInsertion(target);
    this.proofreadIssues = this.buildProofreadingIssues(nextValue, issue.targetKey);
  }

  private buildProofreadingIssues(value: string, targetKey: string): ProofreadingIssue[] {
    const issues: ProofreadingIssue[] = [];
    const addIssue = (
      start: number,
      end: number,
      suggestion: string,
      messageKey: string,
      messageParams?: Record<string, unknown>
    ): void => {
      const original = value.slice(start, end);
      if (!original || original === suggestion) return;
      issues.push({
        id: `${targetKey}-${start}-${end}-${issues.length}`,
        targetKey,
        start,
        end,
        original,
        suggestion,
        messageKey,
        messageParams,
      });
    };

    for (const match of value.matchAll(/ {2,}/g)) {
      addIssue(match.index ?? 0, (match.index ?? 0) + match[0].length, ' ', 'exampleDialog.editor.proofreading.messages.doubleSpace');
    }

    for (const match of value.matchAll(/\s+([,.!?;:])/g)) {
      const start = match.index ?? 0;
      addIssue(start, start + match[0].length, match[1], 'exampleDialog.editor.proofreading.messages.spaceBeforePunctuation');
    }

    for (const match of value.matchAll(/([!?.,])\1{1,}/g)) {
      const start = match.index ?? 0;
      addIssue(start, start + match[0].length, match[1], 'exampleDialog.editor.proofreading.messages.repeatedPunctuation');
    }

    const replacements: Record<string, string> = {
      standart: 'Standard',
      Standart: 'Standard',
      nähmlich: 'nämlich',
      Nähmlich: 'Nämlich',
      seperat: 'separat',
      Seperat: 'Separat',
      warscheinlich: 'wahrscheinlich',
      Warscheinlich: 'Wahrscheinlich',
      wider: 'wieder',
      Wiederstand: 'Widerstand',
      wiederstand: 'Widerstand',
      dan: 'dann',
      Dan: 'Dann',
      wier: 'wir',
      Wier: 'Wir',
      bischen: 'bisschen',
      Bischen: 'Bisschen',
      vorraus: 'voraus',
      Vorraus: 'Voraus',
      teh: 'the',
      Teh: 'The',
      recieve: 'receive',
      Recieve: 'Receive',
      seperate: 'separate',
      Seperate: 'Separate',
      occured: 'occurred',
      Occured: 'Occurred',
    };

    const typoPattern = new RegExp(`\\b(${Object.keys(replacements).map(key => this.escapeRegExp(key)).join('|')})\\b`, 'g');
    for (const match of value.matchAll(typoPattern)) {
      const start = match.index ?? 0;
      const original = match[0];
      addIssue(
        start,
        start + original.length,
        replacements[original],
        'exampleDialog.editor.proofreading.messages.commonTypo',
        { original }
      );
    }

    return issues.slice(0, 20);
  }

  getProofreadingIssueMessage(issue: ProofreadingIssue): string {
    return this.t(issue.messageKey, issue.messageParams);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private resolveVariableTargetFromKey(key: string): VariableTarget {
    if (!key) return null;
    const parts = key.split(':');

    switch (parts[0]) {
      case 'instruction':
      case 'question':
      case 'solution':
        return { type: parts[0] as 'instruction' | 'question' | 'solution' };
      case 'halfOpenAnswer':
        return { type: 'halfOpenAnswer', index: Number(parts[1]), answerIndex: Number(parts[2]) as 0 | 1 };
      case 'option':
        return { type: 'option', index: Number(parts[1]) };
      case 'gapSolution':
        return { type: 'gapSolution', index: Number(parts[1]) };
      case 'gapOption':
        return { type: 'gapOption', gapIndex: Number(parts[1]), optionIndex: Number(parts[2]) };
      case 'assignLeft':
        return { type: 'assignLeft', index: Number(parts[1]) };
      case 'assignRight':
        return { type: 'assignRight', index: Number(parts[1]) };
      default:
        return null;
    }
  }

  private getFirstEditableOffset(insertText: string): number {
    const curlyIndex = insertText.indexOf('{}');
    if (curlyIndex >= 0) {
      return curlyIndex + 1;
    }

    const squareIndex = insertText.indexOf('[]');
    if (squareIndex >= 0) {
      return squareIndex + 1;
    }

    const textIndex = insertText.indexOf('Text');
    if (textIndex >= 0) {
      return textIndex;
    }

    return insertText.length;
  }

  private getFirstEditableRange(insertText: string): { start: number; end: number } {
    const textIndex = insertText.indexOf('Text');
    if (textIndex >= 0) {
      return { start: textIndex, end: textIndex + 'Text'.length };
    }

    const offset = this.getFirstEditableOffset(insertText);
    return { start: offset, end: offset };
  }

  private insertFormulaSnippet(snippet: string): void {
    const selection = this.getCurrentSelectionContext();
    const insertText = selection && this.isSelectionInsideLatex(selection)
      ? snippet
      : `$${snippet}$`;

    this.insertTextAtActiveTarget(insertText, this.getFirstEditableRange(insertText));
  }

  private insertDisplayFormulaSnippet(snippet: string): void {
    const selection = this.getCurrentSelectionContext();

    if (selection && this.isSelectionInsideLatex(selection)) {
      this.insertTextAtActiveTarget(snippet, this.getFirstEditableRange(snippet));
      return;
    }

    const insertText = `\n$$\n${snippet}\n$$\n`;
    this.insertTextAtActiveTarget(insertText, this.getFirstEditableRange(insertText));
  }

  private isSelectionInsideLatex(selection: { value: string; start: number; end: number }): boolean {
    const index = selection.start;
    const source = selection.value ?? '';
    const mathPattern = /\$\$[\s\S]*?\$\$|\$[^$\n]*?\$/g;
    let match: RegExpExecArray | null;

    while ((match = mathPattern.exec(source)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (index > start && index < end) {
        return true;
      }
    }

    return false;
  }

  private insertLineSnippet(snippet: string): void {
    this.insertTextAtActiveTarget(`\n${snippet}\n`);
  }

  private applyLinePrefixOrInsert(prefix: string, placeholder: string): void {
    const selection = this.getCurrentSelectionContext();

    if (!selection) {
      this.insertLineSnippet(`${prefix}${placeholder}`);
      return;
    }

    const selectedText = selection.value.slice(selection.start, selection.end) || placeholder;
    const lineText = selectedText
      .split('\n')
      .map(line => line.trim() ? `${prefix}${line}` : prefix.trimEnd())
      .join('\n');

    this.replaceSelectionContext(selection, lineText, selection.start + lineText.length, selection.start + lineText.length);
  }

  private applyNumberedListOrInsert(): void {
    const selection = this.getCurrentSelectionContext();

    if (!selection) {
      this.insertLineSnippet('1. Text');
      return;
    }

    const selectedText = selection.value.slice(selection.start, selection.end) || 'Text';
    const lineText = selectedText
      .split('\n')
      .map((line, index) => `${index + 1}. ${line.trim() || 'Text'}`)
      .join('\n');

    this.replaceSelectionContext(selection, lineText, selection.start + lineText.length, selection.start + lineText.length);
  }

  private getCurrentSelectionContext(): {
    element: HTMLInputElement | HTMLTextAreaElement | null;
    target: VariableTarget;
    value: string;
    start: number;
    end: number;
  } | null {
    const activeElement = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    const canUseCursor = !!activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT');

    if (canUseCursor) {
      return {
        element: activeElement,
        target: this.activeVariableTarget,
        value: activeElement.value ?? '',
        start: activeElement.selectionStart ?? 0,
        end: activeElement.selectionEnd ?? activeElement.selectionStart ?? 0,
      };
    }

    const target = this.activeVariableTarget;
    if (!target || !this.activeTextSelection || this.activeTextSelection.targetKey !== this.getVariableTargetKey(target)) {
      return null;
    }

    const value = this.getTargetText(target);
    return {
      element: null,
      target,
      value,
      start: Math.min(this.activeTextSelection.start, value.length),
      end: Math.min(this.activeTextSelection.end, value.length),
    };
  }

  private replaceSelectionContext(
    selection: {
      element: HTMLInputElement | HTMLTextAreaElement | null;
      target: VariableTarget;
      value: string;
      start: number;
      end: number;
    },
    insertText: string,
    nextStart: number,
    nextEnd: number
  ): void {
    const nextValue = selection.value.slice(0, selection.start) + insertText + selection.value.slice(selection.end);

    if (selection.element) {
      selection.element.value = nextValue;
      selection.element.dispatchEvent(new Event('input', { bubbles: true }));
      requestAnimationFrame(() => {
        selection.element?.focus();
        selection.element?.setSelectionRange(nextStart, nextEnd);
      });
    } else if (selection.target) {
      this.setTargetText(selection.target, nextValue);
      this.activeTextSelection = {
        targetKey: this.getVariableTargetKey(selection.target),
        start: nextStart,
        end: nextEnd
      };
    }

    this.afterTextInsertion(selection.target);
  }

  private wrapSelectionOrInsert(prefix: string, suffix: string, placeholder: string): void {
    const selection = this.getCurrentSelectionContext();

    if (!selection) {
      this.insertTextAtActiveTarget(`${prefix}${placeholder}${suffix}`);
      return;
    }

    const selectedText = selection.value.slice(selection.start, selection.end) || placeholder;
    const insertText = `${prefix}${selectedText}${suffix}`;
    const selectionStart = selection.start + prefix.length;
    const selectionEnd = selectionStart + selectedText.length;

    this.replaceSelectionContext(selection, insertText, selectionStart, selectionEnd);
  }

  syncVariablesFromContent(): void {
    const previousMap = new Map(
      (this.example.variables ?? []).map(variable => [this.normalizeVariableKey(variable.key), variable])
    );

    const keysInOrder: string[] = [];

    for (const sourceText of this.getVariableSourceTexts()) {
      for (const match of sourceText.matchAll(this.variablePattern)) {
        const normalizedKey = this.normalizeVariableKey(match[1]);
        if (!normalizedKey || keysInOrder.includes(normalizedKey)) {
          continue;
        }
        keysInOrder.push(normalizedKey);
      }
    }

    this.example.variables = keysInOrder.map(key => {
      const existing = previousMap.get(key);
      return {
        id: existing?.id || this.generateUniqueId(),
        key,
        defaultValue: existing?.defaultValue ?? ''
      } as ExampleVariable;
    });
  }

  trackByVariableKey(index: number, variable: ExampleVariable): string {
    return variable.key || String(index);
  }

  private getNextVariablePlaceholder(): string {
    const usedKeys = new Set((this.example.variables ?? []).map(variable => variable.key));
    let nextIndex = Math.max(1, (this.example.variables?.length ?? 0) + 1);
    let nextKey = `wert${nextIndex}`;

    while (usedKeys.has(nextKey)) {
      nextIndex += 1;
      nextKey = `wert${nextIndex}`;
    }

    return `[[${nextKey}]]`;
  }

  private appendInsertText(value: string | null | undefined, insertText: string): string {
    return `${value ?? ''}${insertText}`;
  }


  insertExistingVariableAtCursor(variableKey: string): void {
    if (!variableKey) {
      return;
    }

    this.insertTextAtActiveTarget(`[[${variableKey}]]`);
  }

  private insertTextAtActiveTarget(insertText: string, cursorRange?: { start: number; end: number }): void {
    const selection = this.getCurrentSelectionContext();
    const range = cursorRange ?? { start: insertText.length, end: insertText.length };

    if (selection) {
      this.replaceSelectionContext(
        selection,
        insertText,
        selection.start + range.start,
        selection.start + range.end
      );
      return;
    }

    const target = this.activeVariableTarget ?? ({ type: 'question' } as VariableTarget);

    if (target) {
      const currentValue = this.getTargetText(target);
      const insertionStart = currentValue.length;
      this.setTargetText(target, this.appendInsertText(currentValue, insertText));
      this.activeTextSelection = {
        targetKey: this.getVariableTargetKey(target),
        start: insertionStart + range.start,
        end: insertionStart + range.end
      };
      this.afterTextInsertion(target);
    }
  }

  insertVariableAtCursor(): void {
    this.variablesCollapsed = false;
    this.insertTextAtActiveTarget(this.getNextVariablePlaceholder());
  }

  private getTargetText(target: VariableTarget): string {
    switch (target?.type) {
      case 'instruction':
        return this.example.instruction ?? '';
      case 'question':
        return this.example.question ?? '';
      case 'solution':
        return this.example.solution ?? '';
      case 'halfOpenAnswer':
        return this.example.answers?.[target.index]?.[target.answerIndex] ?? '';
      case 'option':
        return this.example.options?.[target.index]?.text ?? '';
      case 'gapSolution':
        return this.example.gaps?.[target.index]?.solution ?? '';
      case 'gapOption':
        return this.example.gaps?.[target.gapIndex]?.options?.[target.optionIndex]?.text ?? '';
      case 'assignLeft':
        return this.example.assigns?.[target.index]?.left ?? '';
      case 'assignRight':
        return this.example.assignRightItems?.[target.index] ?? '';
      default:
        return this.example.question ?? '';
    }
  }

  private setTargetText(target: VariableTarget, value: string): void {
    switch (target?.type) {
      case 'instruction':
        this.example.instruction = value;
        break;
      case 'question':
        this.example.question = value;
        break;
      case 'solution':
        this.example.solution = value;
        break;
      case 'halfOpenAnswer': {
        const row = this.example.answers?.[target.index];
        if (row) row[target.answerIndex] = value;
        break;
      }
      case 'option': {
        const option = this.example.options?.[target.index];
        if (option) option.text = value;
        break;
      }
      case 'gapSolution': {
        const gap = this.example.gaps?.[target.index];
        if (gap) gap.solution = value;
        break;
      }
      case 'gapOption': {
        const option = this.example.gaps?.[target.gapIndex]?.options?.[target.optionIndex];
        if (option) option.text = value;
        break;
      }
      case 'assignLeft': {
        const assign = this.example.assigns?.[target.index];
        if (assign) assign.left = value;
        break;
      }
      case 'assignRight':
        if (this.example.assignRightItems?.[target.index] != null) {
          this.example.assignRightItems[target.index] = value;
        }
        break;
      default:
        this.example.question = value;
        break;
    }
  }

  private afterTextInsertion(target: VariableTarget): void {
    this.syncVariablesFromContent();

    if (target?.type === 'question' && this.example.type === ExampleTypes.GAP_FILL) {
      this.updateGapsFromText();
    }

    this.markDirty();
  }

  removeVariable(variable: ExampleVariable): void {
    const key = this.normalizeVariableKey(variable?.key);
    if (!key) return;

    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\{${escapedKey}\\}`, 'g');

    const replaceValue = (value: string | null | undefined): string =>
      (value ?? '').replace(pattern, '');

    this.example.instruction = replaceValue(this.example.instruction);
    this.example.question = replaceValue(this.example.question);
    this.example.solution = replaceValue(this.example.solution);

    this.example.answers = (this.example.answers ?? []).map(answer => [
      replaceValue(answer?.[0]),
      replaceValue(answer?.[1]),
    ]);

    this.example.options = (this.example.options ?? []).map(option => ({
      ...option,
      text: replaceValue(option?.text),
    }));

    this.example.gaps = (this.example.gaps ?? []).map(gap => ({
      ...gap,
      label: replaceValue(gap?.label),
      solution: replaceValue(gap?.solution),
      options: (gap?.options ?? []).map(option => ({
        ...option,
        text: replaceValue(option?.text),
      })),
    }));

    this.example.assigns = (this.example.assigns ?? []).map(assign => ({
      ...assign,
      left: replaceValue(assign?.left),
      right: replaceValue(assign?.right),
    }));

    this.example.assignRightItems = (this.example.assignRightItems ?? []).map(item => replaceValue(item));
    this.example.variables = (this.example.variables ?? []).filter(entry => this.normalizeVariableKey(entry.key) !== key);
    this.activeVariableTarget = null;

    this.syncVariablesFromContent();
    this.markDirty();
  }

  getResolvedTextWithDefaults(value: string | null | undefined): string {
    return this.replaceVariables(value);
  }

  addOption(): void {
    this.example.options.push({ id: this.generateUniqueId(), text: '', correct: false });
    this.markDirty();
  }

  removeOption(i: number): void {
    if (this.example.options.length <= 0) return;
    this.example.options.splice(i, 1);
    this.syncVariablesFromContent();
    this.markDirty();
  }

  addHalfOpenAnswer(): void {
    this.example.answers.push(['', '']);
    this.markDirty();
  }

  removeHalfOpenAnswer(i: number): void {
    if (this.example.answers.length <= 0) return;
    this.example.answers.splice(i, 1);
    this.syncVariablesFromContent();
    this.markDirty();
  }

  addAssignLeftItem(): void {
    this.example.assigns.push({ left: '', right: '' });
    this.markDirty();
  }

  removeAssignLeftItem(i: number): void {
    this.example.assigns.splice(i, 1);
    this.syncVariablesFromContent();
    this.markDirty();
  }

  addAssignRightItem(): void {
    this.example.assignRightItems.push('');
    this.markDirty();
  }

  removeAssignRightItem(i: number): void {
    this.example.assignRightItems.splice(i, 1);
    this.syncVariablesFromContent();
    this.markDirty();
  }

  setAssignConnection(assign: Assign, rightValue: string | null): void {
    assign.right = rightValue || '';
    this.syncVariablesFromContent();
    this.markDirty();
  }

  getLetter(i: number): string {
    return String.fromCharCode(65 + i);
  }

  updateGapsFromText(): void {
    const regex = /\{(\d+)\}/g;
    const matches = Array.from(this.example.question.matchAll(regex));

    const oldGaps = [...this.example.gaps];
    const newGaps: Gap[] = [];

    matches.forEach(match => {
      const gapIndex = Number(match[1]) - 1;
      const existing = oldGaps[gapIndex] as (Gap & { width?: number }) | undefined;

      if (existing) {
        newGaps.push({
          ...existing,
          width: this.normalizeGapWidth(existing.width, existing.solution)
        } as Gap);
      } else {
        newGaps.push({
          id: this.generateUniqueId(),
          label: '',
          solution: '',
          width: this.getDefaultGapWidth(''),
          options: this.example.gapFillType === 'SELECT'
            ? [{ id: this.generateUniqueId(), text: '', correct: false }]
            : []
        } as Gap);
      }
    });

    this.example.gaps = newGaps;
  }

  insertGapAtCursor(): void {
    const textarea = document.querySelector('textarea[name="question"]') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    const value = textarea.value ?? '';

    const nextIdx = (value.match(/\{(\d+)\}/g)?.length ?? 0) + 1;
    const gapText = `{${nextIdx}}`;

    textarea.value = value.slice(0, start) + gapText + value.slice(end);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    this.markDirty();
    this.updateGapsFromText();
  }

  onGapFillTypeChange(type: 'SELECT' | 'INPUT'): void {
    this.example.gapFillType = type;
    this.syncVariablesFromContent();
    this.updateGapsFromText();

    if (type === 'INPUT') {
      this.example.gaps.forEach(gap => this.ensureGapWidth(gap));
    }

    this.markDirty();
  }

  private escapeHtml(value: string): string {
    return (value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>');
  }

  getQuestionPreviewHtml(): SafeHtml {
    const escapedQuestion = this.escapeHtml(this.getResolvedTextWithDefaults(this.example.question || ''));
    let idx = 0;

    const html = escapedQuestion.replace(/\{\d+\}/g, () => {
      const gap = this.example.gaps[idx];
      const gapNumber = this.escapeHtml(this.getGapNumber(idx));
      const width = gap ? this.getGapWidth(gap) : this.getDefaultGapWidth('');
      idx++;

      if (this.example.gapFillType === 'INPUT') {
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

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  getGapNumber(index: number): string {
    return String(index + 1);
  }

  private getGapWidthValue(gap: Gap): number | undefined {
    const width = Number((gap as Gap & { width?: number }).width);
    return Number.isFinite(width) ? width : undefined;
  }

  private setGapWidthValue(gap: Gap, width: number): void {
    (gap as Gap & { width?: number }).width = width;
  }

  private getDefaultGapWidth(solution: string | null | undefined): number {
    const solutionLength = (solution ?? '').trim().length;
    const estimated = 90 + solutionLength * 9;
    return Math.max(90, Math.min(420, estimated));
  }

  private normalizeGapWidth(value: number | null | undefined, solution: string | null | undefined): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return this.getDefaultGapWidth(solution);
    }

    return Math.max(90, Math.min(420, Math.round(parsed)));
  }

  ensureGapWidth(gap: Gap): void {
    this.setGapWidthValue(gap, this.normalizeGapWidth(this.getGapWidthValue(gap), gap.solution));
  }

  getGapWidth(gap: Gap): number {
    const normalized = this.normalizeGapWidth(this.getGapWidthValue(gap), gap.solution);

    if (this.getGapWidthValue(gap) !== normalized) {
      this.setGapWidthValue(gap, normalized);
    }

    return normalized;
  }

  setGapWidth(gap: Gap, value: number | string | null): void {
    const normalized = this.normalizeGapWidth(value as number | null | undefined, gap.solution);
    this.setGapWidthValue(gap, normalized);
    this.markDirty();
  }

  onGapSolutionChange(gap: Gap): void {
    const currentWidth = this.getGapWidthValue(gap);
    const normalizedCurrentWidth = this.normalizeGapWidth(currentWidth, '');
    const autoWidth = this.getDefaultGapWidth(gap.solution);

    if (currentWidth === undefined || normalizedCurrentWidth === this.getDefaultGapWidth('')) {
      this.setGapWidthValue(gap, autoWidth);
    } else {
      this.setGapWidthValue(gap, this.normalizeGapWidth(currentWidth, gap.solution));
    }

    this.syncVariablesFromContent();
    this.markDirty();
  }

  private normalizeLoadedGapState(): void {
    this.example.gaps = (this.example.gaps ?? []).map(gap => {
      const normalizedGap = { ...gap } as Gap;

      if (this.example.gapFillType === 'INPUT') {
        this.setGapWidthValue(normalizedGap, this.normalizeGapWidth(this.getGapWidthValue(normalizedGap), normalizedGap.solution));
      }

      return normalizedGap;
    });
  }

  setDragState(type: 'preview' | 'solution', active: boolean): void {
    if (type === 'preview') {
      this.isDraggingConstructionPreview = active;
      return;
    }

    this.isDraggingConstructionSolution = active;
  }

  onFileDrop(event: DragEvent, type: 'preview' | 'solution'): void {
    event.preventDefault();
    event.stopPropagation();
    this.setDragState(type, false);

    const file = event.dataTransfer?.files?.[0] ?? null;
    if (!file) {
      return;
    }

    const input = { files: event.dataTransfer?.files ?? null, value: '' } as HTMLInputElement;
    this.onImageSelected({ target: input } as unknown as Event, type);
  }

  addGapOption(gi: number): void {
    this.example.gaps[gi].options = this.example.gaps[gi].options || [];
    this.example.gaps[gi].options.push({ id: this.generateUniqueId(), text: '', correct: false });
    this.markDirty();
  }

  removeGapOption(gi: number, oi: number): void {
    this.example.gaps[gi].options.splice(oi, 1);
    this.syncVariablesFromContent();
    this.markDirty();
  }

  async onImageSelected(event: Event, type: 'solution' | 'preview'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) return;

    await this.handleConstructionImageFile(file, type);
    input.value = '';
  }

  async onImageDropped(event: { file: File; kind: 'solution' | 'preview' }): Promise<void> {
    await this.handleConstructionImageFile(event.file, event.kind);
  }

  private async handleConstructionImageFile(file: File, type: 'solution' | 'preview'): Promise<void> {
    if (!this.allowedImageTypes.includes(file.type)) {
      this.openTranslatedSnack('exampleDialog.snackbar.invalidImageType');
      return;
    }

    if (file.size > this.maxImageBytes) {
      this.openTranslatedSnack('exampleDialog.snackbar.imageSizeError', 'common.ok', 3000, { maxSizeMb: 2 });
      return;
    }

    const compressed = await this.compressImage(file, 512, 0.72);

    const reader = new FileReader();
    reader.onload = () => {
      if (type === 'solution') {
        this.selectedConstructionSolutionFile = compressed;
        this.setConstructionSolutionPreviewUrl(reader.result as string);
      } else {
        this.selectedConstructionImageFile = compressed;
        this.setConstructionImagePreviewUrl(reader.result as string);
      }
      this.markDirty();
    };

    reader.readAsDataURL(compressed);
  }

  async removeSelectedImage(type: 'solution' | 'preview'): Promise<void> {
    if (type === 'solution') {
      if (this.selectedConstructionSolutionFile) {
        this.selectedConstructionSolutionFile = null;
        this.setConstructionSolutionPreviewUrl(
          this.isEditMode && this.data.exampleId && this.example.solutionUrl
            ? await this.loadStoredConstructionImagePreview(true)
            : null
        );
        this.markDirty();
        return;
      }

      if (this.isEditMode && this.data.exampleId && this.constructionSolutionPreviewUrl) {
        try {
          await firstValueFrom(this.http.deleteExampleImage(this.data.exampleId, true));
          this.setConstructionSolutionPreviewUrl(null);
          this.example.solutionUrl = '';
          this.example.solutionImageWidth = this.defaultImageWidth;
          this.markDirty();
          this.openTranslatedSnack('exampleDialog.snackbar.solutionImageDeleted', 'common.ok', 2500);
          return;
        } catch {
          this.openTranslatedSnack('exampleDialog.snackbar.solutionImageDeleteError');
          return;
        }
      }

      this.setConstructionSolutionPreviewUrl(null);
      this.example.solutionUrl = '';
      this.example.solutionImageWidth = this.defaultImageWidth;
      this.markDirty();
      return;
    }

    if (this.selectedConstructionImageFile) {
      this.selectedConstructionImageFile = null;
      this.setConstructionImagePreviewUrl(
        this.isEditMode && this.data.exampleId && this.example.image
          ? await this.loadStoredConstructionImagePreview(false)
          : null
      );
      this.markDirty();
      return;
    }

    if (this.isEditMode && this.data.exampleId && this.constructionImagePreviewUrl) {
      try {
        await firstValueFrom(this.http.deleteExampleImage(this.data.exampleId, false));
        this.setConstructionImagePreviewUrl(null);
        this.example.image = '';
        this.example.imageWidth = this.defaultImageWidth;
        this.markDirty();
        this.openTranslatedSnack('exampleDialog.snackbar.taskImageDeleted', 'common.ok', 2500);
        return;
      } catch {
        this.openTranslatedSnack('exampleDialog.snackbar.taskImageDeleteError');
        return;
      }
    }

    this.setConstructionImagePreviewUrl(null);
    this.example.image = '';
    this.example.imageWidth = this.defaultImageWidth;
    this.markDirty();
  }

  private buildExamplePayload(): CreateExampleDTO {
    return {
      ...this.example,
      collectionId: this.example.collectionId || this.data.schoolId,
      image: this.isEditMode ? (this.example.image || '') : '',
      solutionUrl: this.isEditMode ? (this.example.solutionUrl || '') : '',
      variables: (this.example.variables ?? []).map(variable => ({
        id: variable.id || this.generateUniqueId(),
        key: this.normalizeVariableKey(variable.key),
        defaultValue: variable.defaultValue ?? ''
      })).filter(variable => !!variable.key),
      imageWidth: this.normalizeImageWidth(this.example.imageWidth),
      solutionImageWidth: this.normalizeImageWidth(this.example.solutionImageWidth)
    };
  }

  private normalizeImageWidth(value: number | null | undefined): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return this.defaultImageWidth;
    }
    return Math.max(80, Math.min(1200, Math.round(parsed)));
  }

  private async uploadConstructionAssets(exampleId: string): Promise<void> {
    if (this.example.type === ExampleTypes.CONSTRUCTION && this.selectedConstructionImageFile) {
      const imageKey = await firstValueFrom(this.http.uploadExampleImage(exampleId, this.selectedConstructionImageFile, false));
      this.example.image = imageKey || this.example.image || '';
    }

    if ((this.example.type === ExampleTypes.OPEN || this.example.type === ExampleTypes.CONSTRUCTION) && this.selectedConstructionSolutionFile) {
      const solutionKey = await firstValueFrom(this.http.uploadExampleImage(exampleId, this.selectedConstructionSolutionFile, true));
      this.example.solutionUrl = solutionKey || this.example.solutionUrl || '';
    }

    this.selectedConstructionImageFile = null;
    this.selectedConstructionSolutionFile = null;

    this.setConstructionImagePreviewUrl(
      this.example.type === ExampleTypes.CONSTRUCTION && this.example.image
        ? await this.http.getExampleImageObjectUrl(exampleId, false)
        : null
    );

    this.setConstructionSolutionPreviewUrl(
      this.example.solutionUrl
        ? await this.http.getExampleImageObjectUrl(exampleId, true)
        : null
    );
  }


  getTextLength(value: string | null | undefined): number {
    return value?.length ?? 0;
  }

  shouldShowTextLimitHint(value: string | null | undefined, max: number): boolean {
    const length = this.getTextLength(value);
    if (length <= 0) {
      return false;
    }

    const threshold = max <= 500 ? Math.floor(max * 0.8) : Math.floor(max * 0.9);
    return length >= threshold;
  }


  private isOverLimit(value: string | null | undefined, max: number): boolean {
    return this.getTextLength(value) > max;
  }

  private showTextLimitSnack(label: string, max: number): void {
    this.openTranslatedSnack('exampleDialog.snackbar.textLimitExceeded', 'common.ok', 3500, { label, max });
  }

  private validateTextLimits(): boolean {
    const checks: Array<{ label: string; value: string | null | undefined; max: number }> = [
      { label: this.t('collection.instruction'), value: this.example.instruction, max: this.textLimits.instruction },
      { label: this.t('collection.question'), value: this.example.question, max: this.textLimits.question },
      { label: this.t('exampleDialog.solution'), value: this.example.solution, max: this.textLimits.solution },
      ...((this.example.answers ?? []).flatMap((answer, index) => [
        { label: `${this.t('exampleDialog.answer')} ${index + 1}`, value: answer?.[0], max: this.textLimits.halfOpenAnswer },
        { label: `${this.t('exampleDialog.correctSolution')} ${index + 1}`, value: answer?.[1], max: this.textLimits.halfOpenCorrectAnswer },
      ])),
      ...((this.example.options ?? []).map((option, index) => ({
        label: `${this.t('exampleDialog.option')} ${index + 1}`,
        value: option?.text,
        max: this.textLimits.option,
      }))),
      ...((this.example.gaps ?? []).flatMap((gap, gapIndex) => [
        { label: `${this.t('exampleDialog.correctAnswer')} ${gapIndex + 1}`, value: gap?.solution, max: this.textLimits.gapSolution },
        ...((gap?.options ?? []).map((option, optionIndex) => ({
          label: `${this.t('exampleDialog.answerOption')} ${gapIndex + 1}.${optionIndex + 1}`,
          value: option?.text,
          max: this.textLimits.gapOption,
        }))),
      ])),
      ...((this.example.assigns ?? []).map((assign, index) => ({
        label: `${this.t('exampleDialog.assignLeftColumn')} ${index + 1}`,
        value: assign?.left,
        max: this.textLimits.assignLeft,
      }))),
      ...((this.example.assignRightItems ?? []).map((right, index) => ({
        label: `${this.t('exampleDialog.assignRightColumn')} ${index + 1}`,
        value: right,
        max: this.textLimits.assignRight,
      }))),
      ...((this.example.variables ?? []).map((variable) => ({
        label: `${this.t('exampleDialog.variables.defaultValue')} ${variable.key}`,
        value: variable.defaultValue,
        max: this.textLimits.variableDefaultValue,
      }))),
    ];

    const invalid = checks.find(check => this.isOverLimit(check.value, check.max));
    if (!invalid) {
      return true;
    }

    this.showTextLimitSnack(invalid.label, invalid.max);
    return false;
  }

  async saveExample(): Promise<void> {
    this.syncVariablesFromContent();

    if (!this.validateTextLimits()) {
      return;
    }

    if (!this.example.instruction.trim()) {
      this.openTranslatedSnack('exampleDialog.snackbar.fillInstructionAndQuestion');
      return;
    }

    if (this.isSaving) {
      return;
    }

    if (this.example.type === ExampleTypes.CONSTRUCTION && !this.isEditMode && !this.selectedConstructionImageFile) {
      this.openTranslatedSnack('exampleDialog.snackbar.selectTaskImageFirst');
      return;
    }

    this.isSaving = true;

    try {
      const payload = this.buildExamplePayload();

      if (this.isEditMode) {
        const updatedIdRaw = await firstValueFrom(this.http.updateExample(this.data.exampleId, payload));
        const updatedId = updatedIdRaw || this.data.exampleId;

        if (this.example.type === ExampleTypes.OPEN || this.example.type === ExampleTypes.CONSTRUCTION) {
          await this.uploadConstructionAssets(updatedId as string);
        }

        this.openTranslatedSnack('exampleDialog.snackbar.saved');
      } else {
        const createdId = await firstValueFrom(this.http.createExample(payload)) as string;

        if (!createdId) {
          throw new Error('Example-ID fehlt nach dem Erstellen.');
        }

        if (this.example.type === ExampleTypes.OPEN || this.example.type === ExampleTypes.CONSTRUCTION) {
          await this.uploadConstructionAssets(createdId);
        }

        this.openTranslatedSnack('exampleDialog.snackbar.created');
      }

      this.hasUnsavedChanges = false;
      this.dialogRef.close(true);
    } catch (error) {
      console.error(error);
      this.openTranslatedSnack('exampleDialog.snackbar.saveError', 'common.ok', 3500);
    } finally {
      this.isSaving = false;
    }
  }

  async closeDialog(): Promise<void> {
    if (this.hasUnsavedChanges) {
      const confirmRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: this.t('exampleDialog.closeDialog.title'),
          message: this.t('exampleDialog.closeDialog.message'),
          cancelText: this.t('exampleDialog.closeDialog.cancel'),
          confirmText: this.t('exampleDialog.closeDialog.confirm')
        }
      });

      const confirmed = await firstValueFrom(confirmRef.afterClosed());
      if (!confirmed) return;
    }

    this.dialogRef.close();
  }

  private isEditorTextInputActive(): boolean {
    const activeElement = document.activeElement as HTMLElement | null;
    if (!activeElement) {
      return false;
    }

    return activeElement.tagName === 'TEXTAREA'
      || activeElement.tagName === 'INPUT';
  }

  @HostListener('document:keydown', ['$event'])
  handleEditorShortcuts(event: KeyboardEvent): void {
    if (!this.isEditorTextInputActive()) {
      return;
    }

    const key = event.key.toLowerCase();
    const hasCtrl = event.ctrlKey || event.metaKey;
    const isAltOnly = event.altKey && !event.ctrlKey && !event.metaKey;

    const shortcutMap: Array<{ matches: boolean; action: EditorToolbarAction }> = [
      { matches: hasCtrl && !event.altKey && key === 'b' && !event.shiftKey, action: 'bold' },
      { matches: hasCtrl && !event.altKey && key === 'i' && !event.shiftKey, action: 'italic' },
      { matches: hasCtrl && !event.altKey && key === 'm' && !event.shiftKey, action: 'inlineFormula' },
      { matches: isAltOnly && (key === '+' || key === '='), action: 'power' },
      { matches: isAltOnly && key === '-', action: 'index' },
    ];

    const shortcut = shortcutMap.find(entry => entry.matches);
    if (!shortcut) {
      return;
    }

    event.preventDefault();
    this.runEditorToolbarAction(shortcut.action);
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByOptionId(index: number, option: Option): string {
    return option.id;
  }

  trackByGapId(index: number, gap: Gap): string {
    return gap.id;
  }

  getQuestionWithGapLabels(): string {
    let idx = 0;
    return this.getResolvedTextWithDefaults(this.example.question).replace(/\{\d+\}/g, () => {
      idx++;
      return `[${idx}]`;
    });
  }

  getTooltip(t: ExampleTypes): string {
    switch (t) {
      case ExampleTypes.OPEN:
        return this.t('exampleTypeDescriptions.open');
      case ExampleTypes.HALF_OPEN:
        return this.t('exampleTypeDescriptions.halfOpen');
      case ExampleTypes.CONSTRUCTION:
        return this.t('exampleTypeDescriptions.construction');
      case ExampleTypes.MULTIPLE_CHOICE:
        return this.t('exampleTypeDescriptions.multipleChoice');
      case ExampleTypes.GAP_FILL:
        return this.t('exampleTypeDescriptions.gapFill');
      case ExampleTypes.ASSIGN:
        return this.t('exampleTypeDescriptions.assign');
      default:
        return '';
    }
  }

  showCreateOption(value: string | Focus | null): boolean {
    if (!value) return false;

    const label = this.normalizeLabel(typeof value === 'string' ? value : value.label);
    if (!label) return false;

    const existsInCatalog = this.focusSubject.value.some(f => this.normalizeLabel(f.label) === label);
    const alreadySelected = this.example.focusList.some(f => this.normalizeLabel(f.label) === label);

    return !existsInCatalog && !alreadySelected;
  }

  selected(event: MatAutocompleteSelectedEvent): void {
    const opt = event.option.value as Focus | string;

    const value: Focus =
      typeof opt === 'string'
        ? { id: '', label: opt }
        : { id: opt.id, label: opt.label };

    this.addFocus(value);
    this.autocompleteTrigger.closePanel();
  }

  addFromInput(event: MatChipInputEvent): void {
    if (this.autocompleteTrigger?.panelOpen) return;

    const raw = (event.value ?? '').toString();
    const label = raw.trim();
    if (!label) return;

    this.addFocus({ id: '', label });
    event.chipInput?.clear();
  }

  remove(focus: Focus): void {
    const removeLabel = this.normalizeLabel(focus.label);
    this.example.focusList = this.example.focusList.filter(f => this.normalizeLabel(f.label) !== removeLabel);

    this.emitSelectedFocus();
    this.markDirty();
  }

  private addFocus(value: Focus): void {
    const label = this.normalizeLabel(value.label);
    if (!label) {
      this.clearFocusInput();
      return;
    }

    if (this.example.focusList.some(f => this.normalizeLabel(f.label) === label)) {
      this.clearFocusInput();
      return;
    }

    const existing = this.focusSubject.value.find(f => this.normalizeLabel(f.label) === label);
    const focusToAdd: Focus = existing ? existing : { id: '', label: value.label.trim() };

    this.example.focusList.push(focusToAdd);

    this.emitSelectedFocus();
    this.markDirty();

    if (!existing) {
      const optimistic: Focus = { id: '', label: focusToAdd.label };
      this.focusSubject.next([...this.focusSubject.value, optimistic]);

      this.http.createFocus(this.data.schoolId, { id: '', label: focusToAdd.label })
        .pipe(takeUntil(this.destroy$))
        .subscribe(createdFocus => {
          const selIdx = this.example.focusList.findIndex(f => this.normalizeLabel(f.label) === this.normalizeLabel(createdFocus.label));
          if (selIdx !== -1) {
            this.example.focusList[selIdx] = createdFocus;
            this.emitSelectedFocus();
          }

          const catalog = [...this.focusSubject.value];
          const catIdx = catalog.findIndex(f => this.normalizeLabel(f.label) === this.normalizeLabel(createdFocus.label));
          if (catIdx !== -1) {
            catalog[catIdx] = createdFocus;
            this.focusSubject.next(catalog);
          }
        });
    }

    this.clearFocusInput();
  }

  deleteFocus(focus: Focus, event: MouseEvent): void {
    event.stopPropagation();

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.t('exampleDialog.deleteFocusDialog.title'),
        message: this.t('exampleDialog.deleteFocusDialog.message'),
        cancelText: this.t('common.cancel'),
        confirmText: this.t('common.delete'),
        requireConfirmation: true,
        confirmationText: this.t('exampleDialog.deleteFocusDialog.confirmationText')
      },
    }).afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (!result) return;

        this.http.deleteFocus(this.data.schoolId, focus.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => {
            this.openTranslatedSnack('exampleDialog.snackbar.focusDeleted', 'common.ok', 3000, { label: focus.label });
          });

        this.focusSubject.next(this.focusSubject.value.filter(f => f.id !== focus.id));

        const removedLabel = this.normalizeLabel(focus.label);
        this.example.focusList = this.example.focusList.filter(f => this.normalizeLabel(f.label) !== removedLabel);

        this.emitSelectedFocus();
        this.markDirty();
      });
  }

  onTypeChange(type: ExampleTypes): void {
    this.example.type = type;
    this.syncVariablesFromContent();

    if (type === ExampleTypes.GAP_FILL) {
      this.updateGapsFromText();
      if (this.example.gapFillType === 'INPUT') {
        this.example.gaps.forEach(gap => this.ensureGapWidth(gap));
      }
    }

    this.markDirty();
  }

  private async compressImage(file: File, maxSize = 512, quality = 0.72): Promise<File> {
    const img = new Image();
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
      img.onerror = () => reject(new Error('Bild konnte nicht verarbeitet werden.'));

      reader.onload = () => {
        img.src = reader.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement('canvas');

        let { width, height } = img;

        if (width > height && width > maxSize) {
          height = Math.round(height * (maxSize / width));
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round(width * (maxSize / height));
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas-Kontext konnte nicht erstellt werden.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('Bild konnte nicht komprimiert werden.'));
              return;
            }

            resolve(new File(
              [blob],
              file.name.replace(/\.\w+$/, '.jpg'),
              { type: 'image/jpeg' }
            ));
          },
          'image/jpeg',
          quality
        );
      };

      reader.readAsDataURL(file);
    });
  }
}
