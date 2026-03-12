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
  admin: UserDTO;
  exampleCount: number;
  members: UserDTO[]
}

export enum RequestType{
  JOIN = 'JOIN',
  INVITE = 'INVITE'
}

export interface JoinRequest{
  id: number;
  school: School;
  transmitter: User;
  recipient: User;
  message: string;
  accepted: boolean;
  done: boolean;
  type: RequestType;
}

export interface JoinRequestDTO{
  id: number;
  school: SchoolDTO;
  transmitter: UserDTO;
  recipient: UserDTO;
  message: string;
  accepted: boolean;
  done: boolean;
  type: RequestType;
}
