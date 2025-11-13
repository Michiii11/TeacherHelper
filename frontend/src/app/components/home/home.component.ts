import { Component } from '@angular/core';
import {MatButton} from '@angular/material/button'
import {MatDialog} from '@angular/material/dialog'
import {HttpClient} from '@angular/common/http'
import {AddSchoolDialogComponent} from '../../dialog/add-school-dialog/add-school-dialog.component'
import {Config} from '../../config'
import {School, SchoolDTO} from '../../model/School'
import {HttpService} from '../../service/http.service'
import {MatCard, MatCardContent, MatCardHeader, MatCardTitle} from '@angular/material/card'
import {MatFormField, MatInput, MatLabel} from '@angular/material/input'
import {FormsModule} from '@angular/forms'
import {NgForOf, NgIf} from '@angular/common'
import {Router} from '@angular/router'
import {MatIcon} from '@angular/material/icon'

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
export class HomeComponent {
  yourSchools : SchoolDTO[] = [];
  allOtherSchools : SchoolDTO[] = [];
  otherSchools : SchoolDTO[] = [];

  constructor(private dialog: MatDialog, private http: HttpService, private router: Router) {}

  ngOnInit() {
    this.http.getYourSchools().subscribe((schools: SchoolDTO[]) => {
      this.yourSchools = schools;

      this.http.getSchools().subscribe((schools: SchoolDTO[]) => {
        this.allOtherSchools = schools.filter(school => !this.yourSchools.some(yourSchool => yourSchool.id === school.id));
        this.otherSchools = [...this.allOtherSchools];
      })
    })
  }

  filterSchools(e: Event) {
    if(!e) {
      this.otherSchools = [...this.allOtherSchools];
      return;
    }

    const search = (e.target as HTMLInputElement).value;

    const term = search?.toLowerCase() || '';
    this.otherSchools = this.allOtherSchools.filter(school =>
      school.name.toLowerCase().includes(term)
    );
  }

  openCreateDialog() {
    const dialogRef = this.dialog.open(AddSchoolDialogComponent);
    dialogRef.afterClosed().subscribe(schoolName => {
      if (schoolName) {
        this.http.addSchool(schoolName).subscribe({
          next: (value) => {
            this.http.getYourSchools().subscribe((schools: SchoolDTO[]) => {
              this.yourSchools = schools;
            });
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

  protected readonly HTMLInputElement = HTMLInputElement
}
