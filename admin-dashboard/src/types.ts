// Shared cross-module types for the Manager's per-canteen operational
// dashboard (pages/AdminDashboard.tsx) and the feature modules it composes.
// Kept intentionally loose (string ids/status instead of strict literal
// unions) to match the existing modules under src/modules/**, which were
// already typed independently with plain `string` fields -- narrowing here
// without narrowing there just produces false type errors at the prop
// boundary, not real safety.

import type { ComponentType } from "react";

export type { Guest } from "./modules/guests/guestService";

/** Canteen.id from canteenService.ts. Widen to `number | string` here if a
 *  future caller needs string ids -- every current caller passes a number. */
export type CanteenId = number;

export type OrderStatus = string;
export type PaymentMode = "CASH" | "UPI" | "WALLET";
export type TabId = "overview" | "active-orders" | "counter" | "stock" | "history" | "insights";

export interface TabDefinition {
  id: TabId;
  icon: ComponentType<{ size?: number }>;
  label: string;
  badge?: number;
}

export interface CanteenStats {
  today_orders?: number;
  today_revenue?: number;
  total_revenue?: number;
  active_orders?: number;
}

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  stock: number;
  is_veg: boolean;
  prep_type?: string;
  gst_rate?: number | string;
}

export interface CartItem extends MenuItem {
  quantity: number;
}

export interface OrderItem {
  id?: number;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  order_id: number;
  status: string;
  payment_mode: string;
  payment_status?: string;
  total_amount?: number | null;
  student_name?: string;
  guest_code?: string | null;
  guest_phone?: string | null;
  phone?: string | null;
  canteen_name?: string;
  created_at: string;
  items: OrderItem[];
  estimated_wait_time?: number;
  estimated_ready_at?: number;
  people_in_line?: number;
}

export interface HistoryEntry {
  order_id: number;
  status: string;
  payment_mode: string;
  created_at: string;
  items: OrderItem[];
  payment_status?: string;
  total_amount?: number | null;
  student_name?: string;
  guest_code?: string | null;
  guest_phone?: string | null;
  phone?: string | null;
  canteen_name?: string;
}

export interface NewMenuItemForm {
  name: string;
  price: string;
  stock: string;
  is_veg: boolean;
  prep_type: string;
  gst_rate: string;
}

export interface MenuPrediction {
  name: string;
  confidence: string;
  currentStock: number;
  recommendedStock: number;
  avgDailySales: number;
  estimatedWaste: number;
  potentialLoss: number;
  wastePercentage?: number;
  wasteReduction?: number;
  riskLevel?: string;
}

export interface PerformanceMetrics {
  avgWasteReduction: number;
  totalWastePrevented: number;
  totalSavings: number;
  highConfidencePredictions: number;
}

export interface OrderPlacementPayload {
  guest_id: number;
  payment_mode: PaymentMode;
  canteens: Array<{
    canteen_id: CanteenId;
    items: Array<{ menu_item_id: number; quantity: number }>;
  }>;
}

export interface OrderPlacementResponse {
  orders: Array<{ order_id: number; verification_token: string; [key: string]: unknown }>;
  guest_code: string | null;
}

export interface OrderVerificationInfo {
  orderId: number;
  guestCode: string | null;
  verificationToken: string;
}

/** Discriminated union over the WS event shapes AdminDashboard.tsx reacts
 *  to -- see CLAUDE.md section 29 for why these event names/payloads must
 *  not be renamed without a corresponding backend change. */
export type SocketEvent =
  | { event: "ORDER_STATUS_UPDATE"; order_id: number; status: string }
  | { event: "STOCK_UPDATE"; menu_item_id: number; stock: number }
  | { event: "ETA_UPDATE"; order_id: number; estimated_wait_time: number; estimated_ready_at: number }
  | { event: "ORDER_DELIVERED"; order_id: number }
  | { event: "PICKUP_QUEUE_UPDATE"; order_id: number; people_in_line: number; estimated_ready_at: number }
  | { event: "NEW_ORDER"; order_id: number };

export function parseSocketEvent(raw: string): SocketEvent | null {
  try {
    return JSON.parse(raw) as SocketEvent;
  } catch {
    return null;
  }
}
