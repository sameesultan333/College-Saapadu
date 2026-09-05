from fastapi import APIRouter, Depends

from database import get_db
from models import User
from auth import require_customer, CurrentAccount
from sqlalchemy.orm import Session


router = APIRouter(
    prefix="/wallet",
    tags=["Wallet"]
)


# NOTE: this router used to expose POST /wallet/pay -- an unauthenticated
# endpoint that took an arbitrary user_id + amount and debited that
# user's wallet with a plain read-then-write (no atomic guard, exactly
# the race condition CLAUDE.md section 53 warns against). It had no
# caller anywhere in admin-dashboard or mobileAppFresh: real wallet
# checkout already goes through the atomic, tenant-checked debit inside
# modules/transactions/checkout.py. Removed rather than authenticated,
# since keeping a second, weaker wallet-debit path around would just be
# a second thing to keep correct.

@router.get("/balance")
def get_my_wallet_balance(
    account: CurrentAccount = Depends(require_customer),
    db: Session = Depends(get_db)
):
    """Authoritative live balance for the logged-in customer -- the
    mobile app's cached login-time value can go stale after an order."""
    user = db.query(User).filter(User.id == account.account_id).first()
    return {"wallet_balance": user.wallet_balance if user else 0}

