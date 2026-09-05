# Notification service boundary. SMS/WhatsApp provider integration is
# explicitly future work (see CLAUDE.md's walk-in/verification notes) --
# this module exists so order/verification logic never needs to change
# when a real provider is wired in later. For now it only logs; the
# order and its verification token remain valid regardless of whether a
# message was actually sent (an unreachable customer or a failed SMS
# must never invalidate an otherwise-good order).


def notify_order_confirmed(order_id: int, phone: str | None, token: str) -> None:
    if not phone:
        print(f"[notifications] order {order_id}: no phone on file, skipping notify")
        return

    # TODO: wire an actual SMS provider here (preferred channel -- see
    # CLAUDE.md, no mobile data required to receive it). WhatsApp as an
    # optional future fallback. Until then this is a deliberate no-op;
    # the verification token is already persisted and independently
    # retrievable via GET /verification/order/{order_id}.
    print(f"[notifications] order {order_id}: would SMS verification token to {phone} (provider not configured)")
