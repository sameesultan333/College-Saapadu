from pydantic import BaseModel
from typing import List, Literal, Optional
from datetime import time


# ============================================================
# USER
# ============================================================

class UserCreate(BaseModel):
    college_id: int
    institutional_id: str
    name: str
    phone: str
    email: str
    password: str
    # Customer-level designation only (Student vs Staff/teacher) -- NOT the
    # canteen-operational StaffAccount role (Manager/Staff/Delivery), which
    # is a completely separate table only privileged accounts can create.
    # Restricted to these two values here in the schema itself so this
    # public, unauthenticated endpoint can never be used to self-assign a
    # privileged role (see CLAUDE.md section 17).
    role: Literal["student", "staff"] = "student"


# ============================================================
# AUTHENTICATION
# ============================================================

class LoginRequest(BaseModel):
    # No college_id: phone is globally unique (see models.py User.phone),
    # so it alone identifies the account. College is only ever selected at
    # registration now.
    phone: str
    password: str


# ============================================================
# COLLEGE
# ============================================================

class CollegeCreate(BaseModel):
    name: str


# ============================================================
# COMPANY ADMIN
# ============================================================

class CompanyAdminLogin(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str


# ============================================================
# CANTEEN
# ============================================================

class CanteenCreate(BaseModel):
    name: str
    location: Optional[str] = None


class CanteenUpdate(BaseModel):
    # All optional -- PATCH semantics, only the fields sent are changed.
    name: Optional[str] = None
    location: Optional[str] = None
    opens_at: Optional[time] = None
    closes_at: Optional[time] = None


# ============================================================
# AUTH TOKENS (Staff/Manager + Company Admin)
# ============================================================

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    role: str
    college_id: Optional[int] = None
    canteen_id: Optional[int] = None
    name: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


# ============================================================
# STAFF / MANAGER
# ============================================================

class StaffLogin(BaseModel):
    # No college_id: phone is globally unique (see models.py
    # StaffAccount.phone), so it alone identifies the account.
    phone: str
    password: str


class StaffCreate(BaseModel):
    name: str
    phone: str
    password: str
    confirm_password: str
    canteen_id: int
    role: Literal["staff", "delivery"] = "staff"


class ManagerCreate(BaseModel):
    name: str
    phone: str
    password: str
    college_id: int


# ============================================================
# MENU
# ============================================================

class StockUpdate(BaseModel):
    menu_item_id: int
    stock: int


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    is_veg: Optional[bool] = None
    gst_rate: Optional[float] = None


# ============================================================
# ORDER ITEMS
# ============================================================

class OrderItemInput(BaseModel):
    menu_item_id: int
    quantity: int


# ============================================================
# ORDERS
# ============================================================

class OrderCreate(BaseModel):
    user_id: int
    canteen_id: int
    items: List[OrderItemInput]
    payment_mode: str  # WALLET / UPI / CASH


class BatchCanteenOrder(BaseModel):
    canteen_id: int
    items: List[OrderItemInput]


class BatchOrderCreate(BaseModel):
    # Exactly one of user_id / guest_id must be provided -- validated in
    # the router (clearer error messages than a pydantic root_validator
    # would give here, and consistent with this file's existing style).
    user_id: Optional[int] = None
    guest_id: Optional[int] = None
    payment_mode: str
    canteens: List[BatchCanteenOrder]


class OrderStatusUpdate(BaseModel):
    order_id: int
    status: str


# ============================================================
# GUEST / WALK-IN CUSTOMER
# ============================================================
# college_id is deliberately NOT accepted here -- derived from the
# authenticated staff/manager's own token, same pattern as CanteenCreate.

class GuestCreate(BaseModel):
    name: str
    phone: str
    category: Literal["STUDENT", "PARENT", "STAFF"] = "STUDENT"


# ============================================================
# WALLET
# ============================================================

class WalletTopUp(BaseModel):
    user_id: int
    amount: float

