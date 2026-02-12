import {Component, inject, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router'
import {HttpService} from '../../service/http.service'
import {SchoolDTO} from '../../model/School'
import {MatTab, MatTabGroup} from '@angular/material/tabs'
import {MatButton, MatIconButton, MatMiniFabButton} from '@angular/material/button'
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow, MatHeaderRowDef, MatRow, MatRowDef,
  MatTable, MatTableDataSource
} from '@angular/material/table'
import {MatDialog} from '@angular/material/dialog'
import {CreateExampleComponent} from '../../dialog/create-example/create-example.component'
import {MatIcon} from '@angular/material/icon'
import {MatSort, MatSortHeader} from '@angular/material/sort'
import {NgClass, NgForOf, NgIf} from '@angular/common'
import {ExampleDifficulty, ExampleOverviewDTO, ExampleTypeLabels, ExampleTypes, Focus} from '../../model/Example'
import {ConfirmDialogComponent} from '../../dialog/confirm-dialog/confirm-dialog.component'
import {TestOverviewDTO} from '../../model/Test'
import {CreateTestComponent} from '../../dialog/create-test/create-test.component'
import {TestPreviewComponent} from '../../dialog/test-preview/test-preview.component'

@Component({
  selector: 'app-school',
  imports: [
    MatButton,
    MatTable,
    MatHeaderCell,
    MatCell,
    MatColumnDef,
    MatCellDef,
    MatHeaderCellDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    MatHeaderRowDef,
    MatIcon,
    MatMiniFabButton,
    MatIconButton,
    MatSort,
    NgForOf,
    NgIf,
    MatSortHeader,
    NgClass
  ],
  templateUrl: './school.component.html',
  standalone: true,
  styleUrl: './school.component.scss'
})
export class SchoolComponent {
  @ViewChild(MatSort) sort!: MatSort;

  service = inject(HttpService)
  dialog = inject(MatDialog)

  school:SchoolDTO = {} as SchoolDTO

  schoolId: string | null = null;

  exampleDataSource = new MatTableDataSource<ExampleOverviewDTO>();

  exampleDifficulties = [
    { value: 'EASY',      label: 'Leicht' },
    { value: 'MEDIUM',    label: 'Mittel' },
    { value: 'HARD',      label: 'Schwer' },
    { value: 'VERY_HARD', label: 'Sehr schwer' },
    { value: 'EXPERT',    label: 'Experte' }
  ];

  tests : TestOverviewDTO[] = []


  getDifficultyLabelFromValue(value: string | number): string {
    if (!value && value !== 0) return '—';
    const valStr = String(value);
    const found = this.exampleDifficulties.find(d => d.value === valStr);
    return found?.label ?? valStr;
  }

  getExampleTypeLabel(type: ExampleTypes | string): string {
    if (type == null) return '—';

    // Falls es ein String ist (Backend case):
    const enumKey = typeof type === 'string'
      ? ExampleTypes[type as keyof typeof ExampleTypes]
      : type;

    return ExampleTypeLabels[enumKey];
  }

  exampleDisplayedColumns = ['type', 'instruction', 'question', 'difficulty', 'focus', 'adminUsername', 'actions'];
  teachers = [
    {"name": "Max Mustermann", "role": "teacher"},
    {"name": "Erika Musterfrau", "role": "admin"},
    {"name": "Hans Meier", "role": "teacher"},
  ]; // Array mit Lehrern

  kpis = [
    { title: 'Offene Tests', value: this.tests.length.toString(), sub: 'in Bearbeitung', icon: 'assignment' },
    { title: 'Beispiele', value: this.exampleCount.toString(), sub: 'Fragen', icon: 'library_books' },
    { title: 'Aktive Lehrer', value: this.teachers.length.toString(), sub: 'Konten', icon: 'people' },
    { title: 'Letzte Änderung', value: '2 Std. zuvor', sub: 'von Admin', icon: 'history' }
  ]

  ngOnInit(){
    this.loadExamples()
    this.loadTests()
  }

  loadExamples(){
    this.service.getExamples(this.schoolId).subscribe(examples => {
      this.exampleDataSource.data = examples as ExampleOverviewDTO[]

      this.kpis[1].value = this.exampleCount.toString();
    })
  }

  loadTests(){
    this.service.getTests(this.schoolId).subscribe(tests => {
      this.tests = tests as TestOverviewDTO[]

      this.kpis[0].value = this.tests.length.toString();
    })
  }

  ngAfterViewInit() {
    this.exampleDataSource.sort = this.sort;

    this.exampleDataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'adminUsername':
          return item.adminUsername || '';

        case 'focusList': // if this is an array of Focus objects
          return item.focusList?.map(f => f.label).join(', ') || ''; // convert to string

        default:
          const value = item[property as keyof ExampleOverviewDTO];
          if (Array.isArray(value)) {
            return value.map(v => (v as any).toString()).join(', '); // fallback for any array
          }
          return value as string | number; // safe cast
      }
    };

  }

  constructor(private route: ActivatedRoute, private router: Router) {
    this.route.paramMap.subscribe(params => {
      this.schoolId = params.get('id');

      localStorage.setItem('lastViewedSchoolId', this.schoolId!);

      this.service.getSchoolById(this.schoolId!).subscribe(school => {
        this.school = school;
      })
    });
  }

  promoteTeacher(teacher: any) {

  }

  editTeacher(teacher: any) {

  }

  openCreateExample() {
    this.dialog.open(CreateExampleComponent, {
      width: '1000px',
      maxWidth: 'none',
      data: { schoolId: this.schoolId }
    }).afterClosed().subscribe(result => {
      this.loadExamples();
    });
  }

  back() {
    this.router.navigate([""])
  }

  get exampleCount(): number {
    return this.exampleDataSource.data.length;
  }

  /* small helpers */
  initials(name: string) {
    return (name || '').split(' ').map(n => n.charAt(0)).slice(0,2).join('').toUpperCase();
  }

  /* Actions (replace with real logic) */
  menuOpen: boolean | undefined

  createTest() {
    this.dialog.open(CreateTestComponent, {
      width: '1000px',
      maxWidth: 'none',
      data: { schoolId: this.schoolId }
    }).afterClosed().subscribe(result => {
      this.loadTests();
    });
  }

  openSettings() { console.log('open settings'); }

  editExample(e: any) {
    this.dialog.open(CreateExampleComponent, {
      width: '1000px',
      maxWidth: 'none',
      data: { schoolId: this.schoolId, exampleId: e.id }
    }).afterClosed().subscribe(result => {
      this.loadExamples();
    });
  }

  deleteExample(e: any) {
    const title = e.question || e.id || 'das Beispiel';

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Beispiel löschen',
        message: `Beispiel "${title}" wirklich löschen?`,
        confirmText: 'Löschen',
        cancelText: 'Abbrechen'
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.deleteExample(e.id).subscribe(() => {
        this.loadExamples();
      });
    });
  }

  openAddTeacher() { console.log('add teacher'); }
  deleteSchool() { if(confirm(`Schule "${this.school.name}" wirklich löschen?`)) { console.log('delete school'); } }
  exportCsv() { console.log('export csv'); }

  protected readonly ExampleTypeLabels = ExampleTypeLabels

  protected openTest(test: TestOverviewDTO) {
    this.dialog.open(TestPreviewComponent, {
      width: '800px',
      maxWidth: 'none',
      data: { schoolId: this.schoolId, testId: test.id }
    }).afterClosed().subscribe(result => {
      this.loadTests();
    });
  }

  protected editTest(test: TestOverviewDTO) {
    this.dialog.open(CreateTestComponent, {
      width: '1000px',
      maxWidth: 'none',
      data: { schoolId: this.schoolId, testId: test.id }
    }).afterClosed().subscribe(result => {
      this.loadTests();
    });
  }

  protected deleteTest(test: TestOverviewDTO) {
    const title = test.name || test.id || 'der Test';

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Test löschen',
        message: `Test "${title}" wirklich löschen?`,
        confirmText: 'Löschen',
        cancelText: 'Abbrechen'
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.deleteTest(test.id).subscribe(() => {
        this.loadTests();
      });
    });
  }

  protected getFocusList(focus: Focus[]) {
    return focus.map(f => f.label).join(', ');
  }
}
