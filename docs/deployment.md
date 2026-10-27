# Public preview deployment

The repository includes a Render Blueprint for a single-service preview. The Express server serves the production Vite build and the REST/Socket.io API from the same HTTPS origin. This keeps browser cookies, QR links, API requests, and live order updates on one host.

## Before deploying

- Push this project to a private GitHub repository and connect that repository to Render. The current local checkout has no Git remote, so Render cannot deploy it yet.
- Keep the MongoDB Atlas database. Add the Render service's outbound IP addresses in Atlas Network Access; do not use `0.0.0.0/0` as a permanent rule.
- Production OTP delivery is not integrated yet. The Blueprint sets `OTP_MODE=sms`, but the current SMS adapter returns `SMS_NOT_CONFIGURED`; customers cannot complete phone verification until a real provider is configured. Mock OTP is intentionally blocked in production.
- Menu image uploads currently use local files. The free preview has ephemeral storage, so uploaded images can disappear after restarts or deploys. Use object storage or a paid persistent disk before relying on uploaded images.

## Create the preview

1. Push the repository to GitHub as a private repository.
2. In Render, choose **New → Blueprint** and connect that repository.
3. Review `render.yaml`. Render will ask for `MONGODB_URI`; enter the Atlas application connection string in the Render secret field, never in this file or Git.
4. Apply the Blueprint and wait for the `/api/health` check to pass.
5. Open the service's HTTPS URL, register an owner account, and create the menu and tables. QR codes use that public URL automatically.

The free web service is for previewing and iteration. Render spins it down after 15 minutes without traffic, so the next request can take about a minute to wake it. It does not provide persistent local file storage. Upgrade only if you need an always-on service or a persistent disk.

## Updating the live preview

With auto-deploy enabled, changes pushed to the connected branch build and deploy automatically. Check the Render deploy log and `/api/health` after each change. Keep `.env` out of Git; enter deployment secrets in Render's environment settings.
