# Render preview deployment

The Render Blueprint runs the Express API, built Vite client, and Socket.io on one HTTPS origin. The public preview is [projectqr-preview.onrender.com](https://projectqr-preview.onrender.com). Changes pushed to `main` deploy automatically.

## Configure production phone verification

For OTP, use Twilio Verify (`OTP_MODE=verify`). Mock OTP is intentionally rejected in production. Verify generates and checks the code with Twilio while ProjectQR enforces its own session, resend, and attempt limits. Direct Messaging (`OTP_MODE=sms`) remains available for an upgraded account with a configured sender.

In the Render service's **Environment** settings, add:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID` (create a Verify Service in Twilio Console; the SID starts with `VA`)
- Set `OTP_MODE=verify`

Save the changes to restart the service. Keep these credentials in Render, never in Git, frontend variables, or chat. The existing `TWILIO_FROM` value is not used in Verify mode.

With a Twilio trial, Verify can send only to numbers verified in the Twilio Console. This is suitable for testing your own verified number, not public restaurant customers. Twilio Messaging trial errors `572002` and `572006` mean the trial sender is not assigned to the recipient and the custom ProjectQR OTP body is not allowed. Verify avoids those Messaging trial constraints by using Twilio's Verify trial sender and template. To send OTPs to arbitrary customers, upgrade the Twilio account and complete any required destination-country setup. Review [Twilio's India SMS guidance](https://www.twilio.com/en-us/guidelines/in/sms) and [current India SMS pricing](https://www.twilio.com/en-us/sms/pricing/in) before enabling real customer traffic.

## Other deployment notes

- Keep the MongoDB Atlas database. Restrict Atlas Network Access to the Render service's outbound addresses where practical; avoid leaving `0.0.0.0/0` as a permanent rule.
- Menu images use local files. The free preview has ephemeral storage, so uploaded images can disappear after restarts or deploys. Use object storage or a persistent disk before relying on uploaded images.
- The free web service spins down after inactivity, so the first request may take about a minute to wake it. This is suitable for previewing and iteration, not an always-on service.
- Keep `.env` out of Git. Enter deployment secrets only in Render's environment settings.
