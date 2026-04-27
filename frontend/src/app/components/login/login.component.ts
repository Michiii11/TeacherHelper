import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatError, MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import * as CryptoJS from 'crypto-js';
import { HttpService } from '../../service/http.service';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { MatCard, MatCardActions, MatCardContent } from '@angular/material/card';
import { NgClass, NgIf } from '@angular/common';
import { AuthResult, User } from '../../model/User';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../service/auth.service';
import { ThemeService } from '../../service/theme.service';
import { AppLanguage, LanguageService } from '../../service/language.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  standalone: true,
  imports: [
    MatTabGroup,
    MatLabel,
    MatError,
    MatTab,
    ReactiveFormsModule,
    MatFormField,
    MatInput,
    MatButton,
    MatCard,
    MatCardContent,
    NgIf,
    MatCardActions,
    NgClass,
    MatButtonToggle,
    MatButtonToggleGroup,
    TranslatePipe,
    MatIcon
  ],
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  registerForm: FormGroup;
  forgotForm: FormGroup;
  resetForm: FormGroup;

  loginMessage = '';
  loginSuccess = false;
  registerMessage = '';
  registerSuccess = false;
  forgotMessage = '';
  forgotSuccess = false;
  resetMessage = '';
  resetSuccess = false;

  selectedTab = 0;
  resetToken: string | null = null;
  verifying = false;
  showForgotPassword = false;

  hideLoginPassword = true;
  hideRegisterPassword = true;
  hideResetPassword = true;
  hideResetConfirmPassword = true;

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private http: HttpService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private themeService: ThemeService,
    protected languageService: LanguageService,
    private translate: TranslateService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });

    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.resetForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.themeService.init();
    this.languageService.init();

    const token = localStorage.getItem('teacher_authToken');
    const userId = localStorage.getItem('teacher_userId');

    if (token && userId) {
      this.router.navigate(['/home']);
      return;
    }

    this.route.queryParamMap.subscribe(params => {
      const verifyToken = params.get('verifyToken');
      const resetToken = params.get('resetToken');

      if (verifyToken) {
        this.handleVerifyEmail(verifyToken);
      }

      if (resetToken) {
        this.resetToken = resetToken;
        this.showForgotPassword = true;
        this.selectedTab = 0;
      }
    });
  }

  get selectedLanguage(): AppLanguage {
    return this.languageService.resolveLanguage(undefined);
  }

  get selectedTheme(): 'light' | 'dark' {
    return this.themeService.resolveDarkMode(undefined) ? 'dark' : 'light';
  }

  onTabChange(index: number): void {
    this.selectedTab = index;
    this.clearMessages();

    if (!this.resetToken) {
      this.showForgotPassword = false;
    }
  }

  onLanguageChange(language: AppLanguage): void {
    this.languageService.setLanguage(language);

  }

  onThemeChange(theme: 'light' | 'dark'): void {
    this.themeService.setDarkMode(theme === 'dark');
  }

  openForgotPassword(): void {
    this.showForgotPassword = true;
    this.clearMessages();

    const email = this.loginForm.get('email')?.value;
    if (email) {
      this.forgotForm.patchValue({ email });
    }
  }

  closeForgotPassword(): void {
    if (this.resetToken) {
      return;
    }

    this.showForgotPassword = false;
    this.forgotMessage = '';
    this.resetMessage = '';
  }

  onLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const value = this.loginForm.value;
    const hashedPassword = CryptoJS.SHA256(value.password).toString();
    const payload = {
      ...value,
      password: hashedPassword,
      language: this.selectedLanguage,
      darkMode: this.selectedTheme === 'dark'
    };

    this.http.login(payload).subscribe((result: AuthResult) => {
      this.loginSuccess = result.success;
      this.loginMessage = this.translate.instant('auth.backend.AUTH_SUCCESS');

      if(!result.success) {
        this.loginMessage = this.translate.instant('auth.backend.' + result.code);
      }


      this.snackBar.open(this.loginMessage, '', {
        duration: 3000,
        panelClass: result.success ? 'snack-success' : 'snack-error'
      });

      if (result.success && result.token && result.userId !== null) {
        this.authService.setLogin(result.token, result.userId);

        this.http.getUser().subscribe({
          next: user => {
            this.applyResolvedPreferences(user);
            this.syncGuestPreferencesToBackendIfMissing(user);
            this.router.navigate(['/home']);
          },
          error: () => {
            this.router.navigate(['/home']);
          }
        });
      }
    });
  }

  onRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const value = this.registerForm.value;
    const hashedPassword = CryptoJS.SHA256(value.password).toString();
    const payload = {
      ...value,
      password: hashedPassword,
      language: this.selectedLanguage,
      darkMode: this.selectedTheme === 'dark'
    };

    this.http.register(payload).subscribe((result: AuthResult) => {
      this.registerSuccess = result.success;
      this.registerMessage = this.translateAuthResult(result);

      this.snackBar.open(this.registerMessage, '', {
        duration: 3500,
        panelClass: result.success ? 'snack-success' : 'snack-error'
      });

      if (result.success && result.token && result.userId !== null) {
        this.authService.setLogin(result.token, result.userId);

        this.http.getUser().subscribe({
          next: user => {
            this.applyResolvedPreferences(user);
            this.syncGuestPreferencesToBackendIfMissing(user);
            this.router.navigate(['/home']);
          },
          error: () => {
            this.router.navigate(['/home']);
          }
        });

        return;
      }

      if (result.success) {
        this.hideRegisterPassword = true;
      }
    });
  }

  onForgotPassword(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.http.forgotPassword(this.forgotForm.value.email, this.languageService.getStoredLanguage()).subscribe({
      next: () => {
        this.forgotSuccess = true;
        this.forgotMessage = this.translate.instant('auth.messages.forgotSuccess');
        this.snackBar.open(this.forgotMessage, '', { duration: 3500, panelClass: 'snack-success' });
      },
      error: (err) => {
        const message = this.translateHttpError(err, 'auth.messages.forgotError');
        this.forgotSuccess = false;
        this.forgotMessage = message;
        this.snackBar.open(message, '', { duration: 3500, panelClass: 'snack-error' });
      }
    });
  }

  onResetPassword(): void {
    if (this.resetForm.invalid || !this.resetToken) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const password = this.resetForm.value.password;
    const confirmPassword = this.resetForm.value.confirmPassword;

    if (password !== confirmPassword) {
      this.resetSuccess = false;
      this.resetMessage = this.translate.instant('auth.messages.passwordMismatch');
      this.snackBar.open(this.resetMessage, '', { duration: 3500, panelClass: 'snack-error' });
      return;
    }

    const hashedPassword = CryptoJS.SHA256(password).toString();

    this.http.resetPassword(this.resetToken, hashedPassword).subscribe({
      next: () => {
        this.resetSuccess = true;
        this.resetMessage = this.translate.instant('auth.messages.resetSuccess');

        this.snackBar.open(this.resetMessage, '', {
          duration: 3500,
          panelClass: 'snack-success'
        });

        this.resetForm.reset();
        this.hideResetPassword = true;
        this.hideResetConfirmPassword = true;

        this.resetToken = null;
        this.showForgotPassword = false;
        this.selectedTab = 0;

        this.router.navigate([], {
          queryParams: { resetToken: null },
          queryParamsHandling: 'merge'
        });
      },
      error: (err) => {
        const message = this.translateHttpError(err, 'auth.messages.resetError');
        this.resetSuccess = false;
        this.resetMessage = message;
        this.snackBar.open(message, '', { duration: 3500, panelClass: 'snack-error' });
      }
    });
  }

  resendVerificationFromRegister(): void {
    const email = this.registerForm.value.email;

    if (!email) {
      this.snackBar.open(this.translate.instant('auth.messages.enterRegisterEmailFirst'), '', {
        duration: 3000,
        panelClass: 'snack-error'
      });
      return;
    }

    this.http.resendVerification(email, this.languageService.getStoredLanguage()).subscribe({
      next: () => {
        const message = this.translate.instant('auth.messages.resendSuccess');
        this.snackBar.open(message, '', { duration: 3500, panelClass: 'snack-success' });
      },
      error: (err) => {
        const message = this.translateHttpError(err, 'auth.messages.resendError');
        this.snackBar.open(message, '', { duration: 3500, panelClass: 'snack-error' });
      }
    });
  }

  private handleVerifyEmail(token: string): void {
    this.verifying = true;

    this.http.verifyEmail(token).subscribe({
      next: () => {
        this.verifying = false;
        const message = this.translate.instant('auth.messages.verifySuccess');
        this.snackBar.open(message, '', { duration: 3500, panelClass: 'snack-success' });
        this.router.navigate([], {
          queryParams: { verifyToken: null },
          queryParamsHandling: 'merge'
        });
      },
      error: (err) => {
        this.verifying = false;
        const message = this.translateHttpError(err, 'auth.messages.verifyError');
        this.snackBar.open(message, '', { duration: 3500, panelClass: 'snack-error' });
        this.router.navigate([], {
          queryParams: { verifyToken: null },
          queryParamsHandling: 'merge'
        });
      }
    });
  }


  private translateAuthResult(result: AuthResult): string {
    const code = result?.code?.trim();

    if (code) {
      const translated = this.translate.instant(`auth.backend.${code}`);
      if (translated !== `auth.backend.${code}`) {
        return translated;
      }
    }

    return this.translateBackendText(result?.message, result?.success ? 'auth.messages.success' : 'auth.messages.error');
  }

  private translateHttpError(err: any, fallbackKey: string): string {
    return this.translateBackendText(this.extractBackendError(err), fallbackKey);
  }

  private extractBackendError(err: any): string | null {
    if (typeof err?.error === 'string') {
      return err.error;
    }

    if (typeof err?.error?.message === 'string') {
      return err.error.message;
    }

    if (typeof err?.message === 'string') {
      return err.message;
    }

    return null;
  }

  private translateBackendText(message: string | null | undefined, fallbackKey: string): string {
    const normalized = (message ?? '').trim();

    if (!normalized) {
      return this.translate.instant(fallbackKey);
    }

    const directKey = `auth.backend.${normalized}`;
    const directTranslation = this.translate.instant(directKey);
    if (directTranslation !== directKey) {
      return directTranslation;
    }

    const mappedKey = this.backendMessageKey(normalized);
    return mappedKey ? this.translate.instant(mappedKey) : normalized;
  }

  private backendMessageKey(message: string): string | null {
    const map: Record<string, string> = {
      'username, mail and password are required.': 'auth.backend.INVALID_DATA',
      'email and password are required.': 'auth.backend.INVALID_DATA',
      'username must be between 3 and 40 characters.': 'auth.backend.INVALID_USERNAME',
      'please enter a valid email address.': 'auth.backend.INVALID_EMAIL',
      'email is too long.': 'auth.backend.INVALID_EMAIL',
      'password must be at least 8 characters long.': 'auth.backend.INVALID_PASSWORD',
      'new password must be at least 8 characters long.': 'auth.backend.INVALID_PASSWORD',
      'username already exists.': 'auth.backend.USERNAME_TAKEN',
      'email already exists.': 'auth.backend.EMAIL_TAKEN',
      'invalid credentials.': 'auth.backend.INVALID_CREDENTIALS',
      'email is not verified.': 'auth.backend.EMAIL_NOT_VERIFIED',
      'token is required.': 'auth.backend.TOKEN_REQUIRED',
      'verification token is invalid.': 'auth.backend.VERIFICATION_TOKEN_INVALID',
      'verification token expired.': 'auth.backend.VERIFICATION_TOKEN_EXPIRED',
      'email is required.': 'auth.backend.EMAIL_REQUIRED',
      'email not found.': 'auth.backend.EMAIL_NOT_FOUND',
      'email is already verified.': 'auth.backend.EMAIL_ALREADY_VERIFIED',
      'user not found.': 'auth.backend.USER_NOT_FOUND',
      'new password is required.': 'auth.backend.NEW_PASSWORD_REQUIRED',
      'invalid password reset token.': 'auth.backend.PASSWORD_RESET_TOKEN_INVALID',
      'password reset token expired.': 'auth.backend.PASSWORD_RESET_TOKEN_EXPIRED'
    };

    return map[message.trim().toLowerCase()] ?? null;
  }

  private applyResolvedPreferences(user: User): void {
    const resolvedDarkMode = this.themeService.resolveDarkMode(user.settings?.darkMode ?? null);
    const resolvedLanguage = this.languageService.resolveLanguage(user.settings?.language ?? null);

    this.themeService.setDarkMode(resolvedDarkMode);
    this.languageService.applyUserPreference(resolvedLanguage);
  }

  private syncGuestPreferencesToBackendIfMissing(user: User): void {
    const shouldSyncDarkMode = user.settings?.darkMode === null || user.settings?.darkMode === undefined;
    const shouldSyncLanguage = !user.settings?.language;

    if (!shouldSyncDarkMode && !shouldSyncLanguage) {
      return;
    }

    this.http.updateUserSettings({
      darkMode: this.themeService.resolveDarkMode(user.settings?.darkMode ?? null),
      language: this.languageService.resolveLanguage(user.settings?.language ?? null),
      allowInvitations: user.settings?.allowInvitations ?? true
    }).subscribe({
      next: () => {},
      error: () => {}
    });
  }

  private clearMessages(): void {
    this.loginMessage = '';
    this.registerMessage = '';
    this.forgotMessage = '';
    this.resetMessage = '';
  }

  getLogo(): string {
    return this.selectedTheme === 'dark' ? '/darkmode.png' : '/lightmode.png';
  }
}
