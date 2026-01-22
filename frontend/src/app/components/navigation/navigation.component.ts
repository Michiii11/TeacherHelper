import {Component, HostListener} from '@angular/core';
import {Router, RouterLink, RouterLinkActive} from '@angular/router'
import {MatToolbar} from '@angular/material/toolbar'
import {MatAnchor, MatButton, MatIconButton} from '@angular/material/button'
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu'
import {MatIcon} from '@angular/material/icon'
import {MatDivider} from '@angular/material/list'

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
    MatDivider,
    MatButton,
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

  @HostListener('window:scroll')
  onScroll() {
    const nav = document.querySelector('.navbar');
    window.scrollY > 10
      ? nav?.classList.add('scrolled')
      : nav?.classList.remove('scrolled');
  }


  toggleMenu() {

  }
}
