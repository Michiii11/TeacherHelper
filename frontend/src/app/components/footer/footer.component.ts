import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { version } from '../../../environments/version';

type FooterLink = {
  label: string;
  route: string;
};

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  readonly brandName = 'TeacherHelper';
  readonly currentYear = new Date().getFullYear();
  readonly appVersion = version.appVersion;

  readonly links: FooterLink[] = [
    { label: 'Privacy', route: '/privacy' },
    { label: 'Terms', route: '/terms' },
    { label: 'Legal Notice', route: '/legal' },
    { label: 'Cookies', route: '/cookies' },
    { label: 'Support', route: '/support' }
  ];
}
