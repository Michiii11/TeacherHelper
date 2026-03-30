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
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 2rem 1rem;
      background:
        radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 24%),
        radial-gradient(circle at top right, rgba(99, 102, 241, 0.10), transparent 18%),
        linear-gradient(180deg, #f8fbff 0%, #f3f6fb 100%);
    }

    .not-found-card {
      width: min(100%, 560px);
      padding: 2.2rem 2rem;
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.18);
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
      text-align: center;
    }

    .code {
      font-size: clamp(4.5rem, 10vw, 6.5rem);
      line-height: 1;
      font-weight: 800;
      color: #2563eb;
      margin-bottom: 0.6rem;
    }

    h1 {
      margin: 0;
      font-size: 2rem;
      font-weight: 700;
      color: #0f172a;
    }

    p {
      margin: 0.8rem auto 0;
      max-width: 420px;
      color: #64748b;
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

    :host-context(.dark-mode) .not-found-shell {
      background:
        radial-gradient(circle at top left, rgba(37, 99, 235, 0.14), transparent 28%),
        radial-gradient(circle at top right, rgba(79, 70, 229, 0.16), transparent 22%),
        linear-gradient(180deg, #0b1120 0%, #111827 100%);
    }

    :host-context(.dark-mode) .not-found-card {
      background: rgba(17, 24, 39, 0.9);
      border-color: rgba(71, 85, 105, 0.55);
      box-shadow: 0 28px 70px rgba(0, 0, 0, 0.42);
    }

    :host-context(.dark-mode) .code {
      color: #60a5fa;
    }

    :host-context(.dark-mode) h1 {
      color: #f8fafc;
    }

    :host-context(.dark-mode) p {
      color: #94a3b8;
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
