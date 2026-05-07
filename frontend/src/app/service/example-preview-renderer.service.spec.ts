import { TestBed } from '@angular/core/testing';

import { ExamplePreviewRendererService } from './example-preview-renderer.service';

describe('ExamplePreviewRendererService', () => {
  let service: ExamplePreviewRendererService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExamplePreviewRendererService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
