import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestSelectedExamplesComponent } from './test-selected-examples.component';

describe('TestSelectedExamplesComponent', () => {
  let component: TestSelectedExamplesComponent;
  let fixture: ComponentFixture<TestSelectedExamplesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestSelectedExamplesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestSelectedExamplesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
