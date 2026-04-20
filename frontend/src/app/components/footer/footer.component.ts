import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { version } from '../../../environments/version';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  version = version.appVersion;
}
