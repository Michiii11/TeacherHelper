export interface FolderDTO {
  id: string;
  name: string;
  schoolId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFolderDTO {
  name: string;
  parentId: string | null;
}
