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

  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);

  isLoggedIn = false;

  isLoading = false;

  constructor(private authService: AuthService) {
    console.log(this.isLoggedIn)
    this.authService.loggedIn$.subscribe(status => {
      console.log("init", status)
      this.isLoggedIn = status;
    });
  }


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
