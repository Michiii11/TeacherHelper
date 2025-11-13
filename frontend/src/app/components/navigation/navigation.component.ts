import { Component } from '@angular/core';
import {Router, RouterLink, RouterLinkActive} from '@angular/router'
import {MatToolbar} from '@angular/material/toolbar'
import {MatAnchor, MatIconButton} from '@angular/material/button'
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu'
import {MatIcon} from '@angular/material/icon'

@Component({
  selector: 'app-navigation',
  imports: [
    RouterLink,
    RouterLinkActive,
    MatToolbar,
    MatAnchor,
    MatIcon,
    MatIconButton,
    MatMenuItem,
    MatMenu,
    MatMenuTrigger,
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

  toggleMenu() {

  }
}
