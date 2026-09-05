import { get, post, patch, del } from "../../services/api";

export interface Manager {
  id: number;
  name: string;
  phone: string;
  college_id: number;
  is_active: boolean;
}

export function listManagers(collegeId?: number): Promise<Manager[]> {
  const query = collegeId != null ? `?college_id=${collegeId}` : "";
  return get(`/company/managers${query}`);
}

export function createManager(data: {
  name: string;
  phone: string;
  password: string;
  college_id: number;
}): Promise<{ message: string; id: number; name: string; college_id: number }> {
  return post("/company/managers/create", data);
}

export function toggleManager(managerId: number): Promise<{ id: number; is_active: boolean }> {
  return patch(`/company/managers/${managerId}/toggle`);
}

export function deleteManager(managerId: number): Promise<{ message: string; id: number }> {
  return del(`/company/managers/${managerId}`);
}
