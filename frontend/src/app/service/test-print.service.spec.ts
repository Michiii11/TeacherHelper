import { TestBed } from '@angular/core/testing';

import { TestPrintService } from './test-print.service';

describe('TestPrintService', () => {
  let service: TestPrintService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TestPrintService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
