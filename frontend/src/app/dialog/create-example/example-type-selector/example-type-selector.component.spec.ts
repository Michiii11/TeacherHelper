import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExampleTypeSelectorComponent } from './example-type-selector.component';

describe('ExampleTypeSelectorComponent', () => {
  let component: ExampleTypeSelectorComponent;
  let fixture: ComponentFixture<ExampleTypeSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExampleTypeSelectorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExampleTypeSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
