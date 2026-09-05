/**
 * Logged-in customer session, as stored in AsyncStorage("user") by
 * services/auth.js loginUser(). Mirrors POST /users/login's response
 * (profile fields + access/refresh token pair -- see backend/auth.py).
 */
export interface User {
  id: number;
  college_id: number;
  institutional_id: string;
  name: string;
  phone: string;
  email?: string | null;
  wallet_balance: number;
  role?: string;
  access_token: string;
  refresh_token: string;
}
