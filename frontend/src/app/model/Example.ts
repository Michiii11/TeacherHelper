import {User} from './User'

export enum ExampleDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  VERY_HARD = 'VERY_HARD',
  EXPERT = 'EXPERT'
}


export enum ExampleTypes {
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
  CONSTRUCTION = 'CONSTRUCTION',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  GAP_FILL = 'GAP_FILL',
  ASSIGN = 'ASSIGN'
}


export const ExampleTypeLabels: Record<ExampleTypes, string> = {
  [ExampleTypes.OPEN]: 'Offenes Antwortformat',
  [ExampleTypes.HALF_OPEN]: 'Halboffenes Antwortformat',
  [ExampleTypes.CONSTRUCTION]: 'Konstruktionsformat',
  [ExampleTypes.MULTIPLE_CHOICE]: 'Multiple-Choice-Antwortformat',
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
  gapFillType: 'INPUT' | 'SELECT'
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
  answers: string[][];
  options: Option[];
  gapFillType: 'INPUT' | 'SELECT'
  gaps: Gap[]
  assigns: Assign[]
  assignRightItems: string[]
  image: string;
  solution: string;
  solutionUrl: string;
  difficulty: ExampleDifficulty;

  imageFile?: File;
  solutionFile?: File;
}

export interface Option {
  id: string;
  text: string;
  correct: boolean;
}

export interface Gap{
  id: string;
  label: string;
  solution: string;
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
