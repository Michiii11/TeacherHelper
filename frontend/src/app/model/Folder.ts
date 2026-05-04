import {Collection} from './Collection'

export interface Folder {
  id: string;
  name: string;
  collection: Collection;
  parent: Folder;
  createdAt: string;
  updatedAt: string;
}

export interface FolderDTO {
  id: string;
  name: string;
  collectionId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFolderDTO {
  name: string;
  parentId: string | null;
}
