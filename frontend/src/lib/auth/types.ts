export type UserDTO = {
  id: string;
  name: string;
  email: string;
};

export type LoginResponseDTO = {
  user: UserDTO;
  roles: string[];
  allowedLocations: string[];
  token: string;
  userContext?: {
    userId: number;
    role: string;
    branchId: number | null;
    departmentId?: number | null;
  };
};

export type RoleName =
  | "CEO"
  | "BRANCH_MANAGER"
  | "PROCUREMENT_HEAD"
  | "STORE_MANAGER"
  | "FINANCE"
  | "DEPARTMENT_HEAD"
  | "DEPARTMENT_STAFF";
