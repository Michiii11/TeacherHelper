import {User} from './User'
import {Example} from './Example'
import {School} from './School'

export type TestGradingMode = 'auto' | 'manual';

export interface GradingLevel {
  key: string;
  label: string;
  shortLabel: string;
  order: number;
  percentageFrom?: number;
  minimumPoints?: number;
}

export interface Test {
  id: number;
  admin: User;
  name: string;
  note: string;
  duration: number;
  exampleList: TestExample[];
  school: School;
  defaultTaskSpacing?: number;
  taskSpacingMap?: Record<number, number>;
  gradingMode?: TestGradingMode;
  gradingSystemName?: string;
  gradingSchema?: GradingLevel[];
  gradePercentages?: Record<number, number>;
  manualGradeMinimums?: Record<number, number>;
  folderId?: string | null;
}

export interface TestExampleVariableValues {
  [key: string]: string;
}

export interface TestExample{
  id: number;
  example: Example;
  test: Test;
  points: number;
  title: string;
  variableValues?: TestExampleVariableValues;
}

export interface TestExampleDTO{
  example: Example;
  points: number;
  title: string;
  variableValues?: TestExampleVariableValues;
}

export interface TestOverviewDTO {
  id: number;
  name: string;
  amountOfQuestions: number;
  duration: number;
  adminUsername: string;
  adminId: number;
  folderId: string | null;

  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTestDTO {
  authToken: string;
  schoolId: number;
  name: string;
  note: string;
  exampleList: TestExampleDTO[];
  duration: number;
  defaultTaskSpacing?: number;
  taskSpacingMap?: Record<number, number>;
  gradingMode?: TestGradingMode;
  gradingSystemName?: string;
  gradingSchema?: GradingLevel[];
  gradePercentages?: Record<number, number>;
  manualGradeMinimums?: Record<number, number>;
  folderId?: string | null;
}


export interface MoveTestToFolderDTO {
  folderId: string | null;
  authToken: string;
}
