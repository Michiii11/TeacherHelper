import { AfterViewInit, Component, inject, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpService } from '../../service/http.service';
import { SchoolDTO } from '../../model/School';
import { MatButton, MatIconButton, MatMiniFabButton } from '@angular/material/button';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
  MatTableDataSource
} from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { CreateExampleComponent } from '../../dialog/create-example/create-example.component';
import { MatIcon } from '@angular/material/icon';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import { NgForOf, NgIf } from '@angular/common';
import { ExampleOverviewDTO, ExampleTypeLabels, ExampleTypes, Focus } from '../../model/Example';
import { ConfirmDialogComponent } from '../../dialog/confirm-dialog/confirm-dialog.component';
import { TestOverviewDTO } from '../../model/Test';
import { CreateTestComponent } from '../../dialog/create-test/create-test.component';
import { TestPreviewComponent } from '../../dialog/test-preview/test-preview.component';
import { ExamplePreviewComponent } from '../../dialog/example-preview/example-preview.component';
import { SchoolInvitationDialogComponent } from '../../dialog/school-invitation-dialog/school-invitation-dialog.component';
import { UserDTO } from '../../model/User';

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
  ],
  templateUrl: './school.component.html',
  standalone: true,
  styleUrl: './school.component.scss'
})
export class SchoolComponent implements OnInit, AfterViewInit {
  @ViewChild(MatSort) sort!: MatSort;

  service = inject(HttpService);
  dialog = inject(MatDialog);

  school: SchoolDTO = {} as SchoolDTO;
  schoolId: string | null = null;

  exampleDataSource = new MatTableDataSource<ExampleOverviewDTO>();
  tests: TestOverviewDTO[] = [];

  exampleDisplayedColumns = ['type', 'instruction', 'question', 'focus', 'adminUsername', 'actions'];

  kpis = [
    { title: 'Tests', value: this.tests.length, sub: 'Verfügbar', icon: 'assignment' },
    { title: 'Beispiele', value: this.exampleCount, sub: 'Fragen', icon: 'library_books' },
    { title: 'Lehrer', value: this.school.members?.length || 0, sub: 'Konten', icon: 'people' },
    { title: 'Letzte Änderung', value: '2 Std. zuvor', sub: 'von Admin', icon: 'history' }
  ];

  currentUserId = -1;
  menuOpen: boolean | undefined;

  constructor(private route: ActivatedRoute, private router: Router) {
    this.route.paramMap.subscribe(params => {
      this.schoolId = params.get('id');

      if (this.schoolId) {
        localStorage.setItem('lastViewedSchoolId', this.schoolId);
      }

      this.loadSchool();
    });
  }

  ngOnInit() {
    this.loadExamples();
    this.loadTests();

    this.service.getUserId().subscribe(id => {
      this.currentUserId = id as number;
    });
  }

  ngAfterViewInit() {
    this.exampleDataSource.sort = this.sort;

    this.exampleDataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'adminUsername':
          return item.adminUsername || '';
        case 'focusList':
          return item.focusList?.map(f => f.label).join(', ') || '';
        default: {
          const value = item[property as keyof ExampleOverviewDTO];
          if (Array.isArray(value)) {
            return value.map(v => (v as any).toString()).join(', ');
          }
          return value as string | number;
        }
      }
    };
  }

  private loadSchool(): void {
    if (!this.schoolId) {
      return;
    }

    this.service.getSchoolById(this.schoolId).subscribe(school => {
      this.school = school;
      this.kpis[2].value = this.getTeacherCount().toString();
    });
  }

  loadExamples() {
    this.service.getExamples(this.schoolId).subscribe(examples => {
      this.exampleDataSource.data = examples as ExampleOverviewDTO[];
      this.kpis[1].value = this.exampleCount.toString();
    });
  }

  loadTests() {
    this.service.getTests(this.schoolId).subscribe(tests => {
      this.tests = tests as TestOverviewDTO[];
      this.kpis[0].value = this.tests.length.toString();
    });
  }

  get exampleCount(): number {
    return this.exampleDataSource.data.length;
  }

  getExampleTypeLabel(type: ExampleTypes | string): string {
    if (type == null) return '—';

    const enumKey = typeof type === 'string'
      ? ExampleTypes[type as keyof typeof ExampleTypes]
      : type;

    return ExampleTypeLabels[enumKey];
  }

  getAvatarUrl(user?: UserDTO | null): string | null {
    return this.service.getAvatarUrl((user ?? null) as any);
  }

  getInitials(user?: UserDTO | null): string {
    return this.service.getUserInitials((user ?? null) as any);
  }

  getTeacherCount(): number {
    const memberCount = this.school.members?.length ?? 0;
    const hasAdmin = !!this.school.admin;
    return memberCount + (hasAdmin ? 1 : 0);
  }

  openCreateExample() {
    this.dialog.open(CreateExampleComponent, {
      width: '60vw',
      maxWidth: 'none',
      minWidth: '1000px',
      data: { schoolId: this.schoolId }
    }).afterClosed().subscribe(() => {
      this.loadExamples();
    });
  }

  createTest() {
    this.dialog.open(CreateTestComponent, {
      width: 'min(96vw, 1680px)',
      maxWidth: '96vw',
      maxHeight: '94vh',
      data: { schoolId: this.schoolId }
    }).afterClosed().subscribe(() => {
      this.loadTests();
    });
  }

  protected editTest(test: TestOverviewDTO) {
    this.dialog.open(CreateTestComponent, {
      width: 'min(96vw, 1680px)',
      maxWidth: '96vw',
      maxHeight: '94vh',
      data: { schoolId: this.schoolId, testId: test.id }
    }).afterClosed().subscribe(() => {
      this.loadTests();
    });
  }

  protected openTest(test: TestOverviewDTO) {
    this.dialog.open(TestPreviewComponent, {
      width: 'min(80vw, 950px)',
      maxWidth: '80vw',
      height: '92vh',
      maxHeight: '92vh',
      panelClass: 'test-preview-dialog',
      data: { schoolId: this.schoolId, testId: test.id }
    }).afterClosed().subscribe(() => {
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

  openSettings() {
    console.log('open settings');
  }

  openExample(e: any) {
    this.dialog.open(ExamplePreviewComponent, {
      width: '10vw',
      data: { schoolId: this.schoolId, exampleId: e.id }
    }).afterClosed().subscribe(() => {
      this.loadExamples();
    });
  }

  editExample(e: any) {
    this.dialog.open(CreateExampleComponent, {
      width: '60vw',
      maxWidth: 'none',
      minWidth: '1000px',
      data: { schoolId: this.schoolId, exampleId: e.id }
    }).afterClosed().subscribe(() => {
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

  openAddTeacher() {
    this.dialog.open(SchoolInvitationDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      data: {
        schoolId: this.schoolId
      }
    }).afterClosed().subscribe(result => {
      if (result) {
        this.loadSchool();
      }
    });
  }

  protected getFocusList(focus: Focus[]) {
    return focus.map(f => f.label).join(', ');
  }

  protected kickTeacher(t: UserDTO) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Lehrer entfernen',
        message: `Lehrer "${t.username}" wirklich entfernen?`,
        confirmText: 'Entfernen',
        cancelText: 'Abbrechen'
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.kickTeacherFromSchool(this.schoolId!, t.id).subscribe(() => {
        this.loadSchool();
      });
    });
  }
}
