import { Component } from '@angular/core';
import {MatButton} from '@angular/material/button'
import {MatDialog} from '@angular/material/dialog'
import {HttpClient} from '@angular/common/http'
import {AddSchoolDialogComponent} from '../../dialog/add-school-dialog/add-school-dialog.component'
import {Config} from '../../config'
import {School, SchoolDTO} from '../../model/School'
import {HttpService} from '../../service/http.service'

@Component({
  selector: 'app-home',
  imports: [
    MatButton
  ],
  templateUrl: './home.component.html',
  standalone: true,
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  schools : SchoolDTO[] = [];

  constructor(private dialog: MatDialog, private http: HttpService) {}

  ngOnInit() {
    this.http.getSchools().subscribe((schools: SchoolDTO[]) => {
      this.schools = schools;
    })
  }

  openCreateDialog() {
    const dialogRef = this.dialog.open(AddSchoolDialogComponent);
    dialogRef.afterClosed().subscribe(schoolName => {
      if (schoolName) {
        this.http.addSchool(schoolName).subscribe((value) => {
          console.log(value)
          // Optional: Erfolgsmeldung oder Refresh
        });
      }
    });
  }
}
