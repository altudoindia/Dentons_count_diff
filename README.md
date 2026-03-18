# Dentons Server Comparison App

Compare Insights, People/Bio, News, and Events across different Dentons web servers (production, preview, UAT, regional CDs). Select two servers to see side-by-side counts; when counts differ, find exactly which items exist only on one server. Also reports bios with empty job titles for data-quality checks.

## Features

- Side-by-side count comparison for Insights, People/Bio, News & Events
- Find exact differences when counts don't match
- Detect bios with empty job titles
- Supports all Dentons environments (production, s10, UAT, preview)
- Responsive UI with Tailwind CSS
- Built with Next.js 15 App Router and TypeScript

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build & Start

```bash
npm run build
npm start
```

## Project Structure

```
dentonsApp/
├── app/
│   ├── api/
│   │   ├── batch-counts/route.ts          # Fetch counts for insights/people/news
│   │   ├── events/route.ts                # Fetch upcoming/past events
│   │   ├── people/empty-jobtitle/route.ts # Find bios with empty job title
│   │   └── server-compare/route.ts        # Find differences between servers
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Technologies

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **React 18** - UI library
