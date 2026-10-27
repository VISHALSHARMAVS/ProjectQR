# Verification and remaining work

## Verified in this workspace

- TypeScript checks, ESLint, and both production builds pass.
- The Twilio SMS adapter's four unit tests pass without making real SMS requests.
- The Render preview deployed successfully at https://projectqr-preview.onrender.com.
- A QR scan reaches the customer phone-verification screen.

## Remaining

- No Twilio account credentials or sender are configured. Add them in Render before OTP can send real messages; production rejects mock mode. See [deployment.md](deployment.md).
- The full test command is currently blocked because `mongodb-memory-server`'s `mongod` process exits with an internal `fassert()` error on this Windows host. The OTP adapter unit tests pass independently.
- This workspace has no local MongoDB service or `mongod` binary. Regular `npm run dev` needs MongoDB installed or `MONGODB_URI` set to a reachable instance. `npm run dev:memory` supports disposable local walkthroughs; its data disappears when it stops.
- Image uploads use local disk storage. Render's free filesystem is ephemeral, so uploaded images can disappear after restarts or deploys.
- The complete real-phone flow (OTP through kitchen status updates) has not been verified. Render's free preview sleeps after inactivity; the first request may take about a minute to wake.
