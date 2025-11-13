import {Component, inject} from '@angular/core';
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
  MatTable
} from '@angular/material/table'
import {MatDialog} from '@angular/material/dialog'
import {CreateExampleComponent} from '../../dialog/create-example/create-example.component'
import {MatIcon} from '@angular/material/icon'
import {MatSort} from '@angular/material/sort'
import {NgForOf, NgIf} from '@angular/common'

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
    NgIf
  ],
  templateUrl: './school.component.html',
  standalone: true,
  styleUrl: './school.component.scss'
})
export class SchoolComponent {
  service = inject(HttpService)
  dialog = inject(MatDialog)

  school:SchoolDTO = {} as SchoolDTO

  schoolId: string | null = null;

  exampleDisplayedColumns = ['name', 'type', 'question'];
  examples = [
    {"name": "test", "type": "test", "question": "asfd"},
    {"name": "test", "type": "test", "question": "asfd"},
    {"name": "test", "type": "test", "question": "asfd"},
    {"name": "test", "type": "test", "question": "asfd"},
    {"name": "test", "type": "test", "question": "asfd"},
    {"name": "test", "type": "test", "question": "asfd"},
  ]; // Array mit Beispielen
  teachers = [
    {"name": "Max Mustermann", "role": "teacher"},
    {"name": "Erika Musterfrau", "role": "admin"},
    {"name": "Hans Meier", "role": "teacher"},
  ]; // Array mit Lehrern

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
      width: '800px',
      maxWidth: 'none'
    }).afterClosed().subscribe(result => {

    });
  }

  back() {
    this.router.navigate([""])
  }

  // KPI cards
  kpis = [
    { title: 'Offene Tests', value: 3, sub: 'in Bearbeitung', icon: 'assignment' },
    { title: 'Beispiele', value: this.examples.length, sub: 'Fragen', icon: 'library_books' },
    { title: 'Aktive Lehrer', value: this.teachers.length, sub: 'Konten', icon: 'people' },
    { title: 'Letzte Änderung', value: '2 Std. zuvor', sub: 'von Admin', icon: 'history' }
  ];

  /* small helpers */
  initials(name: string) {
    return (name || '').split(' ').map(n => n.charAt(0)).slice(0,2).join('').toUpperCase();
  }

  /* Actions (replace with real logic) */
  menuOpen: boolean | undefined
  createTest() { console.log('create test'); }
  openSettings() { console.log('open settings'); }
  editExample(e: any) { console.log('edit example', e); }
  deleteExample(e: any) {}
  openAddTeacher() { console.log('add teacher'); }
  deleteSchool() { if(confirm(`Schule "${this.school.name}" wirklich löschen?`)) { console.log('delete school'); } }
  exportCsv() { console.log('export csv'); }
}
