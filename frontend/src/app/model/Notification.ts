import {UserDTO} from './User'
import {SchoolDTO} from './School'

export enum NotificationType {
  JOIN_REQUEST = 'JOIN_REQUEST',
  SCHOOL_INVITATION = 'SCHOOL_INVITATION',
  JOIN_REQUEST_ACCEPTED = 'JOIN_REQUEST_ACCEPTED',
  JOIN_REQUEST_DECLINED = 'JOIN_REQUEST_DECLINED',
  INVITATION_ACCEPTED = 'INVITATION_ACCEPTED',
  INVITATION_DECLINED = 'INVITATION_DECLINED',
  SCHOOL_NEWS = 'SCHOOL_NEWS',
  SYSTEM_INFO = 'SYSTEM_INFO'
}

export enum NotificationActionType {
  OPEN_LINK = 'OPEN_LINK',
  ACCEPT_JOIN_REQUEST = 'ACCEPT_JOIN_REQUEST',
  DECLINE_JOIN_REQUEST = 'DECLINE_JOIN_REQUEST',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
  DECLINE_INVITATION = 'DECLINE_INVITATION',
  MARK_AS_READ = 'MARK_AS_READ',
  ARCHIVE = 'ARCHIVE',
  DELETE = 'DELETE'
}

export interface NotificationDTO {
  id: number;
  actor?: UserDTO;
  school?: SchoolDTO;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  archived: boolean;
  relatedEntityId?: number;
  primaryAction?: NotificationActionType;
  secondaryAction?: NotificationActionType;
  createdAt: string;
}
