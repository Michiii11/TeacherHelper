import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolInvitationComponent } from './school-invitation.component';

describe('SchoolInvitationComponent', () => {
  let component: SchoolInvitationComponent;
  let fixture: ComponentFixture<SchoolInvitationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolInvitationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchoolInvitationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
