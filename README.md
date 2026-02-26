# Dentons People Search App

A Next.js application that displays a searchable list of Dentons professionals using the Dentons People Search API.

## Features

- 📱 Responsive grid layout (2 columns on desktop, 1 column on mobile)
- 🎨 Modern UI matching Dentons brand design
- 🔍 Real-time data fetching from Dentons API
- ⚡ Built with Next.js 15 App Router
- 🎯 TypeScript for type safety
- 💅 Styled with Tailwind CSS

## Getting Started

### Installation

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

Build the application for production:

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

## Project Structure

```
dentonsApp/
├── app/
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home page (people list)
│   └── globals.css      # Global styles
├── types/
│   └── index.ts         # TypeScript type definitions
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## API

The app fetches data from:
```
https://www.dentons.com/DentonsServices/DentonsPeopleSearch.asmx/SearchResultData
```

Query parameters:
- `data`: Search query (empty for all results)
- `contextLanguage`: Language context (en)
- `contextSite`: Site context (dentons)
- `pageNumber`: Page number (1)
- `pageSize`: Results per page (20)

## Deploying to Vercel (when Dentons APIs need VPN)

Dentons APIs (insights, people, news, events) are only reachable from inside the corporate network or when connected via VPN. Vercel runs on the public internet, so direct fetches from Vercel to those URLs will fail.

**Solution: run a proxy that has VPN access.** You can use either your **local PC** (easiest) or a **separate server**.

---

### Option A: Use your local machine as proxy (recommended if you have VPN on your PC)

Your laptop/PC already has VPN and can reach Dentons. Expose your local app to the internet with a tunnel so Vercel can call it.

1. **Connect VPN** on your machine and confirm Dentons works (e.g. open app locally and check insights).

2. **Run the app locally**
   ```bash
   npm run dev
   ```
   App runs at `http://localhost:3000`.

3. **Expose localhost to the internet** with a tunnel (choose one):
   - **ngrok** (simple): Install from [ngrok.com](https://ngrok.com), then:
     ```bash
     ngrok http 3000
     ```
     You’ll get a URL like `https://abc123.ngrok-free.app`. Use this as the proxy base URL (no trailing slash).
   - **Cloudflare Tunnel** or **localtunnel** work the same way: they give you a public URL that forwards to `localhost:3000`.

4. **Set env on Vercel**
   - Vercel → Project → Settings → Environment Variables
   - Add: `DENTONS_PROXY_URL` = your tunnel URL (e.g. `https://abc123.ngrok-free.app`) — **no trailing slash**
   - Redeploy the Vercel project.

5. **When you want Vercel to fetch data**
   - Keep **VPN connected**, **`npm run dev`** running, and **ngrok (or your tunnel) running**.
   - Vercel will send API requests to your tunnel → your local app → Dentons (via VPN) → response back.

**Note:** This works only while your PC is on, VPN is connected, and the dev server + tunnel are running. For 24/7 access without your laptop, use Option B (a server with VPN).

---

### Option B: Use a separate server as proxy

1. **Deploy the same app** on a host that has VPN (e.g. company server or VPS with VPN client). That host’s URL is your proxy, e.g. `https://dentons-proxy.yourcompany.com`.

2. **Set env on Vercel**
   - `DENTONS_PROXY_URL` = `https://dentons-proxy.yourcompany.com` (no trailing slash)
   - Redeploy.

3. **Behaviour**
   - When `DENTONS_PROXY_URL` is set, all Dentons API routes on Vercel forward the request to the proxy. The proxy fetches from Dentons (because it has VPN) and returns the response.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DENTONS_PROXY_URL` | No (only for Vercel when APIs need VPN) | Base URL of a proxy that has VPN access to Dentons. Example: `https://my-proxy.example.com` |

See `.env.example` for a template.

## Technologies

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **React 18** - UI library

## License

## Private
## https://kian-undefendable-fabiola.ngrok-free.dev/