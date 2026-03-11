import { Component, Inject, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions, MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';
import { HttpService } from '../../service/http.service';
import {MatFormField, MatInput, MatLabel} from '@angular/material/input'
import {MatIcon} from '@angular/material/icon'
import {FormsModule} from '@angular/forms'
import {MatButton} from '@angular/material/button'

@Component({
  selector: 'app-school-invitation-dialog',
  templateUrl: './school-invitation-dialog.component.html',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatFormField,
    MatLabel,
    MatInput,
    MatIcon,
    FormsModule,
    MatButton,
    MatDialogActions,
    MatDialogClose
  ],
  styleUrl: './school-invitation-dialog.component.scss'
})
export class SchoolInvitationDialogComponent {
  service = inject(HttpService);

  teachers: any[] = [];
  filteredTeachers: any[] = [];
  searchTerm = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { schoolId: string },
    private dialogRef: MatDialogRef<SchoolInvitationDialogComponent>
  ) {}

  ngOnInit() {
    this.loadTeachers();
  }

  loadTeachers() {
    this.service.getAllTeachers(this.data.schoolId).subscribe((teachers: any) => {
      this.teachers = teachers;
      this.filteredTeachers = teachers;
      console.log(teachers);
    });
  }

  filterTeachers() {
    const value = this.searchTerm.toLowerCase().trim();

    this.filteredTeachers = this.teachers.filter(t =>
      (t.username?.toLowerCase().includes(value) || false) ||
      (t.email?.toLowerCase().includes(value) || false)
    );
  }

  inviteTeacher(teacher: any) {
    this.service.inviteTeacherToSchool(this.data.schoolId, teacher.userId).subscribe(() => {
      this.dialogRef.close(true);
    });
  }
}
