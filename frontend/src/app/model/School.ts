import {User, UserDTO} from './User'

export interface School {
  id: number;
  name: string;
  admin: User;
  users: User[];
}

export interface SchoolDTO {
  id: number;
  name: string;
  admin: User;
  exampleCount: number;
}
