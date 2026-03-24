# College Football All-Time Records

Interactive dashboard of all 136 NCAA FBS football programs showing all-time win-loss records, bowl records, and national championships. Data sourced from Wikipedia through the 2025 season.

## Deploy to GitHub Pages

### Option A: Automatic (GitHub Actions) — Recommended

1. **Create a GitHub repo** named `cfb-all-time-records` (or whatever you like)

2. **Update `vite.config.js`** — change the `base` to match your repo name:
   ```js
   base: '/your-repo-name/',
   ```

3. **Push the code:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/cfb-all-time-records.git
   git push -u origin main
   ```

4. **Enable GitHub Pages** in your repo:
   - Go to **Settings → Pages**
   - Under **Source**, select **GitHub Actions**

5. The workflow runs automatically on push. Your site will be live at:
   ```
   https://YOUR_USERNAME.github.io/cfb-all-time-records/
   ```

### Option B: Manual (gh-pages branch)

1. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

2. Deploy to the `gh-pages` branch:
   ```bash
   npm run deploy
   ```

3. In your repo **Settings → Pages**, set Source to **Deploy from a branch** and select the `gh-pages` branch.

## Local Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`
