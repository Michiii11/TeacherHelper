import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import {MatButtonToggle, MatButtonToggleGroup} from '@angular/material/button-toggle'
import {FormsModule} from '@angular/forms'

type HelpTab = 'docs' | 'changelog';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    TranslatePipe,
    MatButtonToggle,
    MatButtonToggleGroup,
    FormsModule
  ],
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss'
})
export class HelpComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  activeTab = signal<HelpTab>('changelog');

  readonly quickHighlights = [
    {
      icon: 'auto_awesome',
      titleKey: 'help.highlights.h1.title',
      textKey: 'help.highlights.h1.text'
    },
    {
      icon: 'flash_on',
      titleKey: 'help.highlights.h2.title',
      textKey: 'help.highlights.h2.text'
    },
    {
      icon: 'groups',
      titleKey: 'help.highlights.h3.title',
      textKey: 'help.highlights.h3.text'
    }
  ];

  readonly sideCardPoints = [
    'help.sidecard.p1',
    'help.sidecard.p2',
    'help.sidecard.p3'
  ];

  readonly docsSections = [
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

  readonly changelog = [
    {
      version: 'v1.1.0',
      isLatest: true,
      titleKey: 'help.changelog.v110.title',
      descriptionKey: 'help.changelog.v110.description',
      changes: [
        'help.changelog.v110.c1',
        'help.changelog.v110.c2',
        'help.changelog.v110.c3'
      ]
    },
    {
      version: 'v1.0.0',
      isLatest: false,
      titleKey: 'help.changelog.v100.title',
      descriptionKey: 'help.changelog.v100.description',
      changes: [
        'help.changelog.v100.c1',
        'help.changelog.v100.c2',
        'help.changelog.v100.c3'
      ]
    }
  ];

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab');
      this.activeTab.set(tab === 'docs' ? 'docs' : 'changelog');
    });
  }

  onTabChange(index: number): void {
    const tab: HelpTab = index === 1 ? 'changelog' : 'docs';
    this.activeTab.set(tab);

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }
}
