# Render preview deployment

The Render Blueprint runs the Express API, built Vite client, and Socket.io on one HTTPS origin. The public preview is [projectqr-preview.onrender.com](https://projectqr-preview.onrender.com). Changes pushed to `main` deploy automatically.

## Configure production phone verification

Production uses `OTP_MODE=sms`. Mock OTP is intentionally rejected in production. The backend supports Twilio Programmable Messaging and sends its own six-digit code, preserving ProjectQR's server-side OTP expiry, attempt, and resend checks.

In the Render service's **Environment** settings, add:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- Exactly one sender option: `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID`

Save the changes to restart the service. Keep these credentials in Render, never in Git, frontend variables, or chat. If all Twilio variables are absent, `/api/customer/request-otp` returns `SMS_NOT_CONFIGURED`. Partial or conflicting settings prevent the API from starting with an actionable configuration error.

Twilio's trial account only sends to destination numbers verified in the Twilio Console. To let other customers receive codes, upgrade the Twilio account. Review [Twilio's India SMS guidance](https://www.twilio.com/en-us/guidelines/in/sms) and [current India SMS pricing](https://www.twilio.com/en-us/sms/pricing/in) before enabling real customer traffic. Use the international route for the initial test; Twilio's guidance says it does not require DLT registration, while domestic sender registration does.

## Other deployment notes

- Keep the MongoDB Atlas database. Restrict Atlas Network Access to the Render service's outbound addresses where practical; avoid leaving `0.0.0.0/0` as a permanent rule.
- Menu images use local files. The free preview has ephemeral storage, so uploaded images can disappear after restarts or deploys. Use object storage or a persistent disk before relying on uploaded images.
- The free web service spins down after inactivity, so the first request may take about a minute to wake it. This is suitable for previewing and iteration, not an always-on service.
- Keep `.env` out of Git. Enter deployment secrets only in Render's environment settings.
