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
  exampleList: Example[];
  school: School;
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
  exampleList: Example[];
  duration: number;
  state: TestCreationStates;
}
