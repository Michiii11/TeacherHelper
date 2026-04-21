import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import { map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {NavbarActionsService} from '../navigation/navbar-actions.service'

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

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, TranslateModule],
  templateUrl: './legal-page.component.html',
  styleUrl: './legal-page.component.scss'
})
export class LegalPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  navbarActions = inject(NavbarActionsService)
  router = inject(Router);

  ngOnInit(): void {
    this.setNavbarActions();
  }

  ngOnDestroy(): void {
    this.navbarActions.clearAll();
  }

  private readonly pageKey = toSignal(
    this.route.data.pipe(map(data => (data['pageKey'] as LegalPageKey) ?? 'privacy')),
    { initialValue: 'privacy' as LegalPageKey }
  );

  readonly currentYear = new Date().getFullYear();

  readonly content = computed<LegalPageContent>(() => {
    const key = this.pageKey();
    const language = this.translate.currentLang || this.translate.getDefaultLang() || 'en';

    this.translate.use(language);

    return {
      title: this.translate.instant(`legalPages.pages.${key}.title`),
      subtitle: this.translate.instant(`legalPages.pages.${key}.subtitle`),
      sections: (this.translate.instant(`legalPages.pages.${key}.sections`) as LegalPageSection[]) ?? [],
      primaryActionLabel: this.translate.instant(`legalPages.pages.${key}.primaryActionLabel`),
      primaryActionHref: key === 'support'
        ? 'https://github.com/Michiii11/TeacherHelper/issues/new'
        : undefined,
    };
  });

  private setNavbarActions(): void {
    this.navbarActions.setBreadcrumbs([
      {
        labelKey: `legalPages.pages.${this.pageKey()}.title`,
        route: ['/home']
      }
    ]);

    if(this.pageKey() === 'support') {
      this.navbarActions.setActions([
        {
          labelKey: `legalPages.pages.${this.pageKey()}.primaryActionLabel`,
          icon: 'open_in_new',
          variant: 'flat',
          action: () => {
            window.location.href = 'https://github.com/Michiii11/TeacherHelper/issues/new';
          }
        },
        {
          labelKey: `legalPages.back`,
          icon: 'arrow_back',
          variant: 'stroked',
          action: () => {
            this.router.navigate(['/home'])
          }
        }
      ])
    } else {
      this.navbarActions.setActions([
        {
          labelKey: `legalPages.back`,
          icon: 'arrow_back',
          variant: 'stroked',
          action: () => {
            this.router.navigate(['/home'])
          }
        }
      ]);
    }
  }
}
