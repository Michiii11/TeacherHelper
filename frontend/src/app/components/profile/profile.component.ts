import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDivider } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';
import * as CryptoJS from 'crypto-js';
import { HttpService } from '../../service/http.service';
import { User } from '../../model/User';
import { ConfirmDialogComponent } from '../../dialog/confirm-dialog/confirm-dialog.component';
import { ThemeService } from '../../service/theme.service';

type ProfileSettings = {
  darkMode: boolean;
  language: string;
  allowInvitations: boolean;
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIcon,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatDivider
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

  private readonly DARK_MODE_KEY = 'teacher_settings_dark_mode';
  private readonly LANGUAGE_KEY = 'teacher_settings_language';

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
    darkMode: [false],
    language: ['de', [Validators.required]],
    allowInvitations: [true]
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
    this.loadLocalSettings();
    this.setupSettingsAutoSave();
    this.loadUser();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

          this.settingsForm.patchValue({
            darkMode: this.getStoredDarkMode(),
            language: this.getStoredLanguage(),
            allowInvitations: (user as any)?.allowInvitations ?? true
          }, { emitEvent: false });

          this.lastSavedSettings = this.getCurrentSettings();
          this.settingsReady = true;
        },
        error: () => {
          this.snack.open('Benutzerdaten konnten nicht geladen werden', 'OK', { duration: 3500 });
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
        this.applyLocalSettings(settings.darkMode, settings.language);
        this.persistSettings(settings);
      });
  }

  private loadLocalSettings(): void {
    const darkMode = this.getStoredDarkMode();
    const language = this.getStoredLanguage();

    this.settingsForm.patchValue(
      {
        darkMode,
        language
      },
      { emitEvent: false }
    );

    this.applyLocalSettings(darkMode, language);
  }

  private getStoredDarkMode(): boolean {
    return localStorage.getItem(this.DARK_MODE_KEY) === 'true';
  }

  private getStoredLanguage(): string {
    return localStorage.getItem(this.LANGUAGE_KEY) || 'de';
  }

  private getCurrentSettings(): ProfileSettings {
    return {
      darkMode: !!this.settingsForm.controls.darkMode.value,
      language: this.settingsForm.controls.language.value ?? 'de',
      allowInvitations: !!this.settingsForm.controls.allowInvitations.value
    };
  }

  private applyLocalSettings(darkMode: boolean, language: string): void {
    localStorage.setItem(this.DARK_MODE_KEY, String(darkMode));
    localStorage.setItem(this.LANGUAGE_KEY, language);
    this.themeService.setDarkMode(darkMode);
    document.documentElement.lang = language;
  }

  private persistSettings(settings: ProfileSettings): void {
    const allowInvitationsChanged = settings.allowInvitations !== this.lastSavedSettings.allowInvitations;
    const onlyLocalChanged =
      settings.darkMode !== this.lastSavedSettings.darkMode
      || settings.language !== this.lastSavedSettings.language;

    if (!allowInvitationsChanged) {
      if (onlyLocalChanged) {
        this.lastSavedSettings = { ...settings };
      }
      return;
    }

    if (this.savingSettings) {
      this.queuedSettings = settings;
      return;
    }

    this.savingSettings = true;

    this.http.updateAllowInvitations(settings.allowInvitations)
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
            (this.user as any).allowInvitations = settings.allowInvitations;
          }

          this.lastSavedSettings = { ...settings };
        },
        error: (err) => {
          const reverted = Boolean((this.user as any)?.allowInvitations ?? true);

          this.settingsForm.patchValue({
            allowInvitations: reverted
          }, { emitEvent: false });

          this.lastSavedSettings = this.getCurrentSettings();

          this.snack.open(
            typeof err?.error === 'string' ? err.error : 'Einstellungen konnten nicht gespeichert werden',
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
          this.snack.open('Benutzername wurde aktualisiert', 'OK', { duration: 3000 });
        },
        error: (err) => {
          this.snack.open(typeof err?.error === 'string' ? err.error : 'Benutzername konnte nicht geändert werden', 'OK', {
            duration: 3500
          });
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
          this.snack.open(typeof err?.error === 'string' ? err.error : 'E-Mail-Änderung konnte nicht angefordert werden', 'OK', {
            duration: 3500
          });
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
          this.snack.open(typeof err?.error === 'string' ? err.error : 'Offene E-Mail-Änderung konnte nicht gelöscht werden', 'OK', {
            duration: 3500
          });
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
      this.snack.open('Die neuen Passwörter stimmen nicht überein', 'OK', { duration: 3200 });
      return;
    }

    if (currentPasswordRaw === newPasswordRaw) {
      this.snack.open('Das neue Passwort muss sich vom alten unterscheiden', 'OK', { duration: 3200 });
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
          this.snack.open('Passwort wurde geändert', 'OK', { duration: 3000 });
        },
        error: (err) => {
          this.snack.open(typeof err?.error === 'string' ? err.error : 'Passwort konnte nicht geändert werden', 'OK', {
            duration: 3500
          });
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
        title: 'Account endgültig löschen?',
        message: 'Diese Aktion kann nicht rückgängig gemacht werden. Dein Konto wird deaktiviert und du wirst sofort ausgeloggt.',
        confirmText: 'Endgültig löschen',
        cancelText: 'Abbrechen',
        requireConfirmation: true,
        confirmationText: 'Ich möchte meinen Account endgültig löschen'
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
          this.snack.open(typeof err?.error === 'string' ? err.error : 'Account konnte nicht gelöscht werden', 'OK', {
            duration: 3500
          });
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
      this.snack.open('Bitte nur JPG, PNG oder WEBP hochladen', 'OK', { duration: 3000 });
      input.value = '';
      return;
    }

    if (file.size > this.maxAvatarBytes) {
      this.snack.open('Das Bild darf maximal 2 MB groß sein', 'OK', { duration: 3200 });
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
          this.snack.open('Profilbild wurde aktualisiert', 'OK', { duration: 3000 });
        },
        error: (err) => {
          this.snack.open(typeof err?.error === 'string' ? err.error : 'Profilbild konnte nicht gespeichert werden', 'OK', {
            duration: 3500
          });
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
          this.snack.open(typeof err?.error === 'string' ? err.error : 'Abo-Modell konnte nicht geändert werden', 'OK', {
            duration: 3500
          });
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
    return this.user?.username || 'Dein Profil';
  }

  getDisplayEmail(): string {
    return this.user?.email || 'Keine E-Mail hinterlegt';
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
        title: 'Profilbild löschen?',
        message: 'Dein aktuelles Profilbild wird entfernt.',
        confirmText: 'Löschen',
        cancelText: 'Abbrechen'
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
            this.snack.open('Profilbild konnte nicht gelöscht werden', 'OK', { duration: 3000 });
          }
        });
    });
  }
}
