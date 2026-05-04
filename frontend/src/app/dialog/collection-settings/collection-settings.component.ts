import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { HttpService } from '../../service/http.service';
import { CollectionDTO } from '../../model/Collection';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { UserDTO } from '../../model/User';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, switchMap, takeUntil } from 'rxjs/operators';
import { Router } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';

export interface SettingsDialogData {
  schoolId: string;
  school: CollectionDTO;
  currentUserId: number;
}

@Component({
  selector: 'app-collection-settings',
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
    MatAutocompleteModule,
    MatProgressBarModule,
    TranslatePipe
  ],
  templateUrl: './collection-settings.component.html',
  styleUrl: './collection-settings.component.scss'
})
export class CollectionSettingsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(HttpService);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private router = inject(Router);

  savingGeneral = false;
  uploadingLogo = false;
  deletingLogo = false;
  invitingTeacher = false;
  searchingTeachers = false;
  deletingSchool = false;
  leavingSchool = false;

  selectedLogoFile: File | null = null;

  inviteSuccessMessage: string | null = null;
  inviteErrorMessage: string | null = null;
  fullUsernameList: string[] = [];
  userSearchResults: UserDTO[] = [];
  selectedInviteUser: UserDTO | null = null;

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
    username: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]]
  });

  deleteSchoolForm = this.fb.group({
    schoolName: ['', [Validators.required]]
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: SettingsDialogData,
    private dialogRef: MatDialogRef<CollectionSettingsComponent>
  ) {}

  ngOnInit(): void {
    this.generalForm.patchValue({
      name: this.data.school?.name ?? ''
    });

    this.service.getUsernames()
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => {
        this.fullUsernameList = users ?? [];
      });

    this.loadLogo();
    this.loadMemberAvatars();
    this.setupUserSearch();
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

  get isMember(): boolean {
    const currentUserId = this.data.currentUserId.toString();
    return this.data.school?.members?.some(member => member.id === currentUserId) ?? false;
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

  get inviteUsernameControl() {
    return this.inviteForm.controls.username;
  }

  get inviteQuery(): string {
    return (this.inviteUsernameControl.value ?? '').trim();
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
              this.data.school = { ...this.data.school, logoUrl: null } as CollectionDTO;

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
    this.inviteSuccessMessage = null;
    this.inviteErrorMessage = null;

    if (!this.isAdmin || this.invitingTeacher) {
      return;
    }

    if (this.inviteForm.invalid || !this.selectedInviteUser) {
      this.inviteForm.markAllAsTouched();

      if (!this.selectedInviteUser && this.inviteQuery.length >= 2) {
        this.inviteUsernameControl.setErrors({ userNotSelected: true });
      }

      return;
    }

    this.invitingTeacher = true;

    this.inviteTeacherByUsername(this.selectedInviteUser.username)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.invitingTeacher = false)))
      .subscribe({
        next: () => {
          this.inviteSuccessMessage = this.translate.instant('schoolSettings.snackbar.inviteSent');

          this.inviteForm.reset({ username: '' }, { emitEvent: false });
          this.inviteUsernameControl.setErrors(null);
          this.inviteForm.markAsPristine();
          this.inviteForm.markAsUntouched();
          this.selectedInviteUser = null;
          this.userSearchResults = [];

          if (this.inviteSuccessMessage != null) {
            this.snack.open(this.inviteSuccessMessage, 'OK', {duration: 2000});
          }
        },
        error: error => {
          this.inviteErrorMessage =
            typeof error?.error === 'string'
              ? error.error
              : error?.error?.message ?? this.translate.instant('common.error');

          if (this.inviteErrorMessage != null) {
            this.snack.open(this.inviteErrorMessage, 'OK', {duration: 3000});
          }
        }
      });
  }

  selectInviteUser(user: UserDTO): void {
    this.selectedInviteUser = user;
    this.inviteUsernameControl.setValue(user.username, { emitEvent: false });
    this.inviteUsernameControl.setErrors(null);
  }

  clearInviteUser(): void {
    this.selectedInviteUser = null;
    this.inviteForm.reset({ username: '' });
    this.userSearchResults = [];
  }

  isUserAlreadyInSchool(user: UserDTO): boolean {
    return user.id === this.data.school.admin?.id
      || user.username === this.data.school.admin?.username
      || this.data.school.members.some(member =>
        member.id === user.id || member.username === user.username
      );
  }

  getInviteUserSecondary(user: UserDTO): string {
    const email = (user as UserDTO & { email?: string }).email;
    return email || this.translate.instant('schoolSettings.usernameResultHint');
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
      width: '600px',
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

  leaveCollection(): void {
    if (!this.isMember || this.isAdmin || this.leavingSchool) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '600px',
      maxWidth: 'calc(100vw - 24px)',
      disableClose: true,
      data: {
        title: this.translate.instant('schoolSettings.leaveSchoolTitle'),
        message: this.translate.instant('schoolSettings.leaveSchoolMessage', {
          name: this.data.school.name
        }),
        confirmText: this.translate.instant('schoolSettings.leaveSchoolConfirm'),
        cancelText: this.translate.instant('common.cancel')
      }
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed: boolean) => {
        if (!confirmed) {
          return;
        }

        this.leavingSchool = true;

        this.service.leaveCollection(this.data.schoolId)
          .pipe(takeUntil(this.destroy$), finalize(() => (this.leavingSchool = false)))
          .subscribe({
            next: () => {
              this.snack.open(
                this.translate.instant('schoolSettings.snackbar.schoolLeft'),
                'OK',
                { duration: 3000 }
              );

              this.router.navigate(['/']);
              this.dialogRef.close({ left: true });
            },
            error: error => {
              this.snack.open(
                typeof error?.error === 'string'
                  ? error.error
                  : error?.error?.message ?? this.translate.instant('schoolSettings.snackbar.schoolLeaveError'),
                'OK',
                { duration: 4000 }
              );
            }
          });
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
    if (!user?.id || !user.profileImageUrl) {
      return null;
    }

    return this.avatarUrls.get(user.id) ?? null;
  }


  private setupUserSearch(): void {
    this.inviteUsernameControl.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        map(value => (value ?? '').trim()),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap(query => {
          this.selectedInviteUser = null;
          this.inviteSuccessMessage = null;
          this.inviteErrorMessage = null;

          if (query.length < 2) {
            this.searchingTeachers = false;
            return of([] as UserDTO[]);
          }

          this.searchingTeachers = true;

          return this.searchUsersByUsername(query).pipe(
            catchError(() => of([] as UserDTO[])),
            finalize(() => {
              this.searchingTeachers = false;
              this.cdr.markForCheck();
            })
          );
        })
      )
      .subscribe(users => {
        this.userSearchResults = users.filter(user => !!user?.username);
      });
  }

  private searchUsersByUsername(query: string): Observable<UserDTO[]> {
    const normalizedQuery = query.toLowerCase().trim();

    return of(
      this.fullUsernameList
        .filter(username =>
          username.toLowerCase().includes(normalizedQuery)
        )
        .slice(0, 10)
        .map(username => ({
          id: username,
          username,
          profileImageUrl: null
        } as unknown as UserDTO))
    );
  }

  private inviteTeacherByUsername(username: string): Observable<unknown> {
    return this.service.inviteTeacher(this.data.schoolId, username);
  }

  private loadMemberAvatars(): void {
    this.loadAvatar(this.data.school.admin);
    this.data.school.members.forEach(member => this.loadAvatar(member));
  }

  private loadAvatar(user: UserDTO | null | undefined): void {
    if (!user?.id || !user.profileImageUrl || this.loadingAvatarIds.has(user.id)) {
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
          this.cdr.markForCheck();
        },
        error: () => {
          this.revokeAvatarUrl(user.id);
          this.loadingAvatarIds.delete(user.id);
          this.cdr.markForCheck();
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
