import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConstructionImageCardComponent } from './construction-image-card.component';

describe('ConstructionImageCardComponent', () => {
  let component: ConstructionImageCardComponent;
  let fixture: ComponentFixture<ConstructionImageCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConstructionImageCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConstructionImageCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
