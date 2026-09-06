import { apiGet, apiPatch, apiPost, apiDelete } from "../../services/apiClient";

export type StaffRole = "staff" | "delivery";

export interface StaffMember {
  id: number;
  name: string;
  staff_id: string | null;
  phone: string;
  canteen_id: number;
  is_active: boolean;
  role: StaffRole;
}

export async function fetchStaff(role: StaffRole, canteenId?: number): Promise<StaffMember[]> {
  const params = new URLSearchParams({ role });
  if (canteenId) params.set("canteen_id", String(canteenId));
  return apiGet(`/staff?${params.toString()}`);
}

export interface CreateStaffInput {
  name: string;
  staff_id: string;
  phone: string;
  password: string;
  confirm_password: string;
  canteen_id: number;
  role: StaffRole;
}

export async function createStaff(
  input: CreateStaffInput
): Promise<{ id: number; name: string; staff_id: string | null; canteen_id: number; role: StaffRole }> {
  return apiPost("/staff/create", input);
}

export async function toggleStaff(staffId: number): Promise<{ id: number; is_active: boolean }> {
  return apiPatch(`/staff/${staffId}/toggle`);
}

export async function deleteStaff(staffId: number): Promise<{ message: string; id: number }> {
  return apiDelete(`/staff/${staffId}`);
}
