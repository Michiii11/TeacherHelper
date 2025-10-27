import { Component } from '@angular/core';
import {MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {MatFormField, MatInput, MatLabel} from '@angular/material/input'
import {FormsModule} from '@angular/forms'
import {MatButton} from '@angular/material/button'

@Component({
  selector: 'app-add-school-dialog',
  standalone: true,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatFormField,
    MatInput,
    FormsModule,
    MatDialogActions,
    MatButton,
    MatLabel
  ],
  template: `
    <h1 mat-dialog-title>Neue Schule anlegen</h1>
    <form (ngSubmit)="onCreate()">
      <div mat-dialog-content>
        <mat-form-field appearance="fill" style="width:100%">
          <mat-label>Schulname</mat-label>
          <input matInput [(ngModel)]="schoolName" name="schoolName" required />
        </mat-form-field>
      </div>
      <div mat-dialog-actions align="end">
        <button mat-button type="button" (click)="onCancel()">Abbrechen</button>
        <button mat-raised-button color="primary" type="submit" [disabled]="!schoolName">Erstellen</button>
      </div>
    </form>
  `
})
export class AddSchoolDialogComponent {
  schoolName = '';
  constructor(private dialogRef: MatDialogRef<AddSchoolDialogComponent>) {}
  onCancel() { this.dialogRef.close(); }
  onCreate() { if (this.schoolName) this.dialogRef.close(this.schoolName); }
}
