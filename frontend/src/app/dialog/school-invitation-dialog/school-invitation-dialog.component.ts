import { Component, Inject, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions, MatDialogClose,
  MatDialogContent,
  MatDialogTitle
} from '@angular/material/dialog';
import { HttpService } from '../../service/http.service';
import {MatFormField, MatInput, MatLabel} from '@angular/material/input'
import {MatIcon} from '@angular/material/icon'
import {FormsModule} from '@angular/forms'
import {MatButton} from '@angular/material/button'
import {UserDTO} from '../../model/User'

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
  invitingTeacherIds = new Set<number>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { schoolId: string }
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

  inviteTeacher(teacher: UserDTO) {
    if (!teacher.id || this.invitingTeacherIds.has(teacher.id)) {
      return;
    }

    this.invitingTeacherIds.add(teacher.id);

    this.service.inviteTeacherToSchool(this.data.schoolId, teacher.id).subscribe({
      next: () => {
        this.teachers = this.teachers.filter(t => t.id !== teacher.id);
        this.filteredTeachers = this.filteredTeachers.filter(t => t.id !== teacher.id);
      },
      error: () => {
        this.invitingTeacherIds.delete(teacher.id!);
      },
      complete: () => {
        this.invitingTeacherIds.delete(teacher.id!);
      }
    });
  }

  isInviting(teacher: UserDTO) {
    return !!teacher.id && this.invitingTeacherIds.has(teacher.id);
  }
}
