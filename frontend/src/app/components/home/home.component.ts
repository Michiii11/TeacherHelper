import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AddCollectionDialogComponent } from '../../dialog/add-collection-dialog/add-collection-dialog.component';
import { CollectionDTO } from '../../model/Collection';
import { HttpService } from '../../service/http.service';
import { MatCard } from '@angular/material/card';
import { FormsModule } from '@angular/forms';
import { NgClass, NgForOf, NgIf } from '@angular/common';
import { Router } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { TranslatePipe } from '@ngx-translate/core';
import { NavbarActionsService } from '../navigation/navbar-actions.service';

@Component({
  selector: 'app-home',
  imports: [
    MatCard,
    FormsModule,
    NgForOf,
    MatIcon,
    NgIf,
    TranslatePipe,
    NgClass,
    MatProgressBar,
  ],
  templateUrl: './home.component.html',
  standalone: true,
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  schools: CollectionDTO[] = [];
  userId = '';
  isSchoolsLoading = true;
  logoUrls: Record<string, string> = {};

  navbarService = inject(NavbarActionsService);

  constructor(
    private dialog: MatDialog,
    private http: HttpService,
    private router: Router,
    private navbarActions: NavbarActionsService
  ) {}

  ngOnInit(): void {
    this.setNavbarActions();
    this.loadSchools();

    this.navbarService.getReloadSchools().subscribe(() => {
      this.loadSchools();
    });
  }

  ngOnDestroy(): void {
    this.navbarActions.clearAll();
    Object.values(this.logoUrls).forEach(url => URL.revokeObjectURL(url));
  }

  private setNavbarActions(): void {
    this.navbarActions.setBreadcrumbs([
      {
        labelKey: 'navbar.home',
        route: ['/home']
      }
    ]);

    this.navbarActions.setActions([
      {
        labelKey: 'home.createSchool',
        icon: 'add_circle',
        variant: 'flat',
        action: () => this.openCreateDialog()
      }
    ]);
  }

  loadSchools(): void {
    this.isSchoolsLoading = true;

    this.http.getYourCollections().subscribe({
      next: (schools: CollectionDTO[]) => {
        console.log(schools)
        this.http.getUserId().subscribe({
          next: (id: string) => {
            this.userId = id;

            this.schools = [...schools].sort((a, b) => {
              const aIsAdmin = this.isAdminSchool(a, this.userId);
              const bIsAdmin = this.isAdminSchool(b, this.userId);

              if (aIsAdmin !== bIsAdmin) {
                return aIsAdmin ? -1 : 1;
              }

              return a.name.localeCompare(b.name);
            });

            this.clearLogoUrls();
            this.schools.forEach(school => this.loadLogo(school));
            this.isSchoolsLoading = false;
          },
          error: () => {
            this.schools = [];
            this.isSchoolsLoading = false;
          }
        });
      },
      error: () => {
        this.schools = [];
        this.isSchoolsLoading = false;
      }
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(AddCollectionDialogComponent, {
      width: 'min(92vw, 500px)',
      maxWidth: '92vw',
    });

    dialogRef.afterClosed().subscribe((createdCollection?: CollectionDTO | { id: string } | false) => {
      const createdId = this.getCreatedCollectionId(createdCollection);

      if (!createdId) {
        return;
      }

      this.router.navigate(['/collection', createdId]);
    });
  }

  private getCreatedCollectionId(response: unknown): string | null {
    if (typeof response === 'string' || typeof response === 'number') {
      const value = String(response).trim();
      return value || null;
    }

    if (response && typeof response === 'object') {
      const item = response as { id?: unknown; collectionId?: unknown };
      const rawId = item.id ?? item.collectionId;

      if (typeof rawId === 'string' || typeof rawId === 'number') {
        const value = String(rawId).trim();
        return value || null;
      }
    }

    return null;
  }

  openSchool(school: CollectionDTO): void {
    this.router.navigate(['/collection', school.id]);
  }

  getSchoolInitials(name?: string): string {
    if (!name) return 'S';

    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('');
  }

  getSchoolRoleLabelKey(school: CollectionDTO): string {
    return this.isAdminSchool(school, this.userId) ? 'home.roles.admin' : 'home.roles.member';
  }

  getRoleBadgeClass(school: CollectionDTO): string {
    return this.isAdminSchool(school, this.userId) ? 'admin-badge' : 'member-badge';
  }

  getAvatarClass(school: CollectionDTO): string {
    return this.isAdminSchool(school, this.userId) ? 'school-avatar' : 'school-avatar member-avatar';
  }

  getCardClass(school: CollectionDTO): string {
    return this.isAdminSchool(school, this.userId) ? 'school-card admin-card' : 'school-card member-card';
  }

  private isAdminSchool(school: CollectionDTO, userId: string): boolean {
    if (!school?.admin) return false;
    if (!userId) return false;

    return school.admin.id === userId;
  }

  private loadLogo(school: CollectionDTO): void {
    if (!school.logoUrl) return;

    this.http.getCollectionLogo(school.id).subscribe({
      next: (blob) => {
        this.logoUrls[school.id] = URL.createObjectURL(blob);
      },
      error: () => {
        this.logoUrls[school.id] = '';
      }
    });
  }

  private clearLogoUrls(): void {
    Object.values(this.logoUrls).forEach(url => URL.revokeObjectURL(url));
    this.logoUrls = {};
  }
}
