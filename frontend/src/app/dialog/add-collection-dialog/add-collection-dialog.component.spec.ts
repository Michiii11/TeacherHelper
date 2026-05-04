import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddCollectionDialogComponent } from './add-collection-dialog.component';

describe('AddCollectionDialogComponent', () => {
  let component: AddCollectionDialogComponent;
  let fixture: ComponentFixture<AddCollectionDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddCollectionDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddCollectionDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
