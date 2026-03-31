import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

type Feature = {
  icon: string;
  title: string;
  text: string;
};

type Plan = {
  name: string;
  badge?: string;
  price: string;
  subtitle: string;
  features: string[];
  highlight?: boolean;
  cta: string;
};

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf, MatButtonModule, MatIconModule],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent {
  readonly isLoggedIn =
    !!localStorage.getItem('teacher_authToken') &&
    !!localStorage.getItem('teacher_userId');

  readonly features: Feature[] = [
    {
      icon: 'library_books',
      title: 'Beispiele sauber organisieren',
      text: 'Speichere Aufgaben zentral, filtere nach Schwerpunkt und finde Inhalte später sofort wieder.'
    },
    {
      icon: 'assignment',
      title: 'Tests schneller erstellen',
      text: 'Stelle aus vorhandenen Beispielen in wenigen Schritten komplette Tests zusammen.'
    },
    {
      icon: 'groups',
      title: 'Zusammenarbeit in Schulen',
      text: 'Arbeite mit Kolleginnen und Kollegen in einer gemeinsamen Schulumgebung.'
    },
    {
      icon: 'print',
      title: 'Vorschau und Druckansicht',
      text: 'Kontrolliere Tests vor dem Drucken und erhalte übersichtliche, saubere Layouts.'
    },
    {
      icon: 'category',
      title: 'Mehrere Aufgabentypen',
      text: 'Von offenen Fragen bis Multiple Choice, Lückentext oder Zuordnungen – alles an einem Ort.'
    },
    {
      icon: 'school',
      title: 'Für den Schulalltag gedacht',
      text: 'TeacherHelper ist auf reale Unterrichtsvorbereitung und Teamarbeit in Schulen ausgerichtet.'
    }
  ];

  readonly plans: Plan[] = [
    {
      name: 'Free',
      price: 'Kostenlos',
      subtitle: 'Zum Ausprobieren und für kleine Setups.',
      features: [
        'Eigene Inhalte erstellen',
        'Grundlegende Testvorschau',
        'Standardfunktionen für den Einstieg',
        'Ideal für Einzelpersonen'
      ],
      cta: 'Kostenlos starten'
    },
    {
      name: 'Pro',
      badge: 'Beliebt',
      price: 'Flexibel',
      subtitle: 'Für Lehrkräfte, die regelmäßig mit Tests und Beispielen arbeiten.',
      features: [
        'Mehr Inhalte und bessere Organisation',
        'Komfortabler Workflow für den Schulalltag',
        'Erweiterte Nutzung für Unterrichtsvorbereitung',
        'Ideal für intensive Einzel-Nutzung'
      ],
      highlight: true,
      cta: 'Mit Pro loslegen'
    },
    {
      name: 'School',
      price: 'Für Teams',
      subtitle: 'Für Schulen und gemeinsame Verwaltung mit Kolleg:innen.',
      features: [
        'Zusammenarbeit innerhalb einer Schule',
        'Geteilte Inhalte und Aufgabenpools',
        'Bessere Übersicht für Teams',
        'Ideal für Fachgruppen und Schulbetrieb'
      ],
      cta: 'Für Schulen entdecken'
    }
  ];

  readonly heroPoints = [
    'Tests aus Beispielen zusammenbauen',
    'Inhalte langfristig wiederverwenden',
    'Gemeinsam im Schulteam arbeiten'
  ];

  getLogo(): string {
    const isDark = document.body.classList.contains('dark-mode');
    return isDark ? '/darkmode.png' : '/lightmode.png';
  }
}
