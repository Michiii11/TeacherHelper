import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../service/auth.service';

@Component({
  selector: 'app-blocked',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    TranslatePipe,
  ],
  templateUrl: './blocked.component.html',
  styleUrl: './blocked.component.scss',
})
export class BlockedComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  retry(): void {
    void this.router.navigateByUrl('/home');
  }

  logout(): void {
    this.authService.logout();
  }
}
