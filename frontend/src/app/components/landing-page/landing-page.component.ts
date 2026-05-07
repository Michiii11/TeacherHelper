import { Component, inject } from '@angular/core';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../service/auth.service';

type Feature = { icon: string; title: string; text: string };
type Plan = { name: string; price: string; subtitle: string; features: string[]; badge?: string; highlight?: boolean };

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [NgFor, NgIf, AsyncPipe, RouterLink, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent {
  private readonly auth = inject(AuthService);
  readonly isLoggedIn$ = this.auth.loggedIn$;

  readonly features: Feature[] = [
    { icon: 'inventory_2', title: 'landing.featureCards.collections.title', text: 'landing.featureCards.collections.text' },
    { icon: 'account_tree', title: 'landing.featureCards.variables.title', text: 'landing.featureCards.variables.text' },
    { icon: 'functions', title: 'landing.featureCards.editor.title', text: 'landing.featureCards.editor.text' },
    { icon: 'groups', title: 'landing.featureCards.team.title', text: 'landing.featureCards.team.text' },
    { icon: 'print', title: 'landing.featureCards.print.title', text: 'landing.featureCards.print.text' },
    { icon: 'cloud_done', title: 'landing.featureCards.cloud.title', text: 'landing.featureCards.cloud.text' }
  ];

  readonly plans: Plan[] = [
    { name: 'Free', price: '0€', subtitle: 'landing.plans.free.subtitle', features: ['landing.plans.free.f1', 'landing.plans.free.f2', 'landing.plans.free.f3'] },
    { name: 'Pro', price: '5€ / Monat', subtitle: 'landing.plans.pro.subtitle', badge: 'landing.plans.pro.badge', highlight: true, features: ['landing.plans.pro.f1', 'landing.plans.pro.f2', 'landing.plans.pro.f3'] },
    { name: 'School', price: '30€ / Monat', subtitle: 'landing.plans.school.subtitle', features: ['landing.plans.school.f1', 'landing.plans.school.f2', 'landing.plans.school.f3'] }
  ];

  login(): void { this.auth.login(); }
  register(): void { this.auth.register(); }

  getLogo(): string {
    return document.body.classList.contains('dark-mode') ? '/darkmode.png' : '/lightmode.png';
  }

  getImage(): string {
    return document.body.classList.contains('dark-mode') ? '/screen_dark.png' : '/screen_light.png';
  }

  trackByValue(_: number, value: string): string { return value; }
  trackByFeature(_: number, feature: Feature): string { return feature.title; }
  trackByPlan(_: number, plan: Plan): string { return plan.name; }
}
