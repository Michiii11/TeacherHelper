import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

import { NavbarActionsService } from '../navigation/navbar-actions.service';
import {APP_CHANGELOG} from '../../../../public/data/changelog.data'

type HelpTab = 'docs' | 'changelog';

type HelpCard = {
  icon: string;
  titleKey: string;
  textKey: string;
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
      icon: 'data_object',
      titleKey: 'help.docs.variables.title',
      textKey: 'help.docs.variables.text'
    },
    {
      icon: 'functions',
      titleKey: 'help.docs.editor.title',
      textKey: 'help.docs.editor.text'
    },
    {
      icon: 'groups',
      titleKey: 'help.docs.team.title',
      textKey: 'help.docs.team.text'
    },
    {
      icon: 'print',
      titleKey: 'help.docs.print.title',
      textKey: 'help.docs.print.text'
    },
    {
      icon: 'cloud_done',
      titleKey: 'help.docs.cloud.title',
      textKey: 'help.docs.cloud.text'
    }
  ];

  readonly changelog = APP_CHANGELOG;

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
