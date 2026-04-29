import {User} from './User'
import {Example} from './Example'
import {School} from './School'
import {Folder} from './Folder'

export type TestGradingMode = 'auto' | 'manual';

export interface GradingLevel {
  key: string;
  label: string;
  shortLabel: string;
  order: number;
  percentageFrom: number;
  minimumPoints: number;
}

export interface Test {
  id: string;
  admin: User;
  school: School;
  folder: Folder;
  name: string;
  note: string;
  duration: number;
  exampleList: TestExample[];
  defaultTaskSpacing: number;
  gradingMode: TestGradingMode;
  gradingSystemName: string;
  taskSpacingMap: Record<number, number>;
  gradingSchema: GradingLevel[];
  gradePercentages: Record<number, number>;
  manualGradeMinimums: Record<number, number>;
  createdAt: string;
  updatedAt: string;
}

export interface TestExampleVariableValues {
  [key: string]: string;
}

export interface TestExample{
  id: string;
  test: Test;
  example: Example;
  points: number;
  title: string;
  variableValues: TestExampleVariableValues;
}

export interface TestExampleDTO{
  example: Example;
  points: number;
  title: string;
  variableValues: TestExampleVariableValues;
}

export interface TestOverviewDTO {
  id: string;
  name: string;
  amountOfQuestions: number;
  duration: number;
  adminUsername: string;
  adminId: string;
  folderId: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface CreateTestDTO {
  schoolId: string;
  name: string;
  note: string;
  exampleList: TestExampleDTO[];
  duration: number;
  defaultTaskSpacing: number;
  taskSpacingMap: Record<string, number>;
  gradingMode: TestGradingMode;
  gradingSystemName: string;
  gradingSchema: GradingLevel[];
  gradePercentages: Record<number, number>;
  manualGradeMinimums: Record<number, number>;
  folderId: string | null;
}
