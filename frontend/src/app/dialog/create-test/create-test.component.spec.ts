import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { CreateTestComponent } from './create-test.component';
import { HttpService } from '../../service/http.service';
import { TestPrintService } from '../../service/test-print.service';

describe('CreateTestComponent', () => {
  let component: CreateTestComponent;
  let fixture: ComponentFixture<CreateTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CreateTestComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: { schoolId: 1 },
        },
        {
          provide: MatDialogRef,
          useValue: {
            close: jasmine.createSpy('close'),
            disableClose: false,
            backdropClick: () => of(),
            keydownEvents: () => of(),
          },
        },
        {
          provide: MatDialog,
          useValue: {
            open: jasmine.createSpy('open').and.returnValue({
              afterClosed: () => of(undefined),
            }),
          },
        },
        {
          provide: MatSnackBar,
          useValue: {
            open: jasmine.createSpy('open'),
          },
        },
        {
          provide: HttpService,
          useValue: {
            getCreateTest: () => of({}),
            getFullExamples: () => of([]),
            getExampleFolders: () => of([]),
            createTest: () => of({}),
            saveTest: () => of({}),
            getConstructionImageUrl: () => '',
            getConstructionSolutionImageUrl: () => '',
          },
        },
        {
          provide: TestPrintService,
          useValue: {
            printTest: jasmine.createSpy('printTest'),
            exportPdf: jasmine.createSpy('exportPdf').and.resolveTo(true),
            exportWord: jasmine.createSpy('exportWord').and.resolveTo(true),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
