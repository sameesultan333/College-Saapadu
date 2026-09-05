import { apiPost } from "../../services/apiClient";

export type GuestCategory = "STUDENT" | "PARENT" | "STAFF";

export interface Guest {
  id: number;
  guest_code: string;
  name: string;
  phone: string;
  category: GuestCategory;
  college_id: number;
}

// Manager/Staff only -- college_id is derived server-side from the
// operator's own token, never sent from here. See CLAUDE.md's walk-in
// customer notes: a guest is a separate identity, never a fake User row.
// `category` is self-declared by the walk-in customer at the counter --
// informational only (drives the kitchen/delivery order card label),
// never a trust or authorization signal.
export async function createGuest(name: string, phone: string, category: GuestCategory): Promise<Guest> {
  return apiPost("/guests/create", { name, phone, category });
}
