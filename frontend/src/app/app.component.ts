import {Component, inject, OnInit} from '@angular/core';
import {ActivatedRoute, RouterOutlet} from '@angular/router'
import {NavigationComponent} from './components/navigation/navigation.component'
import {HttpService} from './service/http.service'
import {MatDialog} from '@angular/material/dialog'
import {interval, switchMap} from 'rxjs'
import {MatProgressSpinner} from '@angular/material/progress-spinner'
import {FooterComponent} from './components/footer/footer.component'
import {AuthService} from './service/auth.service'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [
    RouterOutlet,
    NavigationComponent,
    MatProgressSpinner,
    FooterComponent
  ],
  styleUrl: './app.component.scss'
})
export class AppComponent{
  service = inject(HttpService)
  authService = inject(AuthService)

  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);

  isLoggedIn = false;

  isLoading = false;

  ngOnInit() {
    this.authService.validateToken(localStorage.getItem('teacher_authToken') || '').subscribe({
      next: (isValid) => {
        this.isLoggedIn = isValid;
      }
    })

    /*this.service.getAllReservations().subscribe({
      next: () => {
        this.isLoading = false;
      }
    })

    if(this.isLoading){
      interval(2000).pipe(
        switchMap(() => this.service.getAllReservations())
      ).subscribe({
        next: () => {
          this.isLoading = false;
        }
      });
    }*/
  }
}
