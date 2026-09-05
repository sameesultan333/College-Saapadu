"""
Payment provider boundary.

    CheckoutService -> PaymentService -> PaymentProvider
                                            |
                          DevelopmentProvider  (now)
                          UpiGatewayProvider   (future)

The provider decides nothing about inventory, orders or tenancy -- it
only reports what the payment instrument did. Swapping the development
provider for a real gateway must not require touching checkout,
inventory, reservations, order state, reports, delivery or QR
verification.

IMPORTANT: no provider here accepts "the frontend said it succeeded".
The development provider's success path is an authenticated, authorised,
audited staff action, not a client assertion.
"""

from dataclasses import dataclass
from typing import Optional, Protocol


@dataclass
class PaymentIntent:
    """What the provider hands back when a payment is initiated."""
    provider: str
    provider_payment_id: Optional[str]
    # True only for instruments that settle inside our own database
    # (wallet). Everything else starts PENDING and is settled later by a
    # staff confirmation today, or a gateway webhook once integrated.
    settled_immediately: bool = False


class PaymentProvider(Protocol):
    name: str

    def create_intent(self, *, order_id: int, amount, method: str) -> PaymentIntent:
        ...

    def supports_manual_confirmation(self) -> bool:
        ...


class DevelopmentProvider:
    """
    Temporary provider used while no real gateway is integrated.

    It deliberately does NOT auto-succeed. A UPI or CASH order is created
    PENDING and holds its inventory reservation; settlement happens only
    through the authenticated staff confirmation endpoint, which records
    who confirmed it. This keeps the full transaction architecture --
    reservation, state machine, idempotency, audit -- exercised exactly
    as it will run against a real provider.
    """

    name = "MANUAL"

    def create_intent(self, *, order_id: int, amount, method: str) -> PaymentIntent:
        return PaymentIntent(
            provider=self.name,
            provider_payment_id=f"manual-{order_id}",
            settled_immediately=False,
        )

    def supports_manual_confirmation(self) -> bool:
        return True


class WalletProvider:
    """
    Internal instrument: funds move inside our own database, so the
    payment settles within the same local transaction as the debit.
    There is no external party and therefore no webhook.
    """

    name = "WALLET"

    def create_intent(self, *, order_id: int, amount, method: str) -> PaymentIntent:
        return PaymentIntent(
            provider=self.name,
            provider_payment_id=f"wallet-{order_id}",
            settled_immediately=True,
        )

    def supports_manual_confirmation(self) -> bool:
        return False


def get_provider(method: str) -> PaymentProvider:
    """Select the provider for a payment method."""
    if (method or "").upper() == "WALLET":
        return WalletProvider()
    return DevelopmentProvider()
