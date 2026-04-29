import {User, UserDTO} from './User'
import {Focus} from './Example'

export interface School {
  id: string;
  name: string;
  logoUrl: string;
  admin: User;
  users: User[];
  focusList: Focus[];
  createdAt: string;
  updatedAt: string;
}

export interface SchoolDTO {
  id: string;
  name: string;
  logoUrl: string;
  admin: UserDTO;
  exampleCount: number;
  members: UserDTO[],
}
