import { CommonModule } from '@angular/common';
import { Component, Inject, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { finalize } from 'rxjs/operators';
import { HttpService } from '../../service/http.service';
import { SchoolDTO } from '../../model/School';

export interface SchoolSettingsDialogData {
  schoolId: string;
  school: SchoolDTO;
  currentUserId: number;
}

@Component({
  selector: 'app-school-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatCardModule
  ],
  templateUrl: './school-settings.component.html',
  styleUrl: './school-settings.component.scss'
})
export class SchoolSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(HttpService);

  savingGeneral = false;
  uploadingLogo = false;

  selectedLogoFile: File | null = null;
  logoPreviewUrl: string | null = null;

  generalForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]]
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: SchoolSettingsDialogData,
    private dialogRef: MatDialogRef<SchoolSettingsComponent>
  ) {}

  ngOnInit(): void {
    this.generalForm.patchValue({
      name: this.data.school?.name ?? ''
    });

    this.logoPreviewUrl = this.getSchoolLogoUrl();
  }

  get isAdmin(): boolean {
    return this.data.currentUserId === this.data.school?.admin?.id;
  }

  getSchoolLogoUrl() {
    return this.service.getSchoolLogo(this.data.school, this.data.schoolId);
  }


  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    this.selectedLogoFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.logoPreviewUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeSelectedLogo(): void {
    this.selectedLogoFile = null;
    this.logoPreviewUrl = this.getSchoolLogoUrl();
  }

  saveGeneral(): void {
    if (!this.isAdmin || this.generalForm.invalid) {
      this.generalForm.markAllAsTouched();
      return;
    }

    this.savingGeneral = true;

    const payload = {
      name: this.generalForm.value.name?.trim(),
      authToken: localStorage.getItem('teacher_authToken') || '',
    };

    this.service.updateSchool(this.data.schoolId, payload)
      .pipe(finalize(() => (this.savingGeneral = false)))
      .subscribe(updatedSchool => {
        this.dialogRef.close({
          updated: true,
          school: updatedSchool
        });
      });
  }

  uploadLogo(): void {
    if (!this.isAdmin || !this.selectedLogoFile) {
      return;
    }

    this.uploadingLogo = true;

    const formData = new FormData();
    formData.append('file', this.selectedLogoFile);
    formData.append('authToken', localStorage.getItem('teacher_authToken') ?? '');

    this.service.uploadSchoolLogo(this.data.schoolId, formData)
      .pipe(finalize(() => (this.uploadingLogo = false)))
      .subscribe(updatedSchool => {
        this.dialogRef.close({
          updated: true,
          school: updatedSchool
        });
      });
  }

  close(): void {
    this.dialogRef.close();
  }
}
