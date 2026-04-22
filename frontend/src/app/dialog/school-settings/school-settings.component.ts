import { CommonModule } from '@angular/common';
import { Component, Inject, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { HttpService } from '../../service/http.service';
import { SchoolDTO } from '../../model/School';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { UserDTO } from '../../model/User';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';
import { Router } from '@angular/router';

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
    TranslatePipe
  ],
  templateUrl: './school-settings.component.html',
  styleUrl: './school-settings.component.scss'
})
export class SchoolSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(HttpService);
  private translate = inject(TranslateService);

  dialog = inject(MatDialog);
  snack = inject(MatSnackBar);
  router = inject(Router);

  savingGeneral = false;
  uploadingLogo = false;
  deletingLogo = false;
  invitingTeacher = false;
  deletingSchool = false;

  selectedLogoFile: File | null = null;
  logoPreviewUrl: string | null = null;

  inviteSuccessMessage: string | null = null;
  inviteErrorMessage: string | null = null;

  readonly maxLogoBytes = 2 * 1024 * 1024;
  readonly allowedLogoTypes = ['image/jpeg', 'image/png', 'image/webp'];

  generalForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]]
  });

  inviteForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]]
  });

  deleteSchoolForm = this.fb.group({
    schoolName: ['', [Validators.required]]
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
    return this.data.currentUserId.toString() === this.data.school?.admin?.id;
  }

  getSchoolLogoUrl(): string | null {
    return this.service.getSchoolLogo(this.data.school, this.data.schoolId);
  }

  getDisplayedLogoUrl(): string | null {
    return this.logoPreviewUrl || this.getSchoolLogoUrl();
  }

  hasExistingLogo(): boolean {
    return !!this.data.school?.logoUrl;
  }

  isDeleteSchoolNameValid(): boolean {
    const entered = (this.deleteSchoolForm.controls.schoolName.value ?? '').trim();
    const current = (this.data.school?.name ?? '').trim();
    return entered.length > 0 && entered === current;
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!this.allowedLogoTypes.includes(file.type)) {
      this.snack.open(this.translate.instant('snackbar.imageTypeError'), 'OK', { duration: 3000 });
      input.value = '';
      return;
    }

    if (file.size > this.maxLogoBytes) {
      this.snack.open(this.translate.instant('snackbar.imageSizeError'), 'OK', { duration: 3200 });
      input.value = '';
      return;
    }

    this.selectedLogoFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.logoPreviewUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeSelectedLogo(input?: HTMLInputElement): void {
    this.selectedLogoFile = null;
    this.logoPreviewUrl = this.getSchoolLogoUrl();

    if (input) {
      input.value = '';
    }
  }

  deleteSchoolLogo(input?: HTMLInputElement): void {
    if (!this.isAdmin || !this.hasExistingLogo()) {
      return;
    }

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      maxWidth: 'calc(100vw - 24px)',
      data: {
        title: this.translate.instant('schoolSettings.deleteLogoTitle'),
        message: this.translate.instant('schoolSettings.deleteLogoMessage'),
        confirmText: this.translate.instant('schoolSettings.deleteLogoConfirm'),
        cancelText: this.translate.instant('common.cancel')
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.deletingLogo = true;

      this.service.deleteSchoolLogo(this.data.schoolId)
        .pipe(finalize(() => (this.deletingLogo = false)))
        .subscribe({
          next: () => {
            this.selectedLogoFile = null;
            this.logoPreviewUrl = null;
            this.data.school.logoUrl = null as any;

            if (input) {
              input.value = '';
            }

            this.snack.open(
              this.translate.instant('schoolSettings.snackbar.logoDeleted'),
              'OK',
              { duration: 4000 }
            );
          },
          error: () => {
            this.snack.open(
              this.translate.instant('schoolSettings.snackbar.logoDeleteError'),
              'OK',
              { duration: 5000 }
            );
          }
        });
    });
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
      .subscribe({
        next: updatedSchool => {
          this.data.school = updatedSchool;

          this.snack.open(
            this.translate.instant('schoolSettings.snackbar.schoolUpdated'),
            'OK',
            { duration: 4000 }
          );

          this.dialogRef.close({
            updated: true,
            school: updatedSchool
          });
        },
        error: () => {
          this.snack.open(
            this.translate.instant('schoolSettings.snackbar.schoolUpdateError'),
            'OK',
            { duration: 5000 }
          );
        }
      });
  }

  uploadLogo(): void {
    if (!this.isAdmin || !this.selectedLogoFile || this.uploadingLogo) {
      return;
    }

    this.uploadingLogo = true;

    const formData = new FormData();
    formData.append('file', this.selectedLogoFile);
    formData.append('authToken', localStorage.getItem('teacher_authToken') ?? '');

    this.service.uploadSchoolLogo(this.data.schoolId, formData)
      .pipe(finalize(() => (this.uploadingLogo = false)))
      .subscribe({
        next: updatedSchool => {
          this.data.school = updatedSchool;
          this.selectedLogoFile = null;
          this.logoPreviewUrl = this.getSchoolLogoUrl();

          this.snack.open(
            this.translate.instant('schoolSettings.snackbar.logoUpdated'),
            'OK',
            { duration: 4000 }
          );

          this.dialogRef.close({
            updated: true,
            school: updatedSchool
          });
        },
        error: () => {
          this.selectedLogoFile = null;
          this.logoPreviewUrl = this.getSchoolLogoUrl();

          this.snack.open(
            this.translate.instant('schoolSettings.snackbar.logoUpdateError'),
            'OK',
            { duration: 5000 }
          );
        }
      });
  }

  saveAll(): void {
    if (this.selectedLogoFile) {
      this.uploadLogo();
      return;
    }

    this.saveGeneral();
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

    this.invitingTeacher = true;
    this.inviteSuccessMessage = null;
    this.inviteErrorMessage = null;

    this.service.sendInvite(this.data.schoolId, email)
      .pipe(finalize(() => (this.invitingTeacher = false)))
      .subscribe({
        next: () => {
          this.inviteForm.reset();
          this.inviteSuccessMessage = this.translate.instant('schoolSettings.snackbar.inviteSent');
          if (this.inviteSuccessMessage != null) {
            this.snack.open(this.inviteSuccessMessage, 'OK', { duration: 4000 });
          }
        },
        error: error => {
          this.inviteErrorMessage = error.error;
          if (this.inviteErrorMessage != null) {
            this.snack.open(this.inviteErrorMessage, 'OK', { duration: 5000 });
          }
        }
      });
  }

  kickTeacher(t: UserDTO): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      maxWidth: 'calc(100vw - 24px)',
      data: {
        title: this.translate.instant('schoolSettings.teacherKickTitle'),
        message: this.translate.instant('schoolSettings.teacherKickMessage', { name: t.username }),
        confirmText: this.translate.instant('schoolSettings.teacherKickConfirm'),
        cancelText: this.translate.instant('common.cancel')
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.service.kickTeacherFromSchool(this.data.schoolId, t.id).subscribe({
        next: () => {
          this.data.school.members = this.data.school.members.filter(member => member.id !== t.id);
          this.snack.open(
            this.translate.instant('schoolSettings.snackbar.teacherKicked'),
            'OK',
            { duration: 4000 }
          );
        },
        error: (err) => {
          this.snack.open(
            err.error,
            'OK',
            { duration: 5000 }
          );
        }
      });
    });
  }

  confirmDeleteSchool(): void {
    if (this.deleteSchoolForm.invalid || !this.isDeleteSchoolNameValid() || this.deletingSchool) {
      this.deleteSchoolForm.markAllAsTouched();
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      maxWidth: 'calc(100vw - 24px)',
      disableClose: true,
      data: {
        title: this.translate.instant('schoolSettings.deleteSchoolTitle'),
        message: this.translate.instant('schoolSettings.deleteSchoolMessage', {
          name: this.data.school.name
        }),
        confirmText: this.translate.instant('schoolSettings.deleteSchoolConfirm'),
        cancelText: this.translate.instant('common.cancel'),
        requireConfirmation: true,
        confirmationText: this.translate.instant('schoolSettings.deleteSchoolConfirmPhrase', {
          name: this.data.school.name
        })
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.deleteSchool();
      }
    });
  }

  deleteSchool(): void {
    if (this.deletingSchool) {
      return;
    }

    this.deletingSchool = true;

    this.service.deleteSchool(this.data.schoolId)
      .pipe(finalize(() => (this.deletingSchool = false)))
      .subscribe({
        next: () => {
          this.snack.open(
            this.translate.instant('schoolSettings.snackbar.schoolDeleted'),
            'OK',
            { duration: 4000 }
          );

          this.router.navigate(['/home']);
          this.dialogRef.close({ deleted: true });
        },
        error: () => {
          this.snack.open(
            this.translate.instant('schoolSettings.snackbar.schoolDeleteError'),
            'OK',
            { duration: 5000 }
          );
        }
      });
  }

  getMemberCountLabel(): string {
    const count = this.data.school.members.length + 1;
    return count === 1
      ? this.translate.instant('schoolSettings.memberSingle')
      : this.translate.instant('schoolSettings.memberMany', { count });
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
