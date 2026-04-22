import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { AuthGuard } from './guard/auth.guard';
import { adminGuard } from './guard/admin.guard';
import { HomeComponent } from './components/home/home.component';
import { SchoolComponent } from './components/school/school.component';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { ProfileComponent } from './components/profile/profile.component';
import { LegalPageComponent } from './components/legal-page/legal-page.component';
import { LandingPageComponent } from './components/landing-page/landing-page.component';
import { HelpComponent } from './components/help/help.component';
import { AdminComponent } from './components/admin/admin.component';

export const routes: Routes = [
  { path: '', component: LandingPageComponent },
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'collection/:id', component: SchoolComponent, canActivate: [AuthGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
  { path: 'login', component: LoginComponent },

  { path: 'admin', component: AdminComponent, canActivate: [AuthGuard, adminGuard] },

  {
    path: 'help',
    component: HelpComponent,
  },

  {
    path: 'privacy',
    component: LegalPageComponent,
    data: { pageKey: 'privacy' }
  },
  {
    path: 'terms',
    component: LegalPageComponent,
    data: { pageKey: 'terms' }
  },
  {
    path: 'legal',
    component: LegalPageComponent,
    data: { pageKey: 'legal' }
  },
  {
    path: 'cookies',
    component: LegalPageComponent,
    data: { pageKey: 'cookies' }
  },
  {
    path: 'support',
    component: LegalPageComponent,
    data: { pageKey: 'support' }
  },
  { path: '**', component: NotFoundComponent }
];
