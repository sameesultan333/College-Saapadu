"""
Operational configuration for the transaction core.

Values here are deliberately configuration, not hardcoded business
rules -- particularly the reservation TTL, which is a business decision
that has NOT been finalised. The default below keeps the infrastructure
working end-to-end; change it via the environment once the business
picks a real number.
"""

import os

from dotenv import load_dotenv

load_dotenv()


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


# How long an inventory reservation is held before the sweeper may expire
# it. NOT a finalised business rule -- see the implementation report.
RESERVATION_TTL_MINUTES = _int_env("RESERVATION_TTL_MINUTES", 15)

# How long a completed idempotency record is honoured for replay.
IDEMPOTENCY_RETENTION_HOURS = _int_env("IDEMPOTENCY_RETENTION_HOURS", 24)

# Payment provider in use. "MANUAL" is the development/staff-confirmation
# provider that exists only until a real gateway is integrated.
PAYMENT_PROVIDER = os.getenv("PAYMENT_PROVIDER", "MANUAL")
