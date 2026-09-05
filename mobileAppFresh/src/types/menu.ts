/**
 * Menu item types.
 *
 * Base fields mirror the exact shape returned by GET /menu/:canteenId
 * (see backend/modules/menu/router.py get_menu). `image_url` and
 * `is_popular` are not sent by the backend today -- they stay optional
 * so FoodImage/MenuPageScreen can fall back cleanly (emoji, no tag) until
 * a real value shows up, without requiring a backend contract change.
 */
export interface MenuItem {
  id: number;
  name: string;
  price: number;
  stock: number;
  canteen_id: number;
  is_veg: boolean;
  gst_rate?: number;
  image_url?: string | null;
  is_popular?: boolean;
}
