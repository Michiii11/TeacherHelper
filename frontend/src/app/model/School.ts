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

export interface JoinRequest{
  id: number;
  school: School;
  user: User;
  message: string;
  accepted: boolean;
  done: boolean;
}

export interface JoinRequestDTO{
  school: SchoolDTO;
  user: UserDTO;
  message: string;
  accepted: boolean;
  done: boolean;
}
