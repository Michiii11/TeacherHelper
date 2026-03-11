// file: not-found.component.ts
import { Component } from '@angular/core';
import {MatButton} from '@angular/material/button'
import {RouterLink} from '@angular/router'

@Component({
  selector: 'app-not-found',
  template: `
    <div class="not-found-container">
      <h1>404</h1>
      <h2>Seite nicht gefunden</h2>
      <p>Die angeforderte Seite existiert leider nicht.</p>
      <button mat-raised-button color="primary" routerLink="/">Zur Startseite</button>
    </div>
  `,
  imports: [
    MatButton,
    RouterLink
  ],
  styles: [`
    .not-found-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      height: 80vh;
      gap: 1rem;
      background: #f8fafc;
      color: #1f2937;
      padding: 2rem;
    }

    h1 {
      font-size: 6rem;
      margin: 0;
      font-weight: 700;
      color: #2563eb; /* Blau Akzent */
    }

    h2 {
      font-size: 2rem;
      margin: 0;
    }

    p {
      font-size: 1.1rem;
      color: #4b5563;
    }

    button {
      margin-top: 1rem;
    }
  `]
})
export class NotFoundComponent {}
