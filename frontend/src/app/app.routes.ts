import {RouterModule, Routes} from '@angular/router';
import {LoginComponent} from './components/login/login.component'
import {AppComponent} from './app.component'
import {AuthGuard} from './guard/auth.guard'
import {HomeComponent} from './components/home/home.component'
import {SchoolComponent} from './components/school/school.component'
import {NotFoundComponent} from './components/not-found/not-found.component'
import {ProfileComponent} from './components/profile/profile.component'

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'school/:id', component: SchoolComponent, canActivate: [AuthGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
  { path: 'login', component: LoginComponent },
  { path: '**', component: NotFoundComponent }
];
