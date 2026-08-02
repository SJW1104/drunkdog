from __future__ import annotations

import re


# These endpoints belong to the superseded entertainment/points plan.  The
# implementation is kept temporarily for rollback and data migration, but new
# clients must not depend on it.
_LEGACY_PATH_PATTERNS = tuple(
    re.compile(pattern)
    for pattern in (
        r"^/api/v1/attendance(?:/|$)",
        r"^/api/v1/wallet$",
        r"^/api/v1/rankings$",
        r"^/api/v1/rewards(?:/|$)",
        r"^/api/v1/users/me/coupons$",
        r"^/api/v1/coupons(?:/|$)",
        r"^/api/v1/ads/rewarded(?:/|$)",
        r"^/api/v1/integrations/admob/rewarded$",
        r"^/api/v1/balance-games(?:/|$)",
        r"^/api/v1/balance-posts(?:/|$)",
        r"^/api/v1/surveys/[^/]+/reward-boost(?:/|$)",
        r"^/api/v1/surveys/[^/]+/results/purchase$",
    )
)


def is_legacy_gamification_path(path: str) -> bool:
    return any(pattern.match(path) for pattern in _LEGACY_PATH_PATTERNS)
