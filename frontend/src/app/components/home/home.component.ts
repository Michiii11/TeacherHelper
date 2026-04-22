import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AddSchoolDialogComponent } from '../../dialog/add-school-dialog/add-school-dialog.component';
import { SchoolDTO } from '../../model/School';
import { HttpService } from '../../service/http.service';
import { MatCard } from '@angular/material/card';
import { FormsModule } from '@angular/forms';
import {NgClass, NgForOf, NgIf} from '@angular/common';
import { Router } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
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
    NgClass
  ],
  templateUrl: './home.component.html',
  standalone: true,
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  schools: SchoolDTO[] = [];
  userId = '';

  constructor(
    private dialog: MatDialog,
    private http: HttpService,
    private router: Router,
    private navbarActions: NavbarActionsService
  ) {}

  ngOnInit(): void {
    this.setNavbarActions();
    this.loadSchools();
  }

  ngOnDestroy(): void {
    this.navbarActions.clearAll();
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
    this.http.getYourSchools().subscribe((schools: SchoolDTO[]) => {
      this.http.getUserId().subscribe((id: string) => {
        this.userId = id;

        this.schools = [...schools].sort((a, b) => {
          const aIsAdmin = this.isAdminSchool(a, this.userId);
          const bIsAdmin = this.isAdminSchool(b, this.userId);

          if (aIsAdmin !== bIsAdmin) {
            return aIsAdmin ? -1 : 1;
          }

          return a.name.localeCompare(b.name);
        });
      });
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(AddSchoolDialogComponent, {
      width: 'min(92vw, 500px)',
      maxWidth: '92vw',
    });

    dialogRef.afterClosed().subscribe(schoolName => {
      if (schoolName) {
        this.http.addSchool(schoolName).subscribe({
          next: () => {
            this.loadSchools();
          },
          error: (err) => {
            console.log('Fehler beim Hinzufügen:', err.error);
          }
        });
      }
    });
  }

  openSchool(school: SchoolDTO): void {
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

  getSchoolRoleLabel(school: SchoolDTO): string {
    return this.isAdminSchool(school, this.userId) ? 'Admin' : 'Mitglied';
  }

  getRoleBadgeClass(school: SchoolDTO): string {
    return this.isAdminSchool(school, this.userId) ? 'admin-badge' : 'member-badge';
  }

  getAvatarClass(school: SchoolDTO): string {
    return this.isAdminSchool(school, this.userId) ? 'school-avatar' : 'school-avatar member-avatar';
  }

  getCardClass(school: SchoolDTO): string {
    return this.isAdminSchool(school, this.userId) ? 'school-card admin-card' : 'school-card member-card';
  }

  private isAdminSchool(school: SchoolDTO, userId: string): boolean {
    if (!school?.admin) return false;
    if (!userId) return false;

    return school.admin.id === userId;
  }

  protected getSchoolLogoUrl(school: SchoolDTO): string {
    return <string>this.http.getSchoolLogo(school, school.id.toString());
  }
}
