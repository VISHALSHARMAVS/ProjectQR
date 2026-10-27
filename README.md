# ProjectQR

ProjectQR is a full-stack restaurant ordering MVP. Customers scan table QR codes to browse menus and place dine-in orders, while staff manage menus, tables, and kitchen orders with live status updates. Built with React, TypeScript, Express, MongoDB, and Socket.io. Customer-facing branding is configured per restaurant.

## Requirements

- Node.js 24 (Node 20.19+ is required by the current Vite toolchain)
- npm 10+
- MongoDB 7+ (local instance or a configured MongoDB URI)

## Run locally

1. Copy `.env.example` to the project root as `.env` and set unique `SESSION_SECRET` and `OTP_SECRET` values. The server loads this root file even when started from its workspace directory.
2. Start MongoDB.
3. Run `npm install` and `npm run dev`.
4. Open the client at http://localhost:5173. The API listens on http://localhost:4000.

If MongoDB is not installed, `npm run dev:memory` starts the API with a temporary in-memory MongoDB for local walkthroughs. That database is disposable: registrations, menus, and orders are erased when the process stops. Use `npm run dev` with `MONGODB_URI` for persistent local data. The in-memory MongoDB binary may download the first time this mode runs.

To scan a development QR code with a phone on the same Wi-Fi, set both `PUBLIC_APP_URL` and `CLIENT_ORIGIN` to the computer's LAN address (for example, `http://192.168.1.20:5173`) before creating the QR code. Vite listens on the network interface for this purpose. `localhost` on the phone refers to the phone itself.

In development, OTP mode is `mock`; the generated code is returned by the API and printed to the server log. This mode is rejected outside development/test. For phone verification, `OTP_MODE=verify` uses Twilio Verify to generate and check codes. `OTP_MODE=sms` uses direct Twilio Messaging with ProjectQR-generated codes and a configured sender.

## Commands

- `npm run dev` — client and API
- `npm run build` — type checks and production builds
- `npm run typecheck` — TypeScript checks
- `npm run lint` — ESLint
- `npm test` — business-rule and API integration tests (the integration suite uses a temporary MongoDB process; the MongoDB test binary downloads on the first run)
- `npm run seed` — create a local demo restaurant, categories, items, and tables

The seed uses `SEED_OWNER_EMAIL` and `SEED_OWNER_PASSWORD` when provided; otherwise it prints generated demo credentials once. The seed is development-only.

## Configuration

See `.env.example`. `PUBLIC_APP_URL` is used to generate QR destinations and must be the public frontend origin in a deployed environment. `UPLOAD_DIR` stores validated image files locally for development. Production object storage should be configured behind the image storage service before deployment; local disk is not durable on many hosting platforms. Cookies are HTTP-only and secure in production. Keep session and OTP secrets private.

For a hosted preview, see [docs/deployment.md](docs/deployment.md) and the Render Blueprint in `render.yaml`. Twilio trial accounts can test Verify only with verified recipients; public customer phone verification requires an upgraded, correctly configured Twilio account.

No payment processing is included. Dine-in payment is handled by the restaurant outside ProjectQR.

## Current MVP scope

The app provides restaurant registration/login, tenant-scoped menu/category/table/order APIs, owner-managed staff and kitchen accounts, local menu image uploads, table QR generation, customer OTP/session flow, server-priced orders, authenticated live kitchen updates, and customer order tracking. Automated integration tests exercise the owner-to-kitchen API workflow, tenant boundaries, OTP/table binding, server pricing, idempotency, status transitions, local image upload, and Socket.io room authorization against an ephemeral MongoDB. See [remaining work](docs/remaining-work.md) for verification limits and production integration points.
