import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

import { NavbarActionsService } from '../navigation/navbar-actions.service';

type HelpTab = 'docs' | 'changelog';

type HelpCard = {
  icon: string;
  titleKey: string;
  textKey: string;
};

type ChangelogEntry = {
  version: string;
  isLatest: boolean;
  changes: string[];
};

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonToggleModule,
    MatIconModule,
    TranslatePipe
  ],
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss'
})
export class HelpComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly navbarActions = inject(NavbarActionsService);

  readonly activeTab = signal<HelpTab>('changelog');

  readonly docsSections: HelpCard[] = [
    {
      icon: 'folder_copy',
      titleKey: 'help.docs.collections.title',
      textKey: 'help.docs.collections.text'
    },
    {
      icon: 'assignment',
      titleKey: 'help.docs.examplesTests.title',
      textKey: 'help.docs.examplesTests.text'
    },
    {
      icon: 'manage_search',
      titleKey: 'help.docs.searchFilter.title',
      textKey: 'help.docs.searchFilter.text'
    },
    {
      icon: 'outgoing_mail',
      titleKey: 'help.docs.invites.title',
      textKey: 'help.docs.invites.text'
    }
  ];

  readonly changelog: ChangelogEntry[] = [
    {
      version: 'v1.1.0',
      isLatest: true,
      changes: [
        'help.changelog.v110.c1',
        'help.changelog.v110.c2',
        'help.changelog.v110.c3'
      ]
    },
    {
      version: 'v1.0.0',
      isLatest: false,
      changes: [
        'help.changelog.v100.c1',
        'help.changelog.v100.c2',
        'help.changelog.v100.c3'
      ]
    }
  ];

  ngOnInit(): void {
    this.syncTabFromQueryParams();
    this.setNavbarActions();
  }

  ngOnDestroy(): void {
    this.navbarActions.clearAll();
  }

  onTabChange(event: MatButtonToggleChange): void {
    this.setActiveTab(event.value === 'docs' ? 'docs' : 'changelog');
  }

  private syncTabFromQueryParams(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.activeTab.set(params.get('tab') === 'docs' ? 'docs' : 'changelog');
      });
  }

  private setActiveTab(tab: HelpTab): void {
    this.activeTab.set(tab);

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }

  private setNavbarActions(): void {
    this.navbarActions.setBreadcrumbs([
      {
        labelKey: 'navbar.help',
        route: ['/help']
      }
    ]);

    this.navbarActions.setActions([
      {
        labelKey: 'help.startTutorial',
        icon: 'add_circle',
        variant: 'flat',
        action: () => {}
      }
    ]);
  }
}
