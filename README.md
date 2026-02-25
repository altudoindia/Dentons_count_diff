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

## Technologies

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **React 18** - UI library

## License

Private
