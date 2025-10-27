import {RouterModule, Routes} from '@angular/router';
import {LoginComponent} from './components/login/login.component'
import {AppComponent} from './app.component'
import {AuthGuard} from './guard/auth.guard'
import {HomeComponent} from './components/home/home.component'

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'login', component: LoginComponent }
];
