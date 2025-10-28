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
import {NgForOf} from '@angular/common'
import {Router} from '@angular/router'

@Component({
  selector: 'app-home',
  imports: [
    MatButton,
    MatCard,
    MatCardTitle,
    MatCardContent,
    MatCardHeader,
    MatFormField,
    MatLabel,
    FormsModule,
    MatInput,
    NgForOf
  ],
  templateUrl: './home.component.html',
  standalone: true,
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  schools : SchoolDTO[] = [];
  yourSchoolsSearch = '';
  otherSchoolsSearch = '';

  constructor(private dialog: MatDialog, private http: HttpService, private router: Router) {}

  ngOnInit() {
    this.http.getSchools().subscribe((schools: SchoolDTO[]) => {
      this.schools = schools;
    })
  }

  get yourSchools() {
    return this.schools.filter(
      s => /*s.isMine &&*/ s.name.toLowerCase().includes(this.yourSchoolsSearch.toLowerCase())
    );
  }

  openCreateDialog() {
    const dialogRef = this.dialog.open(AddSchoolDialogComponent);
    dialogRef.afterClosed().subscribe(schoolName => {
      if (schoolName) {
        this.http.addSchool(schoolName).subscribe({
          next: (value) => {
            this.http.getSchools().subscribe((schools: SchoolDTO[]) => {
              this.schools = schools;
            });
          },
          error: (err) => {
            // Fehler ausgeben oder ignorieren
            console.log('Fehler beim Hinzufügen:', err.error);
            // Optional: Fehlermeldung im UI anzeigen
          }
        });
      }
    });
  }

  openSchool(school: SchoolDTO) {
    this.router.navigate(['/school', school.id]);
  }
}
