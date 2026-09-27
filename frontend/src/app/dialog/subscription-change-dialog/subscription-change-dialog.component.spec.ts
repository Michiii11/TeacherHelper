import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';

import { SubscriptionChangeDialogComponent } from './subscription-change-dialog.component';

describe('SubscriptionChangeDialogComponent', () => {
  let component: SubscriptionChangeDialogComponent;
  let fixture: ComponentFixture<SubscriptionChangeDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SubscriptionChangeDialogComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            currentPlan: 'PRO',
            targetPlan: 'SCHOOL',
            targetSeats: 20,
            currentMonthlyAmountCents: 500,
            newMonthlyAmountCents: 2000,
            monthlyDifferenceCents: 1500,
            currentPeriodAdjustmentCents: 1310,
            nextInvoiceAmountCents: 3310,
            nextBillingAt: 1792368000,
            prorationDate: 1790180000,
            currency: 'eur',
            cancelAtPeriodEnd: false,
          },
        },
        {
          provide: MatDialogRef,
          useValue: { close: jasmine.createSpy('close') },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionChangeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
