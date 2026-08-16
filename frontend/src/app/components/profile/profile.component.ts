import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Subject, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { HttpService } from '../../service/http.service';
import { User, UserSettings } from '../../model/User';
import { ConfirmDialogComponent } from '../../dialog/confirm-dialog/confirm-dialog.component';
import { ThemeService } from '../../service/theme.service';
import { LanguageService } from '../../service/language.service';
import { NavbarActionsService } from '../navigation/navbar-actions.service';
import { MatProgressBar } from '@angular/material/progress-bar';
import { AuthService } from '../../service/auth.service';

type ProfileLanguage = 'de' | 'en';
type ProfileSettings = {
  darkMode: boolean;
  language: ProfileLanguage;
  allowInvitations: boolean;
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, MatIcon, MatButton, MatFormFieldModule, MatInput, TranslatePipe, MatProgressBar],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpService);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroy$ = new Subject<void>();
  private readonly themeService = inject(ThemeService);
  private readonly languageService = inject(LanguageService);
  protected readonly translate = inject(TranslateService);
  private readonly navbarActions = inject(NavbarActionsService);
  private readonly auth = inject(AuthService);

  user: User | null = null;
  loading = true;

  selectedAvatarFile: File | null = null;
  avatarPreviewUrl: string | null = null;
  avatarObjectUrl: string | null = null;

  savingUsername = false;
  savingAvatar = false;
  savingSettings = false;
  deletingAccount = false;
  isDraggingAvatar = false;

  private settingsReady = false;
  private lastSavedSettings: ProfileSettings = { darkMode: false, language: 'de', allowInvitations: true };
  private queuedSettings: ProfileSettings | null = null;

  readonly maxAvatarBytes = 2 * 1024 * 1024;
  readonly allowedAvatarTypes = ['image/jpeg', 'image/png', 'image/webp'];

  usernameForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(40)]]
  });

  settingsForm = new FormGroup({
    darkMode: new FormControl<boolean>(false, { nonNullable: true }),
    language: new FormControl<ProfileLanguage>('de', { nonNullable: true, validators: [Validators.required] }),
    allowInvitations: new FormControl<boolean>(true, { nonNullable: true }),
  });

  ngOnInit(): void {
    this.setupSettingsAutoSave();
    this.loadUser();
    this.setNavbarActions();
  }

  ngOnDestroy(): void {
    this.revokeAvatarObjectUrl();
    this.destroy$.next();
    this.destroy$.complete();
    this.navbarActions.clearAll();
  }

  private setNavbarActions(): void {
    this.navbarActions.setBreadcrumbs([{ labelKey: 'profile.title', route: '/profile' }]);
    this.navbarActions.setActions([{ labelKey: 'common.logout', icon: 'logout', variant: 'flat', action: () => this.logout() }]);
  }

  loadUser(): void {
    this.loading = true;
    this.http.getUser()
      .pipe(takeUntil(this.destroy$), finalize(() => this.loading = false))
      .subscribe({
        next: (user: User) => {
          this.user = user;
          this.usernameForm.patchValue({ username: user?.username ?? '' });

          const resolvedSettings = this.resolveSettings(user.settings);
          this.settingsForm.patchValue(resolvedSettings, { emitEvent: false });
          this.applyResolvedSettings(resolvedSettings);
          this.lastSavedSettings = resolvedSettings;
          this.settingsReady = true;
          this.loadAvatar();
        },
        error: () => {
          this.snack.open(this.translate.instant('snackbar.userLoadedError'), 'OK', { duration: 3500 });
        }
      });
  }

  private setupSettingsAutoSave(): void {
    this.settingsForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(350),
        distinctUntilChanged((prev, curr) => prev.darkMode === curr.darkMode && prev.language === curr.language && prev.allowInvitations === curr.allowInvitations)
      )
      .subscribe(() => {
        if (!this.settingsReady || this.settingsForm.invalid) return;
        const settings = this.getCurrentSettings();
        this.applyResolvedSettings(settings);
        this.persistSettings(settings);
      });
  }

  private resolveSettings(settings?: UserSettings | null): ProfileSettings {
    return {
      darkMode: this.themeService.resolveDarkMode(settings?.darkMode ?? null),
      language: this.languageService.resolveLanguage(settings?.language ?? null),
      allowInvitations: settings?.allowInvitations ?? true
    };
  }

  private getCurrentSettings(): ProfileSettings {
    return {
      darkMode: this.settingsForm.controls.darkMode.value,
      language: this.settingsForm.controls.language.value ?? 'de',
      allowInvitations: this.settingsForm.controls.allowInvitations.value
    };
  }

  private applyResolvedSettings(settings: ProfileSettings): void {
    this.themeService.setDarkMode(settings.darkMode);
    this.languageService.applyUserPreference(settings.language);
  }

  private persistSettings(settings: ProfileSettings): void {
    if (this.areSettingsEqual(settings, this.lastSavedSettings)) return;
    if (this.savingSettings) {
      this.queuedSettings = settings;
      return;
    }

    this.savingSettings = true;
    this.http.updateUserSettings({ darkMode: settings.darkMode, language: settings.language, allowInvitations: settings.allowInvitations })
      .pipe(takeUntil(this.destroy$), finalize(() => {
        this.savingSettings = false;
        if (this.queuedSettings) {
          const queued = { ...this.queuedSettings };
          this.queuedSettings = null;
          if (!this.areSettingsEqual(queued, this.lastSavedSettings)) this.persistSettings(queued);
        }
      }))
      .subscribe({
        next: () => {
          if (this.user) this.user.settings = { darkMode: settings.darkMode, language: settings.language, allowInvitations: settings.allowInvitations };
          this.lastSavedSettings = { ...settings };
        },
        error: (err) => {
          const fallback = this.lastSavedSettings;
          this.settingsForm.patchValue(fallback, { emitEvent: false });
          this.applyResolvedSettings(fallback);
          this.snack.open(typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.settingsSaveError'), 'OK', { duration: 3500 });
        }
      });
  }

  private areSettingsEqual(a: ProfileSettings, b: ProfileSettings): boolean {
    return a.darkMode === b.darkMode && a.language === b.language && a.allowInvitations === b.allowInvitations;
  }

  saveUsername(): void {
    if (this.usernameForm.invalid || this.savingUsername) {
      this.usernameForm.markAllAsTouched();
      return;
    }

    const username = this.usernameForm.controls.username.value?.trim() ?? '';
    this.savingUsername = true;
    this.http.updateUsername(username)
      .pipe(takeUntil(this.destroy$), finalize(() => this.savingUsername = false))
      .subscribe({
        next: () => {
          if (this.user) this.user.username = username;
          window.dispatchEvent(new Event('storage'));
          this.snack.open(this.translate.instant('snackbar.usernameUpdated'), 'OK', { duration: 3000 });
        },
        error: (err) => this.snack.open(typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.usernameUpdateError'), 'OK', { duration: 3500 })
      });
  }

  confirmDeleteAccount(): void {
    if (this.deletingAccount) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '600px',
      maxWidth: 'calc(100vw - 24px)',
      disableClose: true,
      data: {
        title: this.translate.instant('dialog.deleteAccountTitle'),
        message: this.translate.instant('dialog.deleteAccountMessage'),
        confirmText: this.translate.instant('dialog.deleteAccountConfirm'),
        cancelText: this.translate.instant('common.cancel'),
        requireConfirmation: true,
        confirmationText: this.translate.instant('dialog.confirmPhrase')
      }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((confirmed: boolean) => {
      if (confirmed) this.deleteAccount();
    });
  }

  deleteAccount(): void {
    this.deletingAccount = true;
    this.http.deleteAccount()
      .pipe(takeUntil(this.destroy$), finalize(() => this.deletingAccount = false))
      .subscribe({
        next: () => this.auth.logout(),
        error: (err) => this.snack.open(typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.accountDeleteError'), 'OK', { duration: 3500 })
      });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (file) {
      this.setAvatarFile(file);
    }

    input.value = '';
  }

  onAvatarDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }

    this.isDraggingAvatar = true;
  }

  onAvatarDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const currentTarget = event.currentTarget as HTMLElement | null;
    const relatedTarget = event.relatedTarget as Node | null;

    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }

    this.isDraggingAvatar = false;
  }

  onAvatarDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingAvatar = false;

    const file = event.dataTransfer?.files?.[0] ?? null;
    if (!file) return;

    this.setAvatarFile(file);
  }

  private setAvatarFile(file: File): void {
    if (!this.allowedAvatarTypes.includes(file.type)) {
      this.snack.open(this.translate.instant('snackbar.imageTypeError'), 'OK', { duration: 3000 });
      return;
    }

    if (file.size > this.maxAvatarBytes) {
      this.snack.open(this.translate.instant('snackbar.imageSizeError'), 'OK', { duration: 3200 });
      return;
    }

    this.selectedAvatarFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.avatarPreviewUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  saveAvatar(): void {
    if (!this.selectedAvatarFile || this.savingAvatar) return;

    this.savingAvatar = true;
    this.http.uploadProfileImage(this.selectedAvatarFile)
      .pipe(takeUntil(this.destroy$), finalize(() => this.savingAvatar = false))
      .subscribe({
        next: (imageUrl: string) => {
          this.avatarPreviewUrl = null;
          if (this.user) this.user.profileImageUrl = imageUrl;
          this.selectedAvatarFile = null;
          this.loadAvatar();
          window.dispatchEvent(new Event('storage'));
          this.snack.open(this.translate.instant('snackbar.avatarUpdated'), 'OK', { duration: 3000 });
        },
        error: (err) => this.snack.open(typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.avatarUpdateError'), 'OK', { duration: 3500 })
      });
  }

  clearAvatarSelection(): void {
    this.selectedAvatarFile = null;
    this.avatarPreviewUrl = null;
  }

  logout(): void { this.auth.logout(); }

  getDisplayName(): string { return this.user?.username || this.translate.instant('profile.fallbackName'); }
  getDisplayEmail(): string { return this.user?.email || this.translate.instant('profile.fallbackEmail'); }
  getPlanLabel(): string { return this.user?.subscriptionModel || 'FREE'; }

  getAvatarUrl(): string | null {
    return this.avatarPreviewUrl || this.avatarObjectUrl;
  }

  private loadAvatar(): void {
    this.revokeAvatarObjectUrl();
    if (!this.user?.id || !this.user?.profileImageUrl) return;

    this.http.getProfileImage(this.user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: blob => {
          this.revokeAvatarObjectUrl();
          this.avatarObjectUrl = URL.createObjectURL(blob);
        },
        error: () => this.avatarObjectUrl = null
      });
  }

  private revokeAvatarObjectUrl(): void {
    if (this.avatarObjectUrl) {
      URL.revokeObjectURL(this.avatarObjectUrl);
      this.avatarObjectUrl = null;
    }
  }

  getInitials(): string { return this.http.getUserInitials(this.user); }

  hasUsernameError(error: string): boolean {
    return !!this.usernameForm.controls.username.touched && !!this.usernameForm.controls.username.hasError(error);
  }

  deleteAvatar(): void {
    if (!this.user?.profileImageUrl) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('dialog.deleteAvatarTitle'),
        message: this.translate.instant('dialog.deleteAvatarMessage'),
        confirmText: this.translate.instant('common.delete'),
        cancelText: this.translate.instant('common.cancel')
      }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.http.deleteProfileImage()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            if (this.user) this.user.profileImageUrl = null;
            this.revokeAvatarObjectUrl();
            this.snack.open(this.translate.instant('snackbar.avatarDeleted'), 'OK', { duration: 3000 });
          },
          error: () => this.snack.open(this.translate.instant('snackbar.avatarDeleteError'), 'OK', { duration: 3000 })
        });
    });
  }
}
