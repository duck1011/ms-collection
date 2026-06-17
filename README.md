# MS Collection

Sistem manajemen nota seragam dan apparel untuk bisnis MS Collection. Aplikasi web berbasis browser dengan penyimpanan data lokal — tidak memerlukan server backend.

## Fitur

- **Dashboard** — ringkasan pendapatan, grafik pendapatan, dan status pembayaran
- **Buat Nota** — form multi-langkah untuk membuat nota baru dengan validasi
- **Riwayat** — daftar nota, pencarian, unduh PDF, dan kelola status pembayaran
- **Pengaturan** — konfigurasi informasi bisnis dan rekening bank

## Tech Stack

| Kategori | Library |
|----------|---------|
| UI | React 19, TypeScript, Vite, Tailwind CSS |
| Routing | Wouter |
| Forms | React Hook Form, Zod, @hookform/resolvers |
| State & Data | Zustand, idb (IndexedDB), TanStack React Query |
| PDF | @react-pdf/renderer |
| Charts | Recharts |
| Animations | Framer Motion |
| UI Primitives | Radix UI, Lucide React, class-variance-authority, clsx, tailwind-merge |
| Dates | date-fns |

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- [pnpm](https://pnpm.io/) 9 or later

## Getting Started

```bash
# Clone the repository
git clone <your-repo-url>
cd MSCollectionzip

# Install dependencies
pnpm install

# Start development server (default: http://localhost:5173)
pnpm dev
```

### Environment Variables (optional)

The dev server reads these from the environment. Defaults work for local development:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5173` | Dev/preview server port |
| `BASE_PATH` | `/` | Vite base path for deployment |

Example on Windows PowerShell:

```powershell
$env:PORT="23904"; pnpm dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the MS Collection dev server |
| `pnpm build:app` | Build the production bundle |
| `pnpm preview` | Preview the production build locally |
| `pnpm typecheck` | Run TypeScript checks across the monorepo |
| `pnpm build` | Typecheck and build all workspace packages |

## Project Structure

```
├── artifacts/ms-collection/   # Main React app (MS Collection)
├── lib/                       # Shared workspace libraries
├── attached_assets/           # Static assets (logos, images)
├── package.json               # Monorepo root
└── pnpm-workspace.yaml        # pnpm workspace config
```

## Deployment

Build the static site:

```bash
pnpm build:app
```

Output is written to `artifacts/ms-collection/dist/public/`. Deploy that folder to any static host (GitHub Pages, Netlify, Vercel, etc.).

For sub-path hosting, set `BASE_PATH` before building:

```bash
# Linux/macOS
BASE_PATH=/my-app/ pnpm build:app

# Windows PowerShell
$env:BASE_PATH="/my-app/"; pnpm build:app
```

## Data Storage

All receipt and settings data is stored in the browser via IndexedDB. No data is sent to a server. Clearing browser storage will remove local data.

## License

MIT
