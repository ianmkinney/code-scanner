## ZYN Scanner (Next.js)

This app replicates the standalone `index.html` ZYN scanner UI/logic in a componentized Next.js app. It uses the device camera, scans QR in the viewfinder, and performs OCR below the QR to extract the case-sensitive code. Codes are copied to clipboard and you can jump to ZYN Rewards.

### Requirements
- Node 18+
- Camera-enabled device (mobile recommended)

### Install
```bash
npm install
```

### Run locally
```bash
npm run dev
```
Open `http://localhost:3000`.

Camera access requires HTTPS on mobile. Use a tunnel like ngrok.

### Expose with ngrok (for mobile HTTPS)
1. Install ngrok and sign in
2. Run your dev server: `npm run dev`
3. In another shell:
```bash
ngrok http 3000
```
4. Open the `https://` forwarding URL on your phone. Camera should work.

### Features
- Viewfinder aligned inside a stylized can puck
- Auto QR detection within the viewfinder
- OCR pass beneath the QR to preserve code casing
- Clipboard copy + quick open to ZYN Rewards
- Optional Supabase integration to de-duplicate and store scanned codes

### Tech
- React 19, Next 15 App Router
- `jsqr` for QR detection
- `tesseract.js` for OCR
- `@supabase/supabase-js` for persistence (optional)

### Source layout
- `src/components/Scanner.tsx`: main scanner UI + logic
- `src/app/globals.css`: styles ported from the HTML
- `src/app/page.tsx`: renders the scanner

### Environment (optional: Supabase)
Create a Supabase project (free tier) and these tables:

```sql
-- Table for storing scanned codes
create table if not exists public.scanned_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid references public.users(id),
  created_at timestamp with time zone default now()
);

-- Table for storing user accounts and preferences
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text default '#00cc6a',
  created_at timestamp with time zone default now()
);

-- Note: user_id is already included in the scanned_codes table above
```

Add env vars in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...your supabase url...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...anon key...
```

The app will auto-check for duplicates and insert new codes when configured.

## 🔒 Security

This application implements comprehensive security measures:

- **Row Level Security (RLS)**: Database-level data isolation
- **API Authentication**: JWT-based user verification
- **Rate Limiting**: Multi-tier abuse prevention
- **Input Validation**: Comprehensive data validation
- **Secure API Routes**: Server-side processing for sensitive operations

For detailed security documentation, see:
- [Security Architecture](README/SECURITY.md)
- [Security Implementation Guide](README/SECURITY_IMPLEMENTATION.md)

For more developer docs and component pseudo code, see the Obsidian notes in `README/`.
