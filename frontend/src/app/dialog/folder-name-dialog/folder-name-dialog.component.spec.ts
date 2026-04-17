import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FolderNameDialogComponent } from './folder-name-dialog.component';

describe('FolderNameDialogComponent', () => {
  let component: FolderNameDialogComponent;
  let fixture: ComponentFixture<FolderNameDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FolderNameDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FolderNameDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
