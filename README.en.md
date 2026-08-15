# dsh-appearance — DeepSeek Harness appearance plugin

**[中文](README.md) | English**

A plugin that beautifies the DeepSeek Harness web interface:

- 🎨 **Three palette presets**: Default / Neon / Fresh, automatically adapting to the system light/dark scheme
- 🌈 **Custom background**: None / Solid / Linear gradient / Radial gradient, any RGB color + angle
- 🖼️ **Image / Video wallpaper**: import local files, fullscreen display, adjustable opacity and dimming
- 📐 **Sidebar background**: Solid / Gradient / Glass (opacity + blur strength)
- 💎 **Glass composer input**: translucent + backdrop blur + custom border, all adjustable in real time
  - The custom border supports both "Gradient / Solid" options, **rendered uniformly as a solid border**, applying only to the composer border
- Every effect can be **layered freely** to create your own workspace

---

## Installation

### Method 1: One-click import via an AI assistant (recommended, no technical background needed)

1. Open the DeepSeek Harness web interface and enter any session
2. Hand the contents of `dsh-appearance.client.js` to the AI assistant in the conversation and tell it:

   > Define a Cordis plugin with this file content as `code.client`, then run it.

3. A run confirmation card appears in the page — click "**Allow**" (only needed the first time; subsequent runs are auto-approved)
4. Done! Open **Settings → "Appearance"** to start using it

### Method 2: Static deployment for administrators (for deployment ops)

Make the plugin available out of the box for every user:

1. Make sure `@deepseek-ai/dsh-client-ui-appearance` is installed in the deployment (its `lib/client.js` must be built first)
2. Mount this directory's `dsh-appearance.cordis.yml` at startup:

   ```sh
   dsh web --patch ./dsh-appearance.cordis.yml
   ```

   Or merge its contents into `$DSH_HOME/.dsh/cordis.patch.yml` to make it permanent
3. Restart `dsh web` — the plugin ships with the deployment

---

## Usage

Open settings (gear at the bottom of the sidebar) → "Appearance". The page has four sections:

### 🎨 Palette

| Preset | Style |
|---|---|
| Default | Original Harness palette |
| Neon | Deep blue-black + cyan accent |
| Fresh | Soft light colors + blue accent |

Click to switch, takes effect immediately, light/dark follows the system.

### 🌈 Background

After choosing a type (None / Solid / Linear gradient / Radial gradient):

1. Click the color swatch to open the picker (or type exact **R / G / B** values)
2. Linear gradients support the "Angle" slider (0–360°)
3. Changes apply in real time — no extra button needed

**Image / Video wallpaper**:

1. Click "Upload image" or "Upload video" and pick a local file (JPG / PNG / WebP / MP4 / WebM)
2. Use the "Opacity" slider to tune brightness and "Dim" to darken the overlay (dimming is recommended for video wallpapers so text stays readable)
3. Click "Remove" to restore

### 📐 Sidebar background

- **Custom sidebar** (toggle): master switch; off restores the default
- **Solid**: a single color fills the column
- **Gradient**: two colors + angle
- **Glass**: translucent + backdrop blur, blur strength adjustable

### 💎 Dialog settings (glass composer)

The message input can become a frosted-glass surface; every adjustment takes effect **in real time**:

- **Glass input** (toggle): master switch; off restores the original style
- **Opacity** (slider): 5%–95%, higher means more transparent
- **Blur strength** (slider): 0–60px, higher means foggier (0 = no blur)
- **Custom border** (toggle): outlines the composer when enabled, applying only to the input border
  - "Gradient / Solid" options: both render identically — a translucent solid border generated from "Color 1"
  - "Color 1": main border color; under "Gradient" an extra "Color 2" is shown (reserved; the current solid rendering does not use it)

Pairs best with a gradient or wallpaper from "Background" — the wallpaper shows through the input as a crisp frosted pane.

---

## Notes

- Backgrounds (gradient / wallpaper) apply **within the current session**: re-apply after refreshing the page
- Palette, sidebar, and dialog settings take effect immediately
- Wallpaper videos loop **muted** (browser autoplay policy), so they never interfere

## FAQ

**Q: The background does not change after applying a gradient / wallpaper?**
A: Close the settings panel first — it covers the background. If nothing changes, confirm the plugin run card shows success and re-run it if needed.

**Q: Uploaded videos have no sound?**
A: Due to browser autoplay restrictions, wallpaper videos are always muted.

**Q: The plugin disappeared after switching devices / refreshing?**
A: Dynamically imported plugins are session-scoped; re-import them following "Installation – Method 1" after switching devices or refreshing. For long-term use, ask an administrator to deploy statically via Method 2.

---

## Feedback

Found a problem or have a suggestion? Feel free to open a [GitHub Issue](https://github.com/Mortis-Hope/dsh-appearance-plugin/issues).
