import { Component } from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router'
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

}
