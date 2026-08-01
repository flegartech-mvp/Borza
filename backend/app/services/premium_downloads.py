from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True)
class VerifiedPurchase:
    provider_reference: str
    customer_id: str
    product_id: str
    purchased_at: datetime


class PaymentProvider(Protocol):
    def verify_webhook(self, payload: bytes, signature: str) -> VerifiedPurchase: ...


class EntitlementStore(Protocol):
    def grant(self, purchase: VerifiedPurchase) -> None: ...

    def has_active_entitlement(self, customer_id: str, product_id: str) -> bool: ...


class PrivateArtifactStore(Protocol):
    def create_signed_download_url(self, object_key: str, expires_in_seconds: int) -> str: ...


class PremiumDownloadService:
    def __init__(
        self,
        entitlements: EntitlementStore,
        artifacts: PrivateArtifactStore,
    ) -> None:
        self.entitlements = entitlements
        self.artifacts = artifacts

    def create_download_url(
        self,
        customer_id: str,
        product_id: str,
        object_key: str,
        expires_in_seconds: int = 300,
    ) -> str:
        if not self.entitlements.has_active_entitlement(customer_id, product_id):
            raise PermissionError("Active purchase entitlement required")
        return self.artifacts.create_signed_download_url(object_key, expires_in_seconds)
