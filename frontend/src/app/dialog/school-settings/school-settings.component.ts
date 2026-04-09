import { CommonModule } from '@angular/common';
import { Component, Inject, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import { HttpService } from '../../service/http.service';
import { SchoolDTO } from '../../model/School';
import { TranslatePipe } from '@ngx-translate/core';
import {UserDTO} from '../../model/User'
import {ConfirmDialogComponent} from '../confirm-dialog/confirm-dialog.component'
import {MatSnackBar} from '@angular/material/snack-bar'

export interface SchoolSettingsDialogData {
  schoolId: string;
  school: SchoolDTO;
  currentUserId: number;
}

@Component({
  selector: 'app-school-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatCardModule
  ],
  templateUrl: './school-settings.component.html',
  styleUrl: './school-settings.component.scss'
})
export class SchoolSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(HttpService);
  dialog = inject(MatDialog);
  snack = inject(MatSnackBar);

  savingGeneral = false;
  uploadingLogo = false;
  invitingTeacher = false;

  selectedLogoFile: File | null = null;
  logoPreviewUrl: string | null = null;

  inviteSuccessMessage: string | null = null;
  inviteErrorMessage: string | null = null;

  generalForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]]
  });

  inviteForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]]
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: SchoolSettingsDialogData,
    private dialogRef: MatDialogRef<SchoolSettingsComponent>
  ) {}

  ngOnInit(): void {
    this.generalForm.patchValue({
      name: this.data.school?.name ?? ''
    });

    this.logoPreviewUrl = this.getSchoolLogoUrl();
  }

  get isAdmin(): boolean {
    return this.data.currentUserId === this.data.school?.admin?.id;
  }

  getSchoolLogoUrl() {
    return this.service.getSchoolLogo(this.data.school, this.data.schoolId);
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    this.selectedLogoFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.logoPreviewUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeSelectedLogo(): void {
    this.selectedLogoFile = null;
    this.logoPreviewUrl = this.getSchoolLogoUrl();
  }

  saveGeneral(): void {
    if (!this.isAdmin || this.generalForm.invalid) {
      this.generalForm.markAllAsTouched();
      return;
    }

    this.savingGeneral = true;

    const payload = {
      name: this.generalForm.value.name?.trim(),
      authToken: localStorage.getItem('teacher_authToken') || '',
    };

    this.service.updateSchool(this.data.schoolId, payload)
      .pipe(finalize(() => (this.savingGeneral = false)))
      .subscribe(updatedSchool => {
        this.dialogRef.close({
          updated: true,
          school: updatedSchool
        });
      });
  }

  uploadLogo(): void {
    if (!this.isAdmin || !this.selectedLogoFile) {
      return;
    }

    this.uploadingLogo = true;

    const formData = new FormData();
    formData.append('file', this.selectedLogoFile);
    formData.append('authToken', localStorage.getItem('teacher_authToken') ?? '');

    this.service.uploadSchoolLogo(this.data.schoolId, formData)
      .pipe(finalize(() => (this.uploadingLogo = false)))
      .subscribe(updatedSchool => {
        this.dialogRef.close({
          updated: true,
          school: updatedSchool
        });
      });
  }

  sendTeacherInvite(): void {
    if (!this.isAdmin || this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }

    const email = (this.inviteForm.value.email ?? '').trim().toLowerCase();
    if (!email) {
      return;
    }

    this.service.sendInvite(this.data.schoolId, email).subscribe(
      data => {
        this.snack.open('Einladung erfolgreich gesendet', 'OK', { duration: 5000 });
      },
      error => {
        this.snack.open(error.error?.message || 'Fehler beim Senden der Einladung', 'OK', { duration: 5000 });
      }
    )
  }


  kickTeacher(t: UserDTO): void {
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
      this.service.kickTeacherFromSchool(this.data.schoolId!, t.id).subscribe(() => {

      });
    });
  }

  getMemberCountLabel(): string {
    const count = this.data.school.members.length + 1;
    return count === 1 ? '1 Mitglied' : `${count} Mitglieder`;
  }

  close(): void {
    this.dialogRef.close();
  }

  getInitials(user: UserDTO): string {
    return this.service.getUserInitials(user);
  }

  getAvatarUrl(user: UserDTO): string | null {
    return this.service.getAvatarUrl(user);
  }
}
