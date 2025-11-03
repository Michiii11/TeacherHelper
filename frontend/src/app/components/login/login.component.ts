import { Component } from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms'
import {MatError, MatFormField, MatInput, MatLabel} from '@angular/material/input'
import {MatButton} from '@angular/material/button'
import * as CryptoJS from 'crypto-js';
import {AuthService} from '../../service/auth.service'
import {MatTab, MatTabGroup} from '@angular/material/tabs'
import {MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardTitle} from '@angular/material/card'
import {MatIcon} from '@angular/material/icon'
import {NgClass, NgIf} from '@angular/common'
import {AuthResult} from '../../model/User'
import {MatSnackBar} from '@angular/material/snack-bar'
import {Router} from '@angular/router'

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  standalone: true,
  imports: [
    MatTabGroup,
    MatCardTitle,
    MatLabel,
    MatError,
    MatTab,
    ReactiveFormsModule,
    MatFormField,
    MatInput,
    MatButton,
    MatCard,
    MatIcon,
    MatCardHeader,
    MatCardContent,
    NgIf,
    MatCardActions,
    NgClass
  ],
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  loginForm: FormGroup;
  registerForm: FormGroup;

  loginMessage = '';
  loginSuccess = false;
  registerMessage = '';
  registerSuccess = false;
  selectedTab = 0;

  constructor(private fb: FormBuilder, private snackBar: MatSnackBar, private authService: AuthService, private router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
    this.registerForm = this.fb.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onTabChange(index: number) {
    this.selectedTab = index;
    this.loginMessage = '';
    this.registerMessage = '';
    this.loginForm.reset();
    this.registerForm.reset();
  }

  onLogin() {
    const value = this.loginForm.value;
    const hashedPassword = CryptoJS.SHA256(value.password).toString();
    const payload = { ...value, password: hashedPassword };

    this.authService.login(payload).subscribe((result: AuthResult) => {
      this.loginSuccess = result.success;
      this.loginMessage = result.message;
      this.snackBar.open(result.message, '', { duration: 3000, panelClass: result.success ? 'snack-success' : 'snack-error' });
      if (result.success) {
        localStorage.setItem('teacher_authToken', result.token);
        localStorage.setItem('teacher_userId', result.userId.toString());
        this.authService.setLogin(result.token, result.userId.toString());
        this.router.navigate(['']);
      }
    });
  }

  onRegister() {
    const value = this.registerForm.value;
    const hashedPassword = CryptoJS.SHA256(value.password).toString();
    const payload = { ...value, password: hashedPassword };

    this.authService.register(payload).subscribe((result: AuthResult) => {
      this.registerSuccess = result.success;
      this.registerMessage = result.message;
      this.snackBar.open(result.message, '', { duration: 3000, panelClass: result.success ? 'snack-success' : 'snack-error' });
      if (result.success) {
        this.authService.setLogin(result.token, result.userId.toString());
        localStorage.setItem('teacher_authToken', result.token);
        localStorage.setItem('teacher_userId', result.userId.toString());
        this.router.navigate(['']);
      }
    });
  }
}
