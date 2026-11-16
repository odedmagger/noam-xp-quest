# Student-editing implementation record

The latest [product specification](PRODUCT.md) supersedes the earlier proposal for a focused exam editor, a private edit link and a replacement storage provider. The release extends Phase 2 with inline student editing and load-on-open Firestore persistence. The [architecture](ARCHITECTURE.md) records the existing schema, temporary public edits and future account/student split.

Implementation is verified locally before any release. Approve the exact public-write rules and deployment target separately before updating rules or publishing Hosting. The multi-user phase will replace public access with managed authentication and explicit student permissions.
