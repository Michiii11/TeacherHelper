import {Component, HostListener, inject} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms'
import {MatButton} from '@angular/material/button'
import {MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef} from '@angular/material/dialog'
import {Example} from '../../model/Example'
import {TestCreationStates} from '../../model/Test'
import {HttpService} from '../../service/http.service'
import {MatSnackBar} from '@angular/material/snack-bar'
import {ConfirmDialogComponent} from '../confirm-dialog/confirm-dialog.component'
import {CdkTextareaAutosize} from '@angular/cdk/text-field'
import {MatFormField, MatInput, MatLabel} from '@angular/material/input'

@Component({
  selector: 'app-create-test',
  imports: [
    FormsModule,
    MatButton,
    MatDialogActions,
    MatDialogContent,
    ReactiveFormsModule,
    CdkTextareaAutosize,
    MatFormField,
    MatInput,
    MatLabel
  ],
  templateUrl: './create-test.component.html',
  styleUrl: './create-test.component.scss'
})
export class CreateTestComponent {
  data = inject<{ schoolId: number; testId: number }>(MAT_DIALOG_DATA);

  test = {
    authToken: '',
    schoolId: this.data.schoolId,
    name: '',
    exampleList: [] as Example[],
    duration: 0,
    state: TestCreationStates.DRAFT
  }
  service = inject(HttpService)

  // common fields
  hasUnsavedChanges = false;
  isEditMode = false;

  constructor(
    private dialogRef: MatDialogRef<CreateTestComponent>,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    dialogRef.disableClose = true;
    dialogRef.backdropClick().subscribe(() => {
      this.closeDialog();
    });
    dialogRef.keydownEvents().subscribe(event => {
      if (event.key === 'Escape') {
        this.closeDialog();
      }
    });
  }

  ngOnInit(){
    if(this.data.testId){
      console.log(this.data.testId)
      this.service.getCreateTest(this.data.testId).subscribe({
        next: (response) => {
          this.test = response;
          this.isEditMode = true;
          console.log('[CreateExample] loaded example:', response);
        }
      })
    }
  }

  protected saveExample() {

  }

  protected saveTest() {

  }

  async closeDialog() {
    if (this.hasUnsavedChanges) {
      const confirmRef = this.dialog.open(ConfirmDialogComponent, {
        data: { title: 'Warnung', message: 'Möchten Sie wirklich schließen? Nicht gespeicherte Änderungen gehen verloren.', cancelText: 'Abbrechen', confirmText: 'Schließen' }
      });
      const confirmed = await confirmRef.afterClosed().toPromise();
      if (!confirmed) return;
    }
    this.dialogRef.close();
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: BeforeUnloadEvent) {
    if (this.hasUnsavedChanges) {
      event.preventDefault();
      // Chrome requires returnValue set
      event.returnValue = '';
    }
  }

  /* ----------------------
     General helpers
  ---------------------- */
  markDirty() {
    this.hasUnsavedChanges = true;
  }
}
