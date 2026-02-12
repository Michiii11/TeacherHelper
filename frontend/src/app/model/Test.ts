import {User} from './User'
import {Example} from './Example'
import {School} from './School'

export enum TestCreationStates {
  DRAFT = 'DRAFT', DONE = 'DONE', USED = 'USED'
}

export interface Test {
  id: number;
  admin: User;
  name: string;
  duration: number;
  state: TestCreationStates;
  exampleList: TestExample[];
  school: School;
}

export interface TestExample{
  id: number;
  example: Example;
  test: Test;
  points: number;
  title: string;
}

export interface TestExampleDTO{
  example: Example;
  points: number;
  title: string;
}

export interface TestOverviewDTO {
  id: number;
  name: string;
  amountOfQuestions: number;
  duration: number;
  state: TestCreationStates;
  adminUsername: string;
  adminId: number;
}

export interface CreateTestDTO {
  authToken: string;
  schoolId: number;
  name: string;
  note: string;
  exampleList: TestExampleDTO[];
  duration: number;
  state: TestCreationStates;
}
