import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

type InvitationDialogData = {
  schoolId: number;
  schoolName: string;
};

@Component({
  selector: 'app-school-invitation',
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  template: `
    <h2 mat-dialog-title>Anfrage senden</h2>

    <div mat-dialog-content>
      <p>Du möchtest der Schule <strong>{{ data.schoolName }}</strong> beitreten.</p>

      <mat-form-field appearance="outline" class="w-100">
        <mat-label>Nachricht (optional)</mat-label>
        <textarea
          matInput
          rows="4"
          [formControl]="message"
          placeholder="z.B. Hallo, ich bin Lehrling bei ... und würde gerne beitreten."
        ></textarea>
        <mat-hint align="end">{{ message.value.length }}/500</mat-hint>
      </mat-form-field>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button (click)="close()">Abbrechen</button>
      <button mat-flat-button color="primary" (click)="submit()" [disabled]="message.invalid">
        Anfrage senden
      </button>
    </div>
  `,
  styles: [`
    .w-100 { width: 100%; }
    p { margin: 0 0 12px; }
  `]
})
export class SchoolInvitationComponent {
  readonly data = inject<InvitationDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<SchoolInvitationComponent>);

  message = new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] });

  close() {
    this.dialogRef.close();
  }

  submit() {
    this.dialogRef.close({
      schoolId: this.data.schoolId,
      message: this.message.value.trim()
    });
  }
}
