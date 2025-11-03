import { Component } from '@angular/core';
import {Router, RouterLink, RouterLinkActive} from '@angular/router'
import {MatToolbar} from '@angular/material/toolbar'
import {MatAnchor} from '@angular/material/button'

@Component({
  selector: 'app-navigation',
  imports: [
    RouterLink,
    RouterLinkActive,
    MatToolbar,
    MatAnchor
  ],
  templateUrl: './navigation.component.html',
  standalone: true,
  styleUrl: './navigation.component.scss'
})
export class NavigationComponent {
  constructor(private router: Router) {}


  goToSchool() {
    const lastId = localStorage.getItem('lastViewedSchoolId') || 1;
    if (lastId) {
      this.router.navigate(['/school', lastId]);
    } else {
      this.router.navigate(['/school']);
    }
  }
}
