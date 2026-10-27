# Architecture and implementation plan

## Data boundaries

- `Restaurant` owns users, categories, menu items, tables, and orders.
- Every staff request derives its tenant from the authenticated user record.
- Public ordering starts from a random table token. Customer sessions record the resolved restaurant and table; clients never choose a tenant ID.
- Orders store item names, paise prices, quantities, and notes as immutable snapshots. Menu edits cannot rewrite past orders.
- MongoDB is authoritative. Socket.io only signals persisted changes to authenticated restaurant or customer-session rooms.

## Milestones

1. Workspace/tooling and data model.
2. Session authentication and tenant-scoped catalog/table APIs.
3. OTP, customer session, cart/checkout, and order tracking APIs.
4. Kitchen transitions and authenticated real-time events.
5. Customer and staff interfaces, responsive states, and QR print/download.
6. Checks, seed workflow, and setup documentation.

The database connection is configurable; no MongoDB credentials or running external integrations were present at initial inspection.
