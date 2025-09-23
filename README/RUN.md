---
tags: [howto]
---

# Run and Test

## Install
```bash
npm install
```

## Dev server
```bash
npm run dev
```
Open `http://localhost:3000`.

## Mobile testing with HTTPS (ngrok)
Camera APIs demand HTTPS on mobile. Use ngrok:

1. Install and auth: `brew install ngrok/ngrok/ngrok && ngrok config add-authtoken <token>`
2. Start Next.js: `npm run dev`
3. Expose port 3000:
```bash
ngrok http 3000
```
4. Open the `https://` forwarding URL on your phone.

## Notes
- Grant camera permission when prompted.
- Prefer back camera; the app auto-selects when possible.
- Align the QR inside the frame; the printed code should be directly below it.

