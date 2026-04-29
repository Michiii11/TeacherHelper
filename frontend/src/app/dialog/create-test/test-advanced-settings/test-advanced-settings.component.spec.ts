import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestAdvancedSettingsComponent } from './test-advanced-settings.component';

describe('TestAdvancedSettingsComponent', () => {
  let component: TestAdvancedSettingsComponent;
  let fixture: ComponentFixture<TestAdvancedSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestAdvancedSettingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestAdvancedSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
