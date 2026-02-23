export type RoleName =
  | "CEO"
  | "SYSTEM_AUDITOR"
  | "GENERAL_MANAGER"
  | "DEPARTMENT_HEAD"
  | "PROCUREMENT_OFFICER"
  | "STORE_MANAGER"
  | "FINANCE_MANAGER"
  | "STORE_CONTROLLER";

export type UserScope = {
  allLocations: boolean;
  locationId?: string;
  departmentId?: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  scope: UserScope;
};

export type LoginResponseDTO = {
  user: AuthUser;
  token: string;
};
