export enum ExampleDifficulty {
  LEICHT, MITTEL, SCHWER
}

export enum ExampleTypes {
  OPEN, HALF_OPEN, CONSTRUCTION, MULTIPLE_CHOICE, GAP_FILL, ASSIGN
}

export const ExampleTypeLabels: Record<ExampleTypes, string> = {
  [ExampleTypes.OPEN]: 'Offenes Antwortformat',
  [ExampleTypes.HALF_OPEN]: 'Halboffenes Antwortformat',
  [ExampleTypes.CONSTRUCTION]: 'Konstruktionsformat',
  [ExampleTypes.MULTIPLE_CHOICE]: 'Multiple-Choice-Antwortformat  ',
  [ExampleTypes.GAP_FILL]: 'Lückentext',
  [ExampleTypes.ASSIGN]: 'Zuordnungsformat'
};
