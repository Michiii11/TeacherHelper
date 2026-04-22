import {User, UserDTO} from './User'

export interface School {
  id: string;
  name: string;
  admin: User;
  users: User[];
  logoUrl: string;
}

export interface SchoolDTO {
  id: string;
  name: string;
  admin: UserDTO;
  exampleCount: number;
  members: UserDTO[],
  logoUrl: string;
}

export interface SchoolInviteDTO {
  id: string;
  school: SchoolDTO;
  sender: UserDTO;
  recipient: UserDTO;
  type: SchoolInviteType;
  status: SchoolInviteStatus;
  message: string;
  createdAt: Date;
  decidedAt: Date;
}

export enum SchoolInviteType {
  JOIN_REQUEST = 'JOIN_REQUEST',
  TEACHER_INVITATION = 'TEACHER_INVITATION',
}

export enum SchoolInviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
}
