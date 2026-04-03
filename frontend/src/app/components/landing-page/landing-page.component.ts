import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

type Feature = {
  icon: string;
  title: string;
  text: string;
};

type Plan = {
  name: string;
  badge?: string;
  chip?: string;
  price: string;
  subtitle: string;
  features: string[];
  highlight?: boolean;
  cta: string;
};

type Stat = {
  value: string;
  label: string;
};

type TrustItem = {
  icon: string;
  label: string;
};

type MockExample = {
  type: string;
  title: string;
  focus: string;
};

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent {
  readonly isLoggedIn =
    !!localStorage.getItem('teacher_authToken') &&
    !!localStorage.getItem('teacher_userId');

  readonly heroPoints: string[] = [
    'landing.points.p1',
    'landing.points.p2',
    'landing.points.p3'
  ];

  readonly trustItems: TrustItem[] = [
    { icon: 'bolt', label: 'landing.trust.t1' },
    { icon: 'groups', label: 'landing.trust.t2' },
    { icon: 'print', label: 'landing.trust.t3' },
    { icon: 'translate', label: 'landing.trust.t4' }
  ];

  readonly features: Feature[] = [
    {
      icon: 'library_books',
      title: 'landing.featureCards.f1.title',
      text: 'landing.featureCards.f1.text'
    },
    {
      icon: 'filter_alt',
      title: 'landing.featureCards.f2.title',
      text: 'landing.featureCards.f2.text'
    },
    {
      icon: 'assignment',
      title: 'landing.featureCards.f3.title',
      text: 'landing.featureCards.f3.text'
    },
    {
      icon: 'description',
      title: 'landing.featureCards.f4.title',
      text: 'landing.featureCards.f4.text'
    },
    {
      icon: 'groups',
      title: 'landing.featureCards.f5.title',
      text: 'landing.featureCards.f5.text'
    },
    {
      icon: 'school',
      title: 'landing.featureCards.f6.title',
      text: 'landing.featureCards.f6.text'
    }
  ];

  readonly plans: Plan[] = [
    {
      name: 'Free',
      price: '0€',
      subtitle: 'landing.plans.free.subtitle',
      features: [
        'landing.plans.free.f1',
        'landing.plans.free.f2',
        'landing.plans.free.f3',
        'landing.plans.free.f4'
      ],
      cta: 'landing.plans.free.cta'
    },
    {
      name: 'Pro',
      badge: 'landing.plans.pro.badge',
      chip: 'landing.plans.pro.chip',
      price: '5€ / Monat',
      subtitle: 'landing.plans.pro.subtitle',
      features: [
        'landing.plans.pro.f1',
        'landing.plans.pro.f2',
        'landing.plans.pro.f3',
        'landing.plans.pro.f4'
      ],
      highlight: true,
      cta: 'landing.plans.pro.cta'
    },
    {
      name: 'School',
      chip: 'landing.plans.school.chip',
      price: '20€ / Monat',
      subtitle: 'landing.plans.school.subtitle',
      features: [
        'landing.plans.school.f1',
        'landing.plans.school.f2',
        'landing.plans.school.f3',
        'landing.plans.school.f4'
      ],
      cta: 'landing.plans.school.cta'
    }
  ];

  readonly mockExamples: MockExample[] = [
    {
      type: 'landing.mock.type1',
      title: 'landing.mock.title1',
      focus: 'landing.mock.focus1'
    },
    {
      type: 'landing.mock.type2',
      title: 'landing.mock.title2',
      focus: 'landing.mock.focus2'
    },
    {
      type: 'landing.mock.type3',
      title: 'landing.mock.title3',
      focus: 'landing.mock.focus3'
    }
  ];

  getLogo(): string {
    const isDark = document.body.classList.contains('dark-mode');
    return isDark ? '/darkmode.png' : '/lightmode.png';
  }

  getImage() {
    const isDark = document.body.classList.contains('dark-mode');
    return isDark ? '/screen_dark.png' : '/screen_light.png';
  }
}
