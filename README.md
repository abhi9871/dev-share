# DevShare

DevShare lets developers quickly send copied text, code snippets, logs, screenshots, and files
to a configured destination (initially Discord) without repeatedly switching applications.

> **Status: early development. DevShare is not usable yet.**
> This repository currently contains the project tooling and the core payload model only.
> The sections below describe what exists today; everything else is on the [roadmap](#roadmap).

## Why

While working in Claude Code, VS Code, a terminal, or a browser, you often need to send someone
an error, a log, a screenshot, or a file. Doing that usually means opening a chat app, finding the
right person or channel, attaching the content, sending it, and switching back. DevShare aims to
make this a single, fast step:

> If you can copy or select it on Windows, DevShare should make it easy to share it.

## What DevShare does not do

- It does not automate WhatsApp or any other app's web UI.
- It does not store your data in a cloud database, and it has no DevShare backend.
- Discord is only the first delivery mechanism; DevShare itself is not tied to Discord.
- Secrets such as webhook URLs stay on your machine and are never committed to this repository.

## Roadmap

| Status    | Feature                                                                    |
| --------- | -------------------------------------------------------------------------- |
| Available | Core payload model: text plus multiple attachments, validated as one share |
| Available | Reading files from disk as attachments                                     |
| Next      | Local destination configuration (secrets kept in environment variables)    |
| Next      | Discord webhook transport                                                  |
| Next      | `devshare` CLI for sharing text and files                                  |
| Planned   | Desktop app (Electron): clipboard detection, preview, destination picker   |
| Planned   | System tray and global shortcut (`Ctrl+Shift+A`)                           |
| Planned   | Windows Explorer "Share with DevShare"                                     |
| Planned   | Claude Code `/share` integration                                           |

## Architecture

DevShare is an npm workspace. All sharing logic lives in one reusable core package; the CLI and
the planned desktop app are thin interfaces on top of it.

```
packages/
  core/   Domain model and sharing logic (no runtime dependencies)
```

## Development

### Requirements

- Node.js 22.12 or later
- npm

### Setup

```sh
git clone https://github.com/abhi9871/dev-share.git
cd dev-share
npm install
```

### Scripts

| Command                | Purpose                                            |
| ---------------------- | -------------------------------------------------- |
| `npm run build`        | Compile all packages to `dist/`                    |
| `npm run typecheck`    | Type-check all packages and tooling config         |
| `npm run lint`         | Lint with ESLint (type-aware)                      |
| `npm run format`       | Format with Prettier                               |
| `npm run format:check` | Verify formatting without changing files           |
| `npm test`             | Run the test suite once                            |
| `npm run test:watch`   | Run tests in watch mode                            |
| `npm run check`        | Run format:check, lint, typecheck, test, and build |

CI runs `npm run check` on Windows with Node.js 22 and 24 for every pull request.

## Contributing

Issues and pull requests are welcome. Please run `npm run check` before opening a pull request,
and never include real webhook URLs, tokens, or other secrets in code, tests, or examples.

## License

[MIT](LICENSE)
