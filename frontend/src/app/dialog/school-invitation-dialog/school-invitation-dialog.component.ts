import {Component, Inject, inject, OnInit} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle
} from '@angular/material/dialog';
import { HttpService } from '../../service/http.service';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { UserDTO } from '../../model/User';
import { CreateSchoolInviteDTO } from '../../model/School';
import { MatSnackBar } from '@angular/material/snack-bar';
import {NgIf} from '@angular/common'

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
    MatDialogClose,
    NgIf
  ],
  styleUrl: './school-invitation-dialog.component.scss'
})
export class SchoolInvitationDialogComponent implements OnInit{
  private readonly service = inject(HttpService);
  private readonly snackBar = inject(MatSnackBar);

  teachers: UserDTO[] = [];
  filteredTeachers: UserDTO[] = [];
  searchTerm = '';

  invitingTeacherIds = new Set<number>();
  invitedTeacherIds = new Set<number>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { schoolId: string }
  ) {}

  ngOnInit() {
    this.loadTeachers();
  }

  loadTeachers() {

    this.service.getAllTeachers(this.data.schoolId).subscribe({
      next: (teachers: UserDTO[]) => {
        this.teachers = teachers ?? [];
        this.applyFilter();
      },
      error: () => {
        this.teachers = [];
        this.filteredTeachers = [];
        this.snackBar.open('Lehrkräfte konnten nicht geladen werden', 'OK', {
          duration: 3500
        });
      }
    });
  }

  filterTeachers() {
    this.applyFilter();
  }

  getAvatarUrl(user?: UserDTO | null): string | null {
    return this.service.getAvatarUrl((user ?? null) as any);
  }

  getInitials(user?: UserDTO | null): string {
    return this.service.getUserInitials((user ?? null) as any);
  }

  private applyFilter() {
    const value = this.searchTerm.toLowerCase().trim();

    if (!value) {
      this.filteredTeachers = [...this.teachers];
      return;
    }

    this.filteredTeachers = this.teachers.filter(teacher =>
      (teacher.username?.toLowerCase().includes(value) ?? false)
    );
  }

  inviteTeacher(teacher: UserDTO) {
    if (!teacher.id || this.isInviting(teacher) || this.isInvited(teacher)) {
      return;
    }

    this.invitingTeacherIds.add(teacher.id);

    const dto: CreateSchoolInviteDTO = {
      authToken: '',
      teacherId: teacher.id,
      message: ''
    };

    this.service.inviteTeacher(this.data.schoolId || 0, dto).subscribe({
      next: () => {
        this.invitingTeacherIds.delete(teacher.id!);
        this.invitedTeacherIds.add(teacher.id!);

        this.snackBar.open(`Einladung an ${teacher.username} gesendet`, 'Schließen', {
          duration: 3000
        });
      },
      error: (err) => {
        this.invitingTeacherIds.delete(teacher.id!);

        const backendMessage = typeof err?.error === 'string' ? err.error : '';

        if (
          backendMessage.toLowerCase().includes('already an open invitation') ||
          backendMessage.toLowerCase().includes('open invitation')
        ) {
          this.invitedTeacherIds.add(teacher.id!);
        }

        this.snackBar.open(
          backendMessage || 'Einladung konnte nicht gesendet werden',
          'OK',
          { duration: 3500 }
        );
      }
    });
  }

  isInviting(teacher: UserDTO): boolean {
    return !!teacher.id && this.invitingTeacherIds.has(teacher.id);
  }

  isInvited(teacher: UserDTO): boolean {
    return !!teacher.id && this.invitedTeacherIds.has(teacher.id);
  }

  getInviteButtonLabel(teacher: UserDTO): string {
    if (this.isInviting(teacher)) {
      return 'Wird gesendet...';
    }

    if (this.isInvited(teacher)) {
      return 'Einladung gesendet';
    }

    return 'Einladung senden';
  }

  getInviteButtonIcon(teacher: UserDTO): string {
    if (this.isInviting(teacher)) {
      return 'hourglass_top';
    }

    if (this.isInvited(teacher)) {
      return 'check_circle';
    }

    return 'send';
  }
}
