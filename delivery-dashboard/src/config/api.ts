// Centralized backend endpoints for the Delivery Dashboard.
// Previously hardcoded directly inside modules/orders/useOrders.js.
// Reads from the .env REACT_APP_API_BASE / REACT_APP_WS_BASE that already
// existed in this app (unused until now), falling back to the same LAN
// address that was hardcoded before so behavior is unchanged if the env
// vars are ever missing.
export const API: string = process.env.REACT_APP_API_BASE || "http://172.20.10.2:8000";
export const WS: string = process.env.REACT_APP_WS_BASE || "ws://172.20.10.2:8000";
