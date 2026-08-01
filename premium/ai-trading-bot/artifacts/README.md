# Private premium artifacts

This public repository intentionally contains no paid bot package.

The Borza AI Trading Bot is proprietary. Build artifacts are generated only
from an authorized private source workspace and public source packages must
never be committed. The packaging wrappers in the parent directory may create
an ignored local ZIP for authorized development, but that output remains
private and is not a release asset.

For production, store the vetted package in private object storage and deliver
it only after a verified purchase entitlement using a short-lived signed URL.
Do not place paid artifacts in `frontend/public`, attach them to public Git
releases, or commit them to this repository.
