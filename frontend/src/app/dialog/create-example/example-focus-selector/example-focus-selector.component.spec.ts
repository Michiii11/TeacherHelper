import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExampleFocusSelectorComponent } from './example-focus-selector.component';

describe('ExampleFocusSelectorComponent', () => {
  let component: ExampleFocusSelectorComponent;
  let fixture: ComponentFixture<ExampleFocusSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExampleFocusSelectorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExampleFocusSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
