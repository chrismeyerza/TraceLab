# Setup Guide

Step-by-step from zero to "running on my computer" and "running on the internet via GitHub Pages".

## 1. Install Node.js

If you don't have it: go to [nodejs.org](https://nodejs.org) and download the LTS version (currently 20.x). Install it. Open a new terminal window and check:

```bash
node --version
npm --version
```

You should see version numbers (Node 20+ and npm 10+).

## 2. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/foresight-analytics.git
cd foresight-analytics
```

If you don't have Git yet either, [download GitHub Desktop](https://desktop.github.com/) which is a friendlier UI and includes Git underneath.

## 3. Install dependencies

```bash
npm install
```

This downloads all the libraries the project needs (React, Vite, xlsx) into a `node_modules/` folder. Takes 30 seconds. You only do this once after cloning, and again any time `package.json` changes.

## 4. Run the dev server

```bash
npm run dev
```

This starts Vite, which:
- Serves the app at http://localhost:5173 (it should auto-open)
- Hot-reloads the browser when you edit any file
- Gives you proper error messages in the browser console

Drag your Foresight Excel export into the drop zone and you're off.

## 5. Make changes

The code is organised so each view lives in its own file under `src/views/` and shared helpers under `src/lib/`. Editing any of them and saving will refresh the browser in well under a second.

A few useful things to know:
- `src/index.css` has all the global styles and CSS variables (colours, fonts, spacing tokens). Change `--green: #4ade80;` at the top to retheme the whole app.
- `src/data/benchmarks.js` has every club's optimal-window numbers. Edit these to tune the benchmarks.
- `src/lib/clubs.js` has the alias mapping. If a future Foresight export uses a new club name the parser doesn't recognise, add it here.

## 6. Build for production

```bash
npm run build
```

This compiles the app into a static `dist/` folder — just HTML, CSS, and one bundled JS file. You can host this anywhere that serves static files: GitHub Pages, Netlify, Vercel, your own server, an S3 bucket.

```bash
npm run preview
```

Runs the production build locally so you can verify before deploying.

## 7. Deploy to GitHub Pages

Two ways. **The easy way** uses the included GitHub Actions workflow:

1. Push the repo to GitHub.
2. In your repo, go to Settings → Pages.
3. Under "Build and deployment", change Source to **GitHub Actions**.
4. Push a commit to `main`. The workflow in `.github/workflows/deploy.yml` will build and deploy automatically.
5. Your app will be live at `https://YOUR_USERNAME.github.io/foresight-analytics/`.

After the first deploy, every push to `main` re-deploys automatically.

**The manual way** uses the `gh-pages` npm package:

```bash
npm run build
npm run deploy
```

This pushes `dist/` to a `gh-pages` branch on GitHub which Pages then serves.

## 8. Use on multiple devices

Once deployed, you can open the URL on your laptop, your phone, your iPad. **Important**: each device has its own IndexedDB — there's no automatic sync. If you want a single dataset across devices, you'd need to:

- Export/import your data manually (a feature we'd add to the Sessions view), or
- Move to a real backend with cloud storage and accounts (a v4 thing — not worth doing until you have multiple users)

## Common issues

**Port 5173 already in use** — something else is running on that port. Edit `vite.config.js` and change `port: 5173` to another number.

**`npm install` fails with `EACCES`** — permissions issue, usually on Mac/Linux. Don't `sudo npm install`. Instead, fix your Node setup with [nvm](https://github.com/nvm-sh/nvm) which installs Node into your home directory.

**Bundle size warning during build** — the xlsx library is ~400 KB. This is fine for v1 and gzips down to ~175 KB on the wire. We'd code-split it (only load when the user opens a file) as part of a later optimisation pass.

**Data loaded in the single-file version doesn't appear** — different. The single-file HTML and the Vite version use the same IndexedDB database name, so they *should* see the same data when run on the same browser. If they don't, it's because Vite is served from `localhost:5173` and your file:// HTML uses a different origin — IndexedDB is partitioned by origin. Re-import your data once and you're set.
