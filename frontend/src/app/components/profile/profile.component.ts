import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';
import * as CryptoJS from 'crypto-js';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { HttpService } from '../../service/http.service';
import { User, UserSettings } from '../../model/User';
import { ConfirmDialogComponent } from '../../dialog/confirm-dialog/confirm-dialog.component';
import { ThemeService } from '../../service/theme.service';
import { LanguageService } from '../../service/language.service';
import {NavbarActionsService} from '../navigation/navbar-actions.service'
import {AddSchoolDialogComponent} from '../../dialog/add-school-dialog/add-school-dialog.component'

type ProfileSettings = {
  darkMode: boolean;
  language: 'de' | 'en';
  allowInvitations: boolean;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIcon,
    MatButton,
    MatFormFieldModule,
    MatInput,
    TranslatePipe
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpService);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly themeService = inject(ThemeService);
  private readonly languageService = inject(LanguageService);
  private readonly translate = inject(TranslateService);

  navbarActions = inject(NavbarActionsService)

  user: User | null = null;
  loading = true;

  selectedAvatarFile: File | null = null;
  avatarPreviewUrl: string | null = null;

  savingUsername = false;
  savingEmail = false;
  savingPassword = false;
  savingAvatar = false;
  savingSubscription = false;
  savingSettings = false;
  cancelingPendingEmail = false;
  deletingAccount = false;

  private settingsReady = false;
  private lastSavedSettings: ProfileSettings = {
    darkMode: false,
    language: 'de',
    allowInvitations: true
  };
  private queuedSettings: ProfileSettings | null = null;

  readonly maxAvatarBytes = 2 * 1024 * 1024;
  readonly allowedAvatarTypes = ['image/jpeg', 'image/png', 'image/webp'];

  usernameForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(40)]]
  });

  emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]]
  });

  passwordForm = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(120)]],
    confirmPassword: ['', [Validators.required]]
  });

  settingsForm = this.fb.group({
    darkMode: [false, { nonNullable: true }],
    language: ['de' as 'de' | 'en', [Validators.required]],
    allowInvitations: [true, { nonNullable: true }]
  });

  deleteAccountForm = this.fb.group({
    currentPassword: ['', [Validators.required]]
  });

  plans = [
    {
      key: 'FREE' as const,
      name: 'FREE',
      subtitle: 'Für den Einstieg',
      features: ['Profil und Grundfunktionen', 'Schulzugriff', 'Basisverwaltung']
    },
    {
      key: 'PRO' as const,
      name: 'PRO',
      subtitle: 'Für regelmäßige Nutzung',
      features: ['Alles aus FREE', 'Mehr Komfort', 'Besser für aktive Lehrkräfte']
    },
    {
      key: 'ENTERPRISE' as const,
      name: 'ENTERPRISE',
      subtitle: 'Für größere Organisationen',
      features: ['Alles aus PRO', 'Erweiterbare Prozesse', 'Ideal für umfangreiche Nutzung']
    }
  ];

  ngOnInit(): void {
    this.setupSettingsAutoSave();
    this.loadUser();
    this.setNavbarActions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.navbarActions.clearActions();
  }

  private setNavbarActions(): void {
    this.navbarActions.setActions([
      {
        labelKey: 'common.logout',
        icon: 'logout',
        variant: 'flat',
        action: () => this.logout()
      }
    ]);
  }

  loadUser(): void {
    this.loading = true;

    this.http.getUser()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (user: User) => {
          this.user = user;
          this.usernameForm.patchValue({ username: user?.username ?? '' });
          this.emailForm.patchValue({ email: user?.email ?? '' });

          const resolvedSettings = this.resolveSettings(user.settings);

          this.settingsForm.patchValue(resolvedSettings, { emitEvent: false });
          this.applyResolvedSettings(resolvedSettings);

          this.lastSavedSettings = resolvedSettings;
          this.settingsReady = true;
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
        distinctUntilChanged((prev, curr) =>
          prev.darkMode === curr.darkMode
          && prev.language === curr.language
          && prev.allowInvitations === curr.allowInvitations
        )
      )
      .subscribe(() => {
        if (!this.settingsReady || this.settingsForm.invalid) {
          return;
        }

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
      darkMode: this.settingsForm.controls.darkMode.value as boolean,
      language: this.settingsForm.controls.language.value ?? 'de',
      allowInvitations: this.settingsForm.controls.allowInvitations.value as boolean
    };
  }

  private applyResolvedSettings(settings: ProfileSettings): void {
    this.themeService.setDarkMode(settings.darkMode);
    this.languageService.applyUserPreference(settings.language);
  }

  private persistSettings(settings: ProfileSettings): void {
    if (this.areSettingsEqual(settings, this.lastSavedSettings)) {
      return;
    }

    if (this.savingSettings) {
      this.queuedSettings = settings;
      return;
    }

    this.savingSettings = true;

    this.http.updateUserSettings({
      darkMode: settings.darkMode,
      language: settings.language,
      allowInvitations: settings.allowInvitations
    })
      .pipe(finalize(() => {
        this.savingSettings = false;

        if (this.queuedSettings) {
          const queued = { ...this.queuedSettings };
          this.queuedSettings = null;

          if (!this.areSettingsEqual(queued, this.lastSavedSettings)) {
            this.persistSettings(queued);
          }
        }
      }))
      .subscribe({
        next: () => {
          if (this.user) {
            this.user.settings = {
              darkMode: settings.darkMode,
              language: settings.language,
              allowInvitations: settings.allowInvitations
            };
          }

          this.lastSavedSettings = { ...settings };
        },
        error: (err) => {
          const fallback = this.lastSavedSettings;

          this.settingsForm.patchValue(fallback, { emitEvent: false });
          this.applyResolvedSettings(fallback);

          this.snack.open(
            typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.settingsSaveError'),
            'OK',
            { duration: 3500 }
          );
        }
      });
  }

  private areSettingsEqual(a: ProfileSettings, b: ProfileSettings): boolean {
    return a.darkMode === b.darkMode
      && a.language === b.language
      && a.allowInvitations === b.allowInvitations;
  }

  saveUsername(): void {
    if (this.usernameForm.invalid || this.savingUsername) {
      this.usernameForm.markAllAsTouched();
      return;
    }

    const username = this.usernameForm.controls.username.value?.trim() ?? '';

    this.savingUsername = true;
    this.http.updateUsername(username)
      .pipe(finalize(() => this.savingUsername = false))
      .subscribe({
        next: () => {
          if (this.user) {
            this.user.username = username;
          }
          window.dispatchEvent(new Event('storage'));
          this.snack.open(this.translate.instant('snackbar.usernameUpdated'), 'OK', { duration: 3000 });
        },
        error: (err) => {
          this.snack.open(
            typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.usernameUpdateError'),
            'OK',
            { duration: 3500 }
          );
        }
      });
  }

  saveEmail(): void {
    if (this.emailForm.invalid || this.savingEmail) {
      this.emailForm.markAllAsTouched();
      return;
    }

    const email = this.emailForm.controls.email.value?.trim() ?? '';

    this.savingEmail = true;
    this.http.updateEmail(email)
      .pipe(finalize(() => this.savingEmail = false))
      .subscribe({
        next: (message: string) => {
          if (this.user) {
            this.user.pendingEmail = email;
          }
          this.snack.open(message, 'OK', { duration: 3500 });
        },
        error: (err) => {
          this.snack.open(
            typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.emailRequestError'),
            'OK',
            { duration: 3500 }
          );
        }
      });
  }

  cancelPendingEmailChange(): void {
    if (!this.user?.pendingEmail || this.cancelingPendingEmail) {
      return;
    }

    this.cancelingPendingEmail = true;
    this.http.cancelPendingEmailChange()
      .pipe(finalize(() => this.cancelingPendingEmail = false))
      .subscribe({
        next: (message: string) => {
          if (this.user) {
            this.user.pendingEmail = null as any;
          }
          this.emailForm.patchValue({ email: this.user?.email ?? '' });
          this.snack.open(message, 'OK', { duration: 3200 });
        },
        error: (err) => {
          this.snack.open(
            typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.pendingEmailDeleteError'),
            'OK',
            { duration: 3500 }
          );
        }
      });
  }

  savePassword(): void {
    if (this.passwordForm.invalid || this.savingPassword) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const currentPasswordRaw = this.passwordForm.controls.currentPassword.value ?? '';
    const newPasswordRaw = this.passwordForm.controls.newPassword.value ?? '';
    const confirmPasswordRaw = this.passwordForm.controls.confirmPassword.value ?? '';

    if (newPasswordRaw !== confirmPasswordRaw) {
      this.snack.open(this.translate.instant('snackbar.passwordMismatch'), 'OK', { duration: 3200 });
      return;
    }

    if (currentPasswordRaw === newPasswordRaw) {
      this.snack.open(this.translate.instant('snackbar.passwordSame'), 'OK', { duration: 3200 });
      return;
    }

    const currentPassword = CryptoJS.SHA256(currentPasswordRaw).toString();
    const newPassword = CryptoJS.SHA256(newPasswordRaw).toString();

    this.savingPassword = true;
    this.http.changePassword({ currentPassword, newPassword })
      .pipe(finalize(() => this.savingPassword = false))
      .subscribe({
        next: () => {
          this.passwordForm.reset();
          this.snack.open(this.translate.instant('snackbar.passwordChanged'), 'OK', { duration: 3000 });
        },
        error: (err) => {
          this.snack.open(
            typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.passwordChangeError'),
            'OK',
            { duration: 3500 }
          );
        }
      });
  }

  confirmDeleteAccount(): void {
    if (this.deleteAccountForm.invalid || this.deletingAccount) {
      this.deleteAccountForm.markAllAsTouched();
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
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

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.deleteAccount();
      }
    });
  }

  deleteAccount(): void {
    if (this.deleteAccountForm.invalid || this.deletingAccount) {
      this.deleteAccountForm.markAllAsTouched();
      return;
    }

    const currentPasswordRaw = this.deleteAccountForm.controls.currentPassword.value ?? '';
    const currentPassword = CryptoJS.SHA256(currentPasswordRaw).toString();

    this.deletingAccount = true;
    this.http.deleteAccount(currentPassword)
      .pipe(finalize(() => this.deletingAccount = false))
      .subscribe({
        next: (message: string) => {
          localStorage.removeItem('teacher_authToken');
          localStorage.removeItem('teacher_userId');
          window.dispatchEvent(new Event('storage'));
          this.snack.open(message, 'OK', { duration: 3000 });
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.snack.open(
            typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.accountDeleteError'),
            'OK',
            { duration: 3500 }
          );
        }
      });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!this.allowedAvatarTypes.includes(file.type)) {
      this.snack.open(this.translate.instant('snackbar.imageTypeError'), 'OK', { duration: 3000 });
      input.value = '';
      return;
    }

    if (file.size > this.maxAvatarBytes) {
      this.snack.open(this.translate.instant('snackbar.imageSizeError'), 'OK', { duration: 3200 });
      input.value = '';
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
    if (!this.selectedAvatarFile || this.savingAvatar) {
      return;
    }

    this.savingAvatar = true;
    this.http.uploadProfileImage(this.selectedAvatarFile)
      .pipe(finalize(() => this.savingAvatar = false))
      .subscribe({
        next: (imageUrl: string) => {
          this.avatarPreviewUrl = null;
          if (this.user) {
            this.user.profileImageUrl = imageUrl;
          }
          this.selectedAvatarFile = null;
          window.dispatchEvent(new Event('storage'));
          this.snack.open(this.translate.instant('snackbar.avatarUpdated'), 'OK', { duration: 3000 });
        },
        error: (err) => {
          this.snack.open(
            typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.avatarUpdateError'),
            'OK',
            { duration: 3500 }
          );
        }
      });
  }

  clearAvatarSelection(): void {
    this.selectedAvatarFile = null;
    this.avatarPreviewUrl = null;
  }

  upgradeTo(plan: 'FREE' | 'PRO' | 'ENTERPRISE'): void {
    if (!this.user || this.user.subscriptionModel === plan || this.savingSubscription) {
      return;
    }

    this.savingSubscription = true;
    this.http.updateSubscription(plan)
      .pipe(finalize(() => this.savingSubscription = false))
      .subscribe({
        next: (message: string) => {
          if (this.user) {
            this.user.subscriptionModel = plan;
          }
          this.snack.open(message, 'OK', { duration: 3000 });
        },
        error: (err) => {
          this.snack.open(
            typeof err?.error === 'string' ? err.error : this.translate.instant('snackbar.subscriptionUpdateError'),
            'OK',
            { duration: 3500 }
          );
        }
      });
  }

  logout(): void {
    localStorage.removeItem('teacher_authToken');
    localStorage.removeItem('teacher_userId');
    window.dispatchEvent(new Event('storage'));
    this.router.navigate(['/login']);
  }

  getDisplayName(): string {
    return this.user?.username || this.translate.instant('profile.fallbackName');
  }

  getDisplayEmail(): string {
    return this.user?.email || this.translate.instant('profile.fallbackEmail');
  }

  getPlanLabel(): string {
    return this.user?.subscriptionModel || 'FREE';
  }

  getAvatarUrl(): string | null {
    if (this.avatarPreviewUrl) {
      return this.avatarPreviewUrl;
    }

    return this.http.getAvatarUrl(this.user);
  }

  getInitials(): string {
    return this.http.getUserInitials(this.user);
  }

  isCurrentPlan(plan: 'FREE' | 'PRO' | 'ENTERPRISE'): boolean {
    return this.user?.subscriptionModel === plan;
  }

  hasUsernameError(error: string): boolean {
    return !!this.usernameForm.controls.username.touched && !!this.usernameForm.controls.username.hasError(error);
  }

  hasEmailError(error: string): boolean {
    return !!this.emailForm.controls.email.touched && !!this.emailForm.controls.email.hasError(error);
  }

  deleteAvatar(): void {
    if (!this.user?.profileImageUrl) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('dialog.deleteAvatarTitle'),
        message: this.translate.instant('dialog.deleteAvatarMessage'),
        confirmText: this.translate.instant('common.delete'),
        cancelText: this.translate.instant('common.cancel')
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.http.deleteProfileImage()
        .subscribe({
          next: (msg: string) => {
            if (this.user) {
              this.user.profileImageUrl = null;
            }
            this.snack.open(msg, 'OK', { duration: 3000 });
          },
          error: () => {
            this.snack.open(this.translate.instant('snackbar.avatarDeleteError'), 'OK', { duration: 3000 });
          }
        });
    });
  }
}
