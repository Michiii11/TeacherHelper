import { Component } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [
    MatButton,
    RouterLink
  ],
  template: `
    <div class="not-found-shell">
      <div class="not-found-card">
        <div class="code">404</div>
        <h1>Seite nicht gefunden</h1>
        <p>Die angeforderte Seite existiert leider nicht oder wurde verschoben.</p>
        <button mat-raised-button color="primary" routerLink="/">Zur Startseite</button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100%;
    }

    .not-found-shell {
      min-height: 70vh;
      display: grid;
      place-items: center;
      padding: 2rem 1rem;
    }

    .not-found-card {
      width: min(100%, 560px);
      padding: 2.2rem 2rem;
      background: var(--bg-soft);
      border: 1px solid var(--border-soft);
      box-shadow: var(--shadow-lg);
      text-align: center;
      border-radius: 1rem;
    }

    .code {
      font-size: clamp(4.5rem, 10vw, 6.5rem);
      line-height: 1;
      font-weight: 800;
      color: var(--primary);
      margin-bottom: 0.6rem;
    }

    h1 {
      margin: 0;
      font-size: 2rem;
      font-weight: 700;
      color: var(--text);
    }

    p {
      margin: 0.8rem auto 0;
      max-width: 420px;
      color: var(--text-soft);
      font-size: 1.02rem;
      line-height: 1.55;
    }

    button {
      margin-top: 1.4rem;
      min-height: 46px;
      padding: 0 1.2rem;
      border-radius: 14px;
      font-weight: 700;
    }

    .mat-mdc-raised-button {
      color: var(--theme-on-primary) !important;
      background-color: var(--primary) !important;
    }

    @media (max-width: 640px) {
      .not-found-shell {
        padding: 1rem 0.75rem;
      }

      .not-found-card {
        padding: 1.6rem 1.2rem;
        border-radius: 22px;
      }

      h1 {
        font-size: 1.6rem;
      }

      p {
        font-size: 0.96rem;
      }
    }
  `]
})
export class NotFoundComponent {}
