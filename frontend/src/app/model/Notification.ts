import {UserDTO} from './User'
import {SchoolDTO} from './School'

export enum NotificationType {
  JOIN_REQUEST = 'JOIN_REQUEST',
  SCHOOL_INVITATION = 'SCHOOL_INVITATION',
  INVITATION_ACCEPTED = 'INVITATION_ACCEPTED',
  INVITATION_DECLINED = 'INVITATION_DECLINED',
  SCHOOL_NEWS = 'SCHOOL_NEWS',
  SYSTEM_INFO = 'SYSTEM_INFO'
}

export enum NotificationActionType {
  OPEN_LINK = 'OPEN_LINK',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
  DECLINE_INVITATION = 'DECLINE_INVITATION',
  MARK_AS_READ = 'MARK_AS_READ',
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
  relatedEntityId?: number;
  primaryAction?: NotificationActionType;
  secondaryAction?: NotificationActionType;
  createdAt: string;
}
