import { User, UserDTO } from './User';
import { ExampleOverviewDTO, Focus } from './Example';
import { TestOverviewDTO } from './Test';
import {FolderDTO} from './Folder'

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
  admin: UserDTO | null;
  examples: ExampleOverviewDTO[];
  tests: TestOverviewDTO[];
  folders: FolderDTO[];
  focusList: Focus[];
  members: UserDTO[];
}
