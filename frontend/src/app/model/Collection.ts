import {User, UserDTO} from './User'
import {Focus} from './Example'

export interface Collection {
  id: string;
  name: string;
  logoUrl: string | null;
  admin: User;
  users: User[];
  focusList: Focus[];
  createdAt: string;
  updatedAt: string;
}

export interface CollectionDTO {
  id: string;
  name: string;
  logoUrl: string | null;
  admin: UserDTO;
  exampleCount: number;
  testCount: number;
  members: UserDTO[],
}
