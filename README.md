<p align="center">
  <img src="media/hero.png" alt="Lazyboy" width="400">
</p>

An AI assistant that lives in your browser sidebar. Built for collaboration, not autonomy theater. You guide, it executes.

Lazyboy automates repetitive web tasks, extracts data from any website, navigates across pages, fills out forms, compares products, compiles research, and transforms findings into documents, spreadsheets, or whatever you need. It works on any website through a Chrome/Edge side panel, using the AI provider of your choice.

Bring your own API key or log in with an existing subscription (Anthropic Claude, OpenAI/ChatGPT, GitHub Copilot, Google Gemini). Your data stays on your machine. Nothing is collected or tracked.

## Download & Install

Download from the [GitHub releases page](https://github.com/slothmc-ctrl/lazyboy/releases) and load the unpacked extension in Chrome or Edge.

Requires Chrome 141+ or Edge equivalent.

## Development

Clone this repo and install dependencies:

```bash
git clone https://github.com/slothmc-ctrl/lazyboy.git
cd lazyboy
npm install
```

`npm install` sets up the Husky pre-commit hook automatically.

Start all dev watchers (lazyboy extension, marketing site):

```bash
./dev.sh
```

To run only the extension watcher without the marketing site:

```bash
npm run dev
```

### Loading the extension

1. Open `chrome://extensions/` or `edge://extensions/`
2. Enable Developer mode
3. Click Load unpacked
4. Select `lazyboy/dist-chrome/`
5. Click "Details" on the Lazyboy extension and enable:
   - **Allow user scripts**
   - **Allow access to file URLs**

The extension hot-reloads when the dev watcher rebuilds.

### First run

On first launch, Lazyboy prompts you to connect at least one AI provider. You can log in with a subscription or enter an API key.

Some subscription logins require the CORS proxy (configurable in Settings > Proxy). The default proxy is `https://proxy.mariozechner.at/proxy`.

## Checks

```bash
./check.sh
```

Runs formatting, linting, and type checking for the extension and the `site/` subproject.

The Husky pre-commit hook runs the same checks before each commit.

## Building

```bash
npm run build
```

The unpacked extension is written to `dist-chrome/`.

## Updating the website

The landing page is hosted on GitHub Pages. Push to `main` (with changes under `site/`) and the GitHub Actions workflow deploys automatically.

To preview locally:

```bash
cd site && ./run.sh dev
```

Opens a dev server at `http://localhost:8080`.

## Releasing

```bash
./release.sh patch   # 1.0.0 -> 1.0.1
./release.sh minor   # 1.0.0 -> 1.1.0
./release.sh major   # 1.0.0 -> 2.0.0
```

Bumps the version in `static/manifest.chrome.json`, commits, tags, and pushes. GitHub Actions builds the extension and creates a release at [github.com/slothmc-ctrl/lazyboy/releases](https://github.com/slothmc-ctrl/lazyboy/releases).

## License

AGPL-3.0. See [LICENSE](LICENSE).
