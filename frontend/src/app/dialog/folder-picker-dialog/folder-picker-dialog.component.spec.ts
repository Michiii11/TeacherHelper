import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FolderPickerDialogComponent } from './folder-picker-dialog.component';

describe('FolderPickerDialogComponent', () => {
  let component: FolderPickerDialogComponent;
  let fixture: ComponentFixture<FolderPickerDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FolderPickerDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FolderPickerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
