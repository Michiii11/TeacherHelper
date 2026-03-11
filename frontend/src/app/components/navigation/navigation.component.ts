import {Component, HostListener, inject} from '@angular/core';
import {Router, RouterLink, RouterLinkActive} from '@angular/router'
import {MatToolbar} from '@angular/material/toolbar'
import {MatAnchor, MatButton, MatIconButton} from '@angular/material/button'
import {MatMenu, MatMenuItem, MatMenuTrigger} from '@angular/material/menu'
import {MatIcon} from '@angular/material/icon'
import {MatDivider} from '@angular/material/list'
import {HttpService} from '../../service/http.service'
import {User} from '../../model/User'
import {JoinRequest, JoinRequestDTO, RequestType} from '../../model/School'

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
  service = inject(HttpService)

  user = {} as User

  constructor(private router: Router) {}

  requests: JoinRequestDTO[] = []

  ngOnInit() {
    this.service.getUser().subscribe(user => {
      this.user = user;
    })

    this.service.getJoinRequests(0).subscribe(requests => {
        if(requests.length > 0) {
          console.log("Received join requests: ", requests);
          this.requests = requests;
        }
    })
  }

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

  protected getInitials() {
    if(!this.user) return
    if(!this.user.username) return

    let split = this.user.username.split(' ');

    let initials = ""
    split.map(item => {
      initials += item.charAt(0).toUpperCase();
    })

    return initials;
  }

  acceptRequest(request: JoinRequestDTO) {
    console.log("Accepted", request);
  }

  declineRequest(request: JoinRequestDTO) {
    console.log("Declined", request);
  }

  protected readonly RequestType = RequestType
}
