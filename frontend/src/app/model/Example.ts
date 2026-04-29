import {User, UserDTO} from './User'
import {SchoolDTO} from './School'
import {Folder, FolderDTO} from './Folder'

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
  id: string;
  admin: User;
  folder: Folder;
  type: ExampleTypes;
  instruction: string;
  question: string;
  solution: string;
  imageUrl: string;
  solutionUrl: string;
  imageWidth: number;
  solutionImageWidth: number;
  focusList: Focus[];
  variables?: ExampleVariable[];
  answers: string[][];
  options: Option[];
  gapFillType: 'INPUT' | 'SELECT';
  gaps: Gap[];
  assigns: Assign[];
  assignRightItems: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExampleDTO {
  id: string;
  admin: UserDTO;
  folder: FolderDTO;
  type: ExampleTypes;
  instruction: string;
  question: string;
  solution: string;
  solutionUrl: string;
  imageUrl: string;
  imageWidth: number;
  solutionImageWidth: number;
  focusList: Focus[];
  variables: ExampleVariable[];
  school: SchoolDTO;
  answers: string[][];
  options: Option[];
  gapFillType: 'INPUT' | 'SELECT';
  gaps: Gap[];
  assigns: Assign[];
  assignRightItems: string[];
}

export interface CreateExampleDTO {
  schoolId: string;
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
  variables: ExampleVariable[];
  imageWidth: number;
  solutionImageWidth: number;
  folderId: string;

  imageFile?: File;
  solutionFile?: File;
}

export interface ExampleOverviewDTO {
  id: string;
  type: ExampleTypes;
  instruction: string;
  question: string;
  adminUsername: string;
  adminId: string;
  focusList: Focus[];
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}


export interface ExampleVariable {
  id: string;
  key: string;
  defaultValue: string;
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
  width: number;
  options: Option[];
  example: Example;
}

export interface Assign {
  left: string;
  right: string;
}

export interface Focus {
  id: string;
  label: string;
}
