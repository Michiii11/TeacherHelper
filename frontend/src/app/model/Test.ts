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
  example: Example;
  test: Test;
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
  exampleList: TestExample[];
  duration: number;
  state: TestCreationStates;
}
