/**
 * Canteen type -- mirrors backend/models.py Canteen exactly, as returned
 * by GET /canteens. No client-side enrichment (rating, wait time, etc.)
 * is fabricated on top of it; the design reference is explicit that a
 * data point either comes from a real source or the row doesn't render
 * ("it does not show a guess" -- framework doc section 05).
 *
 * GET /canteens now returns closed canteens too (not just open ones) --
 * see CanteenSelectScreen.tsx, which dims them and shows opens_at instead
 * of hiding them.
 */
export interface Canteen {
  id: number;
  name: string;
  location?: string | null;
  college_id: number;
  is_active: boolean;
  /** "HH:MM:SS", nullable -- a canteen with no hours set yet shows none. */
  opens_at?: string | null;
  closes_at?: string | null;
}
