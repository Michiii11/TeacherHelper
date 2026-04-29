import { CommonModule } from '@angular/common';
import { Component, Inject, inject, OnDestroy, OnInit } from '@angular/core';
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
import { finalize, takeUntil } from 'rxjs/operators';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

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
export class SchoolSettingsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(HttpService);
  private translate = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private router = inject(Router);

  savingGeneral = false;
  uploadingLogo = false;
  deletingLogo = false;
  invitingTeacher = false;
  deletingSchool = false;

  selectedLogoFile: File | null = null;

  inviteSuccessMessage: string | null = null;
  inviteErrorMessage: string | null = null;

  readonly maxLogoBytes = 2 * 1024 * 1024;
  readonly allowedLogoTypes = ['image/jpeg', 'image/png', 'image/webp'];

  readonly templatePlaceholders = [
    {
      icon: 'dashboard_customize',
      titleKey: 'schoolSettings.comingSoonTitle',
      textKey: 'schoolSettings.comingSoonText'
    },
    {
      icon: 'grading',
      titleKey: 'schoolSettings.more.gradeSystemTitle',
      textKey: 'schoolSettings.more.gradeSystemText'
    },
    {
      icon: 'print',
      titleKey: 'schoolSettings.more.exportTitle',
      textKey: 'schoolSettings.more.exportText'
    }
  ] as const;

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

    this.loadLogo();
    this.loadMemberAvatars();
  }

  ngOnDestroy(): void {
    this.revokeLogoUrl();
    this.revokeAvatarUrls();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isAdmin(): boolean {
    return this.data.currentUserId.toString() === this.data.school?.admin?.id;
  }

  logoUrl?: string;
  logoPreviewUrl?: string;
  private avatarUrls = new Map<string, string>();
  private loadingAvatarIds = new Set<string>();

  loadLogo() {
    this.revokeLogoUrl();

    if (!this.data?.school?.logoUrl) return;

    this.service.getCollectionLogo(this.data.school.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(blob => {
        this.revokeLogoUrl();
        this.logoUrl = URL.createObjectURL(blob);
      });
  }

  private revokeLogoUrl(): void {
    if (this.logoUrl) {
      URL.revokeObjectURL(this.logoUrl);
      this.logoUrl = undefined;
    }
  }

  get displayedLogoUrl(): string | null {
    return this.logoPreviewUrl ?? this.logoUrl ?? null;
  }

  get hasExistingLogo(): boolean {
    return !!this.data.school?.logoUrl;
  }

  get hasMembers(): boolean {
    return !!this.data.school?.admin || this.data.school.members.length > 0;
  }

  get inviteEmailControl() {
    return this.inviteForm.controls.email;
  }

  get isLogoBusy(): boolean {
    return this.uploadingLogo || this.deletingLogo;
  }

  get isDeleteSchoolNameValid(): boolean {
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
    this.logoPreviewUrl = undefined;
    this.loadLogo();

    if (input) {
      input.value = '';
    }
  }

  deleteSchoolLogo(input?: HTMLInputElement): void {
    if (!this.isAdmin || !this.hasExistingLogo) {
      return;
    }

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      maxWidth: 'calc(100vw - 24px)',
      data: {
        title: this.translate.instant('schoolSettings.deleteLogoTitle'),
        message: this.translate.instant('schoolSettings.deleteLogoMessage'),
        confirmText: this.translate.instant('schoolSettings.deleteLogoConfirm'),
        cancelText: this.translate.instant('common.cancel')
      }
    });

    ref.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (!confirmed) {
          return;
        }

        this.deletingLogo = true;

        this.service.deleteCollectionLogo(this.data.schoolId)
          .pipe(takeUntil(this.destroy$), finalize(() => (this.deletingLogo = false)))
          .subscribe({
            next: () => {
              this.selectedLogoFile = null;
              this.logoPreviewUrl = undefined;
              this.revokeLogoUrl();
              this.data.school = { ...this.data.school, logoUrl: null } as SchoolDTO;

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

    this.service.updateCollectionSettings(this.data.schoolId, this.generalForm.value.name?.trim())
      .pipe(takeUntil(this.destroy$), finalize(() => (this.savingGeneral = false)))
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

    this.service.uploadCollectionLogo(this.data.schoolId, this.selectedLogoFile)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.uploadingLogo = false)))
      .subscribe({
        next: updatedSchool => {
          this.data.school = updatedSchool;
          this.selectedLogoFile = null;
          this.logoPreviewUrl = undefined;
          this.revokeLogoUrl();
          this.loadLogo();

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
          this.logoPreviewUrl = undefined;
          this.loadLogo();

          this.snack.open(
            this.translate.instant('schoolSettings.snackbar.logoUpdateError'),
            'OK',
            { duration: 5000 }
          );
        }
      });
  }

  saveAll(): void {
    this.selectedLogoFile ? this.uploadLogo() : this.saveGeneral();
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

    this.service.inviteTeacher(this.data.schoolId, email)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.invitingTeacher = false)))
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

  kickTeacher(teacher: UserDTO): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      maxWidth: 'calc(100vw - 24px)',
      data: {
        title: this.translate.instant('schoolSettings.teacherKickTitle'),
        message: this.translate.instant('schoolSettings.teacherKickMessage', { name: teacher.username }),
        confirmText: this.translate.instant('schoolSettings.teacherKickConfirm'),
        cancelText: this.translate.instant('common.cancel')
      }
    });

    ref.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (!confirmed) {
          return;
        }

        this.service.removeTeacher(this.data.schoolId, teacher.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.data.school.members = this.data.school.members.filter(member => member.id !== teacher.id);
              this.revokeAvatarUrl(teacher.id);
              this.snack.open(
                this.translate.instant('schoolSettings.snackbar.teacherKicked'),
                'OK',
                { duration: 4000 }
              );
            },
            error: error => {
              this.snack.open(error.error, 'OK', { duration: 5000 });
            }
          });
      });
  }

  confirmDeleteSchool(): void {
    if (this.deleteSchoolForm.invalid || !this.isDeleteSchoolNameValid || this.deletingSchool) {
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

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed: boolean) => {
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

    this.service.deleteCollection(this.data.schoolId)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.deletingSchool = false)))
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

  get memberCountLabel(): string {
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
    if (!user?.id || !user?.profileImageUrl) {
      return null;
    }

    const cachedUrl = this.avatarUrls.get(user.id);
    if (cachedUrl) {
      return cachedUrl;
    }

    this.loadAvatar(user);
    return null;
  }

  private loadMemberAvatars(): void {
    this.loadAvatar(this.data.school.admin);
    this.data.school.members.forEach(member => this.loadAvatar(member));
  }

  private loadAvatar(user: UserDTO | null | undefined): void {
    if (!user?.id || !user?.profileImageUrl || this.avatarUrls.has(user.id) || this.loadingAvatarIds.has(user.id)) {
      return;
    }

    this.loadingAvatarIds.add(user.id);

    this.service.getProfileImage(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: blob => {
          this.revokeAvatarUrl(user.id);
          this.avatarUrls.set(user.id, URL.createObjectURL(blob));
          this.loadingAvatarIds.delete(user.id);
        },
        error: () => {
          this.loadingAvatarIds.delete(user.id);
        }
      });
  }

  private revokeAvatarUrl(userId: string): void {
    const url = this.avatarUrls.get(userId);
    if (url) {
      URL.revokeObjectURL(url);
      this.avatarUrls.delete(userId);
    }
    this.loadingAvatarIds.delete(userId);
  }

  private revokeAvatarUrls(): void {
    this.avatarUrls.forEach(url => URL.revokeObjectURL(url));
    this.avatarUrls.clear();
    this.loadingAvatarIds.clear();
  }
}
