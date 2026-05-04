import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { map, startWith } from 'rxjs/operators';

import { NavbarActionsService } from '../navigation/navbar-actions.service';

type LegalPageKey = 'privacy' | 'terms' | 'legal' | 'cookies' | 'support';

type LegalPageSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

type LegalPageContent = {
  title: string;
  subtitle: string;
  sections: LegalPageSection[];
  primaryActionLabel?: string;
  primaryActionHref?: string;
};

const SUPPORT_URL = 'https://github.com/Michiii11/TeacherHelper/issues/new';

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './legal-page.component.html',
  styleUrl: './legal-page.component.scss'
})
export class LegalPageComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly navbarActions = inject(NavbarActionsService);

  private readonly pageKey = toSignal(
    this.route.data.pipe(map(data => this.toLegalPageKey(data['pageKey']))),
    { initialValue: 'privacy' as LegalPageKey }
  );

  private readonly language = toSignal(
    this.translate.onLangChange.pipe(
      map(event => event.lang),
      startWith(this.translate.currentLang || this.translate.getDefaultLang() || 'en')
    ),
    { initialValue: this.translate.currentLang || this.translate.getDefaultLang() || 'en' }
  );

  readonly currentYear = new Date().getFullYear();

  readonly content = computed<LegalPageContent>(() => {
    const key = this.pageKey();
    this.language();

    const sections = this.translate.instant(`legalPages.pages.${key}.sections`);

    return {
      title: this.translate.instant(`legalPages.pages.${key}.title`),
      subtitle: this.translate.instant(`legalPages.pages.${key}.subtitle`),
      sections: Array.isArray(sections) ? sections : [],
      primaryActionLabel: this.translate.instant(`legalPages.pages.${key}.primaryActionLabel`),
      primaryActionHref: key === 'support' ? SUPPORT_URL : undefined
    };
  });

  ngOnInit(): void {
    this.route.data
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.setNavbarActions());
  }

  ngOnDestroy(): void {
    this.navbarActions.clearAll();
  }

  openSupport(): void {
    window.location.href = SUPPORT_URL;
  }

  private setNavbarActions(): void {
    const key = this.pageKey();
    const actions = [
      ...(key === 'support'
        ? [{
          labelKey: `legalPages.pages.${key}.primaryActionLabel`,
          icon: 'open_in_new',
          variant: 'flat' as const,
          action: () => this.openSupport()
        }]
        : []),
      {
        labelKey: 'legalPages.back',
        icon: 'arrow_back',
        variant: 'stroked' as const,
        action: () => void this.router.navigate(['/home'])
      }
    ];

    this.navbarActions.setBreadcrumbs([
      {
        labelKey: `legalPages.pages.${key}.title`,
        route: ['/home']
      }
    ]);

    this.navbarActions.setActions(actions);
  }

  private toLegalPageKey(value: unknown): LegalPageKey {
    return value === 'terms' || value === 'legal' || value === 'cookies' || value === 'support'
      ? value
      : 'privacy';
  }
}
