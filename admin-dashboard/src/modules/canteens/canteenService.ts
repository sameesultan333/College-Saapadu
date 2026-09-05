import { apiGet, apiPatch, apiPost } from "../../services/apiClient";

export interface Canteen {
  id: number;
  name: string;
  location: string | null;
  college_id: number;
  is_active: boolean;
  opens_at: string | null;
  closes_at: string | null;
}

export interface CanteenUpdatePayload {
  name?: string;
  location?: string;
  opens_at?: string | null;
  closes_at?: string | null;
}

// GET /canteens is public/unauthenticated, but routing it through apiGet is
// harmless (it just won't find a 401 to retry) and keeps every call site
// using the same helper. It only ever returns ACTIVE canteens -- fine for
// the mobile customer listing, but a manager/staff view that needs to see
// (and reopen) closed canteens should use fetchCanteensAdmin instead.
export async function fetchCanteens(collegeId: number): Promise<Canteen[]> {
  return apiGet(`/canteens?college_id=${collegeId}`);
}

// Manager/Staff view: every canteen in the caller's own college, active or
// closed. college_id is derived from the account's own token server-side.
export async function fetchCanteensAdmin(): Promise<Canteen[]> {
  return apiGet(`/canteens/admin`);
}

export async function createCanteen(name: string, location?: string): Promise<{ canteen_id: number; name: string }> {
  // Manager-only. college_id is deliberately NOT sent — the backend derives
  // it from the manager's own token (see CLAUDE.md section 34).
  return apiPost("/canteens/create", { name, location: location || undefined });
}

// Manager or Staff (their own assigned canteen only) — name/location/hours.
export async function updateCanteen(canteenId: number, payload: CanteenUpdatePayload): Promise<Canteen> {
  return apiPatch(`/canteens/${canteenId}`, payload);
}

// Manager or Staff (their own assigned canteen only) — flips is_active.
export async function toggleCanteen(canteenId: number): Promise<Canteen> {
  return apiPatch(`/canteens/${canteenId}/toggle`);
}
