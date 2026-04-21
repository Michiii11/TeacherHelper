import {User, UserDTO} from './User'
import {SchoolDTO} from './School'

export enum ExampleTypes {
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
  CONSTRUCTION = 'CONSTRUCTION',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  GAP_FILL = 'GAP_FILL',
  ASSIGN = 'ASSIGN'
}

export const ExampleTypeLabels: Record<ExampleTypes, string> = {
  [ExampleTypes.OPEN]: 'exampleTypes.open',
  [ExampleTypes.HALF_OPEN]: 'exampleTypes.halfOpen',
  [ExampleTypes.CONSTRUCTION]: 'exampleTypes.construction',
  [ExampleTypes.MULTIPLE_CHOICE]: 'exampleTypes.multipleChoice',
  [ExampleTypes.GAP_FILL]: 'exampleTypes.gapFill',
  [ExampleTypes.ASSIGN]: 'exampleTypes.assign'
};

export interface Example {
  id: number;
  admin: User;
  adminUsername?: string;
  folderId?: string | null;
  focusList: Focus[];
  type: ExampleTypes;
  instruction: string;
  question: string;
  answers: string[][];
  imageUrl: string | null;
  solutionUrl: string | null;
  imageWidth: number | null;
  solutionImageWidth: number | null;
  options: Option[];
  gapFillType: 'INPUT' | 'SELECT';
  gaps: Gap[];
  assigns: Assign[];
  assignRightItems: string[];
  variables?: ExampleVariable[];
}

export interface ExampleDTO {
  id: number;
  admin: UserDTO;
  adminUsername?: string;
  folderId?: string | null;
  type: ExampleTypes;
  instruction: string;
  question: string;
  solution: string | null;
  solutionUrl: string | null;
  imageUrl: string | null;
  imageWidth: number | null;
  solutionImageWidth: number | null;
  focusList: Focus[];
  variables?: ExampleVariable[];
  school: SchoolDTO;
  answers: string[][];
  options: Option[];
  gapFillType: 'INPUT' | 'SELECT';
  gaps: Gap[];
  assigns: Assign[];
  assignRightItems: string[];
}

export interface ExampleVariable {
  id: string;
  key: string;
  defaultValue: string;
}

export interface CreateExampleDTO {
  authToken: string;
  schoolId: number;
  type: ExampleTypes;
  instruction: string;
  question: string;
  answers: string[][];
  options: Option[];
  gapFillType: 'INPUT' | 'SELECT';
  gaps: Gap[];
  assigns: Assign[];
  assignRightItems: string[];
  image: string;
  solution: string;
  solutionUrl: string;
  focusList: Focus[];
  variables?: ExampleVariable[];
  imageWidth: number | null;
  solutionImageWidth: number | null;
  folderId?: string | null;
  imageFile?: File;
  solutionFile?: File;
}

export interface Option {
  id: string;
  text: string;
  correct: boolean;
}

export interface Gap {
  id: string;
  label: string;
  solution: string;
  width?: number | null;
  options: Option[];
}

export interface Assign {
  left: string;
  right: string;
}

export interface Focus {
  id: number;
  label: string;
}

export interface ExampleOverviewDTO {
  id: number;
  type: ExampleTypes;
  instruction: string;
  question: string;
  adminUsername: string;
  adminId: number;
  focusList: Focus[];
  folderId: string | null;

  createdAt?: string;
  updatedAt?: string;
}


export interface MoveExampleToFolderDTO {
  folderId: string | null;
  authToken: string;
}
