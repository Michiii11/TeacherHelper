import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolInvitationDialogComponent } from './school-invitation-dialog.component';

describe('SchoolInvitationDialogComponent', () => {
  let component: SchoolInvitationDialogComponent;
  let fixture: ComponentFixture<SchoolInvitationDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolInvitationDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolInvitationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
