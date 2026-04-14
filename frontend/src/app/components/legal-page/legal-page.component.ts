import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

type LegalPageKey = 'privacy' | 'terms' | 'legal' | 'cookies' | 'support';

type LegalPageContent = {
  title: string;
  subtitle: string;
  sections: Array<{
    heading: string;
    paragraphs?: string[];
    bullets?: string[];
  }>;
  primaryActionLabel?: string;
  primaryActionHref?: string;
};

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './legal-page.component.html',
  styleUrl: './legal-page.component.scss'
})
export class LegalPageComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly pageKey = toSignal(
    this.route.data.pipe(map(data => (data['pageKey'] as LegalPageKey) ?? 'privacy')),
    { initialValue: 'privacy' as LegalPageKey }
  );

  readonly currentYear = new Date().getFullYear();

  readonly content = computed<LegalPageContent>(() => {
    const key = this.pageKey();

    const pages: Record<LegalPageKey, LegalPageContent> = {
      privacy: {
        title: 'Privacy Policy',
        subtitle: 'How TeacherHelper collects, uses, and stores data.',
        sections: [
          {
            heading: 'Overview',
            paragraphs: [
              'TeacherHelper processes personal and usage-related data only to provide the platform and its core features.',
              'We aim to collect as little data as possible and do not sell personal data.'
            ]
          },
          {
            heading: 'What data may be collected',
            bullets: [
              'Account data such as username and email address',
              'School, test, and example content created inside the app',
              'Authentication-related technical data such as login or session information',
              'Uploaded images or other files you explicitly provide'
            ]
          },
          {
            heading: 'Why data is used',
            bullets: [
              'To provide login and account management',
              'To save and display school, test, and example data',
              'To keep the application secure and stable',
              'To process support or deletion requests'
            ]
          },
          {
            heading: 'Storage and third-party services',
            paragraphs: [
              'Data may be stored in databases, hosting systems, and cloud storage used to operate the application.',
              'Third-party infrastructure providers are only used to run the service and not for advertising purposes.'
            ]
          },
          {
            heading: 'Your rights',
            bullets: [
              'Access to your stored data',
              'Correction of incorrect data',
              'Deletion of your account or stored content where applicable',
              'Questions about how your data is processed'
            ]
          }
        ]
      },

      terms: {
        title: 'Terms of Use',
        subtitle: 'Rules and conditions for using TeacherHelper.',
        sections: [
          {
            heading: 'Use of the platform',
            paragraphs: [
              'TeacherHelper is provided to help organize educational content such as examples and tests.',
              'By using the platform, you agree to use it lawfully and responsibly.'
            ]
          },
          {
            heading: 'Allowed use',
            bullets: [
              'Use the application only for legitimate educational or organizational purposes',
              'Keep your account credentials secure',
              'Respect the rights and privacy of other users'
            ]
          },
          {
            heading: 'Not allowed',
            bullets: [
              'Uploading unlawful, harmful, or abusive content',
              'Attempting to disrupt, reverse engineer, or misuse the service',
              'Using the platform in a way that could damage data integrity or availability'
            ]
          },
          {
            heading: 'Availability and warranty',
            paragraphs: [
              'The application is provided on an “as is” basis without any guarantee of uninterrupted availability.',
              'Features may change, be improved, or be removed at any time.'
            ]
          },
          {
            heading: 'Limitation of liability',
            paragraphs: [
              'The operator is not liable for indirect damages, data loss, or interruptions unless required by applicable law.'
            ]
          }
        ]
      },

      legal: {
        title: 'Legal Notice',
        subtitle: 'Operator and contact information.',
        sections: [
          {
            heading: 'Project',
            paragraphs: [
              'TeacherHelper'
            ]
          },
          {
            heading: 'Operator',
            paragraphs: [
              'Michael Leisch'
            ]
          },
          {
            heading: 'Contact',
            paragraphs: [
              'michael.leisch@gmx.at'
            ]
          },
          {
            heading: 'Responsibility for content',
            paragraphs: [
              'The operator is responsible for the content of this application in accordance with applicable law.'
            ]
          }
        ]
      },

      cookies: {
        title: 'Cookie Policy',
        subtitle: 'Information about cookies and similar technologies.',
        sections: [
          {
            heading: 'Essential cookies',
            paragraphs: [
              'TeacherHelper may use essential cookies or similar local storage mechanisms required for login, authentication, security, and user preferences.'
            ]
          },
          {
            heading: 'No marketing cookies',
            paragraphs: [
              'TeacherHelper does not intentionally use advertising or marketing cookies.'
            ]
          },
          {
            heading: 'Managing cookies',
            paragraphs: [
              'You can usually remove cookies or local storage entries through your browser settings. Note that doing so may log you out or reset saved preferences.'
            ]
          }
        ]
      },

      support: {
        title: 'Support',
        subtitle: 'Need help, found a bug, or want to suggest a feature?',
        primaryActionLabel: 'Open GitHub Issue',
        primaryActionHref: 'https://github.com/Michiii11/TeacherHelper/issues/new',
        sections: [
          {
            heading: 'GitHub Issues',
            paragraphs: [
              'The preferred support channel for this project is GitHub Issues.',
              'Please use it for bug reports, feature requests, or reproducible technical problems.'
            ]
          },
          {
            heading: 'Before creating an issue',
            bullets: [
              'Check whether the problem already exists',
              'Describe what happened and what you expected',
              'Add screenshots if useful',
              'Include steps to reproduce the issue'
            ]
          },
          {
            heading: 'When not to use GitHub Issues',
            paragraphs: [
              'If you later add private or account-specific support, you may want to provide a separate email address for personal requests.'
            ]
          }
        ]
      }
    };

    return pages[key];
  });
}
