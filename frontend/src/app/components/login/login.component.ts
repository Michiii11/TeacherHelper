import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatProgressBar } from '@angular/material/progress-bar';
import { AuthService } from '../../service/auth.service';
import { ThemeService } from '../../service/theme.service';
import { LanguageService } from '../../service/language.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [MatCard, MatCardContent, MatProgressBar],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly languageService = inject(LanguageService);

  ngOnInit(): void {
    this.themeService.init();
    this.languageService.init();

    this.auth.loggedIn$.pipe(take(1)).subscribe(isLoggedIn => {
      if (isLoggedIn) {
        this.router.navigate(['/home']);
      } else {
        this.auth.login();
      }
    });
  }

  getLogo(): string {
    return document.body.classList.contains('dark-mode') ? '/darkmode.png' : '/lightmode.png';
  }
}
