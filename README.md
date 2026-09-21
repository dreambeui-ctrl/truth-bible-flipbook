# Truth Bible Flipbook

A polished, responsive digital edition of the 2026 Truth Bible. Desktop readers get a tactile two-page spread; phones get a focused single-page experience.

## GitHub Pages

This repository is configured to publish the flipbook through GitHub Pages at:

`https://dreambeui-ctrl.github.io/truth-bible-flipbook/`

QR assets are added only after the production deployment has been verified.

## Reader features

- realistic page turns with mouse, touch, and swipe support
- responsive desktop spreads and mobile portrait pages
- previous/next controls and left/right keyboard navigation
- a scrollable 100–250% zoom view
- fullscreen reading mode
- lazy page hydration, loading progress, and graceful fallbacks
- accessible labels, live status updates, and visible keyboard focus

## Local development

This project requires Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Publication assets

The browser receives 46 pre-rendered WebP pages rather than the original PDF. The source PDF is not stored in this repository.

To rebuild the page assets from a revised PDF, install Poppler (`pdftoppm`) and run:

```bash
pnpm render:publication /absolute/path/to/publication.pdf
```

The renderer records only public page dimensions and page paths in `public/publication/manifest.json`.

## Verification

```bash
pnpm exec tsc --noEmit
pnpm lint
PAGES_BASE_PATH=/truth-bible-flipbook/ pnpm build:static
```
