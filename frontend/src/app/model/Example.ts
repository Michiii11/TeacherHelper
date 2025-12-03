import {User} from './User'

export enum ExampleDifficulty {
  EASY, MEDIUM, HARD, VERY_HARD, EXPERT
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

export interface Example {
  id: number;
  admin: User;

  type: ExampleTypes;
  instruction: string;
  question: string;
  answers: string[];
  imageUrl: string;
  options: Option[];
  gapFillType: 'input' | 'select'
  gaps: Gap[]
  assigns: Assign[]
  assignRightItems: string[]
}

export interface CreateExampleDTO {
  authToken: string;
  schoolId: number;
  type: ExampleTypes;
  instruction: string;
  question: string;
  answers: string[];
  options: Option[];
  gapFillType: 'input' | 'select'
  gaps: Gap[]
  assigns: Assign[]
  assignRightItems: string[]
  image: string;
  answer: string;
  halfOpenCorrectAnswers: string[];
  gapFillCorrectAnswers: string[];
  solutionUrl: string;
  difficulty: ExampleDifficulty;
}

export interface Option {
  text: string;
  isCorrect: boolean;
}

export interface Gap{
  label: string;
  options: Option[]
}

export interface Assign{
  left: string;
  right: string;
}


export interface ExampleOverviewDTO{
  id: number;
  type: ExampleTypes;
  instruction: string;
  question: string;
  difficulty: ExampleDifficulty;
  adminUsername: string;
}
