export type ChangelogEntry = {
  version: string;
  isLatest: boolean;
  changes: string[];
};

export const APP_CHANGELOG: ChangelogEntry[] = [
  {
    version: 'v1.1.0',
    isLatest: true,
    changes: [
      'help.changelog.v110.c1',
      'help.changelog.v110.c2',
      'help.changelog.v110.c3'
    ]
  },
  {
    version: 'v1.0.0',
    isLatest: false,
    changes: [
      'help.changelog.v100.c1',
      'help.changelog.v100.c2',
      'help.changelog.v100.c3'
    ]
  }
];
