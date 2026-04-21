export interface AdminDashboardDto {
  users: {
    totalUsers: number;
    activeUsers: number;
    disabledUsers: number;
  };
  totals: {
    collections: number;
    examples: number;
    tests: number;
  };
  creations: {
    collections: AdminTimeBucketDto;
    examples: AdminTimeBucketDto;
    tests: AdminTimeBucketDto;
  };
  recentUsers: AdminRecentUserDto[];
}

export interface AdminTimeBucketDto {
  hour: number;
  day: number;
  week: number;
  month: number;
  year: number;
}

export interface AdminRecentUserDto {
  id: number;
  email: string;
  name: string;
  active: boolean;
  tier: string | null;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface AdminUserListItemDto {
  id: number;
  email: string;
  name: string;
  active: boolean;
  tier: string | null;
  tierExpiresAt: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  collectionsCount: number;
  examplesCount: number;
  testsCount: number;
}

export interface AdminPagedUsersDto {
  items: AdminUserListItemDto[];
  total: number;
  page: number;
  size: number;
}

export interface AdminUserDetailsDto {
  id: number;
  email: string;
  name: string;
  active: boolean;
  tier: string | null;
  tierExpiresAt: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  collections: { id: number; name: string; createdAt: string }[];
  examples: { id: number; title: string; createdAt: string }[];
  tests: { id: number; title: string; createdAt: string }[];
}

export interface AdminUsersQueryDto {
  search: string;
  sortBy: 'id' | 'email' | 'name' | 'createdAt' | 'lastActiveAt';
  sortDirection: 'asc' | 'desc';
  active: boolean | null;
  tier: string | null;
  page: number;
  size: number;
}

export interface AdminUserPatchDto {
  userId: number;
  active: boolean;
  tier: string;
  tierExpiresAt: string | null;
}

export interface AdminBulkUserUpdateRequest {
  changes: AdminUserPatchDto[];
}
