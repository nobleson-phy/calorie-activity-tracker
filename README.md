# FitTrack — Calorie & Activity Tracker

A simple, offline-capable web app for logging meals and physical activity, tracking calories, and finding out how much walking, brisk walking, jogging or running you need each day to reach your weight-loss goal.

Built with plain HTML, CSS and JavaScript — no frameworks, no build step, no server. Hosted on GitHub Pages and installable on Android as a home-screen app.

**Live app:** https://<your-username>.github.io/<your-repo>/

## Features

- **Goal setup** — enter sex, age, height, current weight, goal weight and a weekly loss rate (0.25–1 kg/week). The app calculates your daily calorie target and a projected goal date.
- **Meal logging** — breakfast, lunch, dinner and snacks. Choose from ~100 built-in foods (Indian, Japanese and everyday Western dishes) or add your own with custom calories.
- **Activity logging** — walking, brisk walking, jogging, running, cycling, swimming, yoga, badminton, cricket, gym and more. Enter minutes, distance (km) or steps.
- **Activity needed today** — shows how many km of walking, brisk walking, jogging *or* running (each an alternative) would keep you on track, with approximate minutes and steps.
- **Meal reminders** — prompts you to log a meal if its usual time has passed and nothing is logged.
- **History** — 7- and 30-day calorie charts, plus a weight log with a 7-day trend line.
- **Backup** — export and import all data as a JSON file.
- **Private & offline** — all data stays on your device; the app makes no network requests.

## How the numbers are calculated

| Quantity | Formula |
|---|---|
| BMR (Mifflin–St Jeor) | Male: `10W + 6.25H − 5A + 5` · Female: `10W + 6.25H − 5A − 161` |
| Baseline daily burn (TDEE) | `BMR × 1.2` (sedentary; exercise is added separately) |
| Daily deficit | `rate (kg/week) × 7700 / 7` kcal |
| Daily intake target | `TDEE − deficit`, but never below `max(BMR, 1500 kcal ♂ / 1200 kcal ♀)` |
| Exercise burn | `(MET − 1) × weight (kg) × hours` |
| Extra burn needed today | `max(consumed, target) − TDEE − exercise burned + deficit` |
| Distance needed | `extra kcal × speed / ((MET − 1) × weight)` km |

W = weight (kg), H = height (cm), A = age (years). 1 kg of body fat ≈ 7700 kcal.

Speeds/METs used: walking 4.8 km/h (3.5), brisk walking 6.4 km/h (5.0), jogging 8 km/h (8.3), running 10.8 km/h (11.0).

> **Disclaimer:** All values are estimates, not medical advice. Consult a doctor before starting a weight-loss or exercise programme.

## Install on Android

1. Open the live app link in **Chrome**.
2. Tap **⋮ → Add to Home screen** (or **Install app**).
3. FitTrack opens from your home screen like a normal app and works offline.

## Deploy your own copy

1. Create a GitHub repository and upload all files in this folder to the repository root.
2. Go to **Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
3. After a minute or two the app is live at `https://<your-username>.github.io/<your-repo>/`.

When you change any file, bump `CACHE_VERSION` in `sw.js` so installed copies pick up the update.

## Limitations

- Reminders only appear while the app is open (or recently used). A static web app can't send notifications when fully closed without a push server.
- Data is stored in the browser on one device only. Clearing site data deletes it — export a backup regularly.
- Food and activity values are typical estimates; use custom entries for better accuracy.

## Files

| File | Purpose |
|---|---|
| `index.html` | App layout |
| `style.css` | Styling (light & dark mode) |
| `app.js` | Logic, calculations, storage |
| `foods.js` | Built-in food list |
| `activities.js` | Activity/MET list |
| `manifest.webmanifest` | App name, icons, install settings |
| `sw.js` | Service worker for offline use |
| `icons/` | App icons |

## License

MIT — free to use and modify.
