import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExamplePreviewComponent } from './example-preview.component';

describe('ExamplePreviewComponent', () => {
  let component: ExamplePreviewComponent;
  let fixture: ComponentFixture<ExamplePreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExamplePreviewComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ExamplePreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
