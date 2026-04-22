import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NavigationComponent } from './navigation.component';
import { HttpService } from '../../service/http.service';
import { AuthService } from '../../service/auth.service';

class HttpServiceMock {
  getUser() {
    return of({ username: 'admin' });
  }

  getMyNotifications() {
    return of([]);
  }

  markAsRead() {
    return of({});
  }

  deleteNotification() {
    return of({});
  }

  executeAction() {
    return of({});
  }

  respondToInvite() {
    return of({});
  }

  respondToJoinRequest() {
    return of({});
  }

  sendSystemInfoToSchool() {
    return of('ok');
  }

  sendSystemInfoToAll() {
    return of('ok');
  }

  getNotificationSocketUrl() {
    return '';
  }
}

class AuthServiceMock {
  isAdmin() {
    return of(true);
  }
}

describe('NavigationComponent', () => {
  let component: NavigationComponent;
  let fixture: ComponentFixture<NavigationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavigationComponent],
      providers: [
        provideRouter([]),
        { provide: HttpService, useClass: HttpServiceMock },
        { provide: AuthService, useClass: AuthServiceMock },
        { provide: MatSnackBar, useValue: { open: () => undefined } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NavigationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
