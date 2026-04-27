import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NavbarAction, NavbarBreadcrumb } from './navbar-action.model';

@Injectable({
  providedIn: 'root'
})
export class NavbarActionsService {
  private readonly actionsSubject = new BehaviorSubject<NavbarAction[]>([]);
  readonly actions$ = this.actionsSubject.asObservable();

  private reloadSchools$ = new BehaviorSubject<void>(undefined);

  getReloadSchools() {
    return this.reloadSchools$.asObservable();
  }

  triggerReloadSchools() {
    this.reloadSchools$.next();
  }

  private readonly breadcrumbsSubject = new BehaviorSubject<NavbarBreadcrumb[]>([]);
  readonly breadcrumbs$ = this.breadcrumbsSubject.asObservable();

  setActions(actions: NavbarAction[]): void {
    queueMicrotask(() => {
      this.actionsSubject.next(actions ?? []);
    });
  }

  clearActions(): void {
    queueMicrotask(() => {
      this.actionsSubject.next([]);
    });
  }

  setBreadcrumbs(breadcrumbs: NavbarBreadcrumb[]): void {
    queueMicrotask(() => {
      this.breadcrumbsSubject.next(breadcrumbs ?? []);
    });
  }

  clearBreadcrumbs(): void {
    queueMicrotask(() => {
      this.breadcrumbsSubject.next([]);
    });
  }

  clearAll(): void {
    this.clearActions();
    this.clearBreadcrumbs();
  }
}
