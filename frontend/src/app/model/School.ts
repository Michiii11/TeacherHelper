import {User, UserDTO} from './User'

export interface School {
  id: number;
  name: string;
  admin: User;
  users: User[];
  logoUrl: string;
}

export interface SchoolDTO {
  id: number;
  name: string;
  admin: UserDTO;
  exampleCount: number;
  members: UserDTO[],
  logoUrl: string;
}

export interface SchoolInviteDTO {
  id: number;
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

export interface CreateSchoolInviteDTO {
  authToken: string;
  teacherId: number;
  message: string;
}

export interface RespondSchoolInviteDTO {
  authToken: string;
  accept: boolean;
}

export interface ChangeLog {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  user: User;
  school: School;
  createdAt: Date;
}

export interface LastActivityDTO {
  username: string;
  createdAt: Date;
}
