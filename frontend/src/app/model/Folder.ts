export interface FolderDTO {
  id: string;
  name: string;
  schoolId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFolderDTO {
  authToken: string;
  name: string;
  parentId: string | null;
}

export interface UpdateFolderDTO {
  authToken: string;
  name: string;
  parentId: string | null;
}
