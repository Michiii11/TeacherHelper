import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { adminGuard } from './admin.guard';
import { AuthService } from '../service/auth.service';

class RouterMock {
  navigate = jasmine.createSpy('navigate');
}

describe('adminGuard', () => {
  const executeGuard = () => TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any));

  beforeEach(() => {
    localStorage.clear();
  });

  it('should allow admins', (done) => {
    localStorage.setItem('teacher_authToken', 'token');

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useClass: RouterMock },
        { provide: AuthService, useValue: { isAdmin: () => of(true) } }
      ]
    });

    (executeGuard() as any).subscribe((allowed: boolean) => {
      expect(allowed).toBeTrue();
      done();
    });
  });

  it('should block non-admins', (done) => {
    localStorage.setItem('teacher_authToken', 'token');
    const router = new RouterMock();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: { isAdmin: () => of(false) } }
      ]
    });

    (executeGuard() as any).subscribe((allowed: boolean) => {
      expect(allowed).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
      done();
    });
  });
});
