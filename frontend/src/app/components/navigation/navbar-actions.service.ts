import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NavbarAction } from './navbar-action.model';

@Injectable({
  providedIn: 'root'
})
export class NavbarActionsService {
  private readonly actionsSubject = new BehaviorSubject<NavbarAction[]>([]);
  readonly actions$ = this.actionsSubject.asObservable();

  setActions(actions: NavbarAction[]): void {
    this.actionsSubject.next(actions);
  }

  clearActions(): void {
    this.actionsSubject.next([]);
  }
}
