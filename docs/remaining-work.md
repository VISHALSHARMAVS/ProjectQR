# Verification and remaining work

## Verified in this workspace

- TypeScript checks, ESLint, both production builds, and the unit suite pass.
- The API integration suite runs against an ephemeral MongoDB and covers registration/login, password hashing, tenant isolation, staff/kitchen roles, QR resolution, development OTP, table/session binding, local image upload, server-priced and idempotent orders, order status transitions, customer status reads, and authenticated Socket.io rooms.
- The Vite development server returned the client shell successfully over HTTP.

## Still needed before a real deployment or phone trial

- This workspace has no local MongoDB service or `mongod` binary. Regular `npm run dev` therefore needs MongoDB installed or `MONGODB_URI` set to a reachable instance. `npm run dev:memory` supports disposable local walkthroughs; all data is lost when it stops. The test database is also temporary.
- No SMS provider is connected. Development mock OTP works in the integration suite; `OTP_MODE=sms` currently returns a clear `503` until a provider is added. Production rejects mock mode.
- Image uploads use configurable local disk storage. Add durable object storage before deploying to an environment with ephemeral filesystems.
- The React flow has production-build and lint coverage, but it has not been clicked through in a browser or scanned from a physical phone in this session. A manual device pass needs a running API/MongoDB and `PUBLIC_APP_URL` plus `CLIENT_ORIGIN` set to the computer's LAN origin.
- No service was deployed and no external SMS, database, or image-storage account was created.
- A Render preview Blueprint is now prepared. Deployment still needs a private GitHub remote, a Render workspace, Atlas network access for the Render service, and an SMS provider for customer verification. The free preview sleeps after inactivity and does not preserve local uploads; see [deployment.md](deployment.md).
