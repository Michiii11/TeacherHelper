import {Component, inject, OnInit} from '@angular/core';
import {MatButton} from '@angular/material/button'
import {MatDialog} from '@angular/material/dialog'
import {AddSchoolDialogComponent} from '../../dialog/add-school-dialog/add-school-dialog.component'
import {SchoolDTO} from '../../model/School'
import {HttpService} from '../../service/http.service'
import {MatCard} from '@angular/material/card'
import {MatFormField, MatInput, MatLabel} from '@angular/material/input'
import {FormsModule} from '@angular/forms'
import {NgForOf, NgIf} from '@angular/common'
import {Router} from '@angular/router'
import {MatIcon} from '@angular/material/icon'
import {MatSnackBar} from '@angular/material/snack-bar'
import {SchoolInvitationComponent} from '../../dialog/school-invitation/school-invitation.component'

@Component({
  selector: 'app-home',
  imports: [
    MatButton,
    MatCard,
    MatFormField,
    MatLabel,
    FormsModule,
    MatInput,
    NgForOf,
    MatIcon,
    NgIf
  ],
  templateUrl: './home.component.html',
  standalone: true,
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit{
  adminSchools: SchoolDTO[] = [];
  memberSchools: SchoolDTO[] = [];
  allOtherSchools: SchoolDTO[] = [];
  otherSchools: SchoolDTO[] = [];

  userId: number = 0;

  snack = inject(MatSnackBar);

  constructor(private dialog: MatDialog, private http: HttpService, private router: Router) {}

  ngOnInit() {
    this.loadSchools();
  }

  loadSchools() {
    this.http.getYourSchools().subscribe((schools: SchoolDTO[]) => {
      this.http.getUserId().subscribe((id: number) => {
        this.userId = id;

        this.adminSchools = schools.filter((school) => this.isAdminSchool(school, this.userId));
        this.memberSchools = schools.filter((school) => !this.isAdminSchool(school, this.userId));

        this.http.getSchools().subscribe((allSchools: SchoolDTO[]) => {
          this.allOtherSchools = allSchools.filter(
            school => !schools.some(yourSchool => yourSchool.id === school.id)
          );
          this.otherSchools = [...this.allOtherSchools];
        })
      })
    })
  }

  filterSchools(e: Event) {
    if(!e) {
      this.otherSchools = [...this.allOtherSchools];
      return;
    }

    const search = (e.target as HTMLInputElement).value;
    const term = search?.toLowerCase().trim() || '';

    this.otherSchools = this.allOtherSchools.filter(school =>
      school.name?.toLowerCase().includes(term) ||
      school.admin?.username?.toLowerCase().includes(term)
    );
  }

  openCreateDialog() {
    const dialogRef = this.dialog.open(AddSchoolDialogComponent);
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

  openSchool(school: SchoolDTO) {
    this.router.navigate(['/school', school.id]);
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

  getSchoolRoleLabel(type: 'admin' | 'member'): string {
    return type === 'admin' ? 'Admin' : 'Mitglied';
  }

  private isAdminSchool(school: SchoolDTO, userId: number): boolean {
    if (!school?.admin) return false;
    if (!userId) return false;

    return school.admin.id === userId;
  }

  protected openInvitationDialog(school: SchoolDTO) {
    const ref = this.dialog.open(SchoolInvitationComponent, {
      width: '520px',
      data: {
        schoolId: school.id,
        schoolName: school.name
      }
    });

    ref.afterClosed().subscribe((result) => {
      if (!result) return;

      this.http.sendJoinRequest(school.id, result).subscribe({
        next: () => {
          this.snack.open('Beitrittsanfrage gesendet', 'OK', { duration: 3000 });
        }
      })
    });
  }
}
