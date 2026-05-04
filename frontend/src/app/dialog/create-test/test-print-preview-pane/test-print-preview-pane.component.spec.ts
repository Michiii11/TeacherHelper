import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestPrintPreviewPaneComponent } from './test-print-preview-pane.component';

describe('TestPrintPreviewPaneComponent', () => {
  let component: TestPrintPreviewPaneComponent;
  let fixture: ComponentFixture<TestPrintPreviewPaneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestPrintPreviewPaneComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestPrintPreviewPaneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
