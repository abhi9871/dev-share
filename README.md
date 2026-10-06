# DevShare

DevShare lets developers quickly send text, code snippets, logs, screenshots, and files to a
configured destination (initially a Discord channel) without switching applications.

```sh
devshare --file screenshot.png "Login fails after token refresh, see screenshot"
# Shared message and 1 file to backend.
```

> **Status: early development.** The `devshare` command-line tool works today, and the desktop
> app can share messages, files, and clipboard content from the system tray (see
> [Desktop app](#desktop-app)). The `Ctrl+Shift+A` shortcut and a settings screen are on the
> [roadmap](#roadmap).

## Why

While working in Claude Code, VS Code, a terminal, or a browser, you often need to send someone
an error, a log, a screenshot, or a file. That usually means opening a chat app, finding the
right person or channel, attaching the content, sending it, and switching back.

DevShare turns that into one step from wherever you already are:

> If you can copy or select it on Windows, DevShare should make it easy to share it.

## Features

**Available now**

- `devshare` CLI: share a message, one or more files, or both together as a single share
- Desktop app: opens with your copied text and image ready to share; add a message and files,
  pick a destination, and share
- Multiple named destinations (for example _general_, _backend_, _bugs_) with a default
- Discord webhook delivery: text and all attachments arrive as one message
- Secrets stay local: webhook URLs live in environment variables or a local `.env` file, never in
  the config file or this repository
- Clear, specific error messages that never print webhook URLs

**Planned** — see the [roadmap](#roadmap): global shortcut, settings UI, Explorer integration,
Claude Code `/share`.

### Supported content

| Content                                   | How to share it today          |
| ----------------------------------------- | ------------------------------ |
| Text, errors, Claude responses, URLs      | `devshare "message"`           |
| Any file: source code, logs, images, PDFs | `devshare --file path`         |
| Several related items together            | Repeat `--file`, add a message |
| Copied clipboard content, screenshots     | Desktop app                    |

Discord-specific behavior:

- Messages longer than Discord's 2000-character limit are sent as an attached `message.txt`, so
  long logs and code arrive intact.
- A share can have at most 10 attachments (Discord's per-message limit).
- File size limits are set by the Discord server (they depend on its boost level). DevShare
  reports a clear error if Discord rejects a file as too large.
- Mentions are disabled: text such as `@everyone` in a pasted log never pings anyone.

## What DevShare does not do

- It does not automate WhatsApp or any other app's web UI.
- It does not store your data in a cloud database, and there is no DevShare backend or account.
- It is not tied to Discord: Discord is the first transport, behind a generic transport interface.
- It never puts secrets in the repository: your configuration and webhook URLs stay on your
  machine.

## Requirements

- Windows 10 or 11 (the supported platform; CI runs on Windows)
- [Node.js](https://nodejs.org/) 22.12 or later, with npm
- A Discord server where you can create webhooks (Manage Webhooks permission)

## Installation

DevShare is not published to npm yet. Install it from source:

```sh
git clone https://github.com/abhi9871/dev-share.git
cd dev-share
npm install
npm run build
```

Then make the `devshare` command available everywhere:

```sh
cd packages/cli
npm link
```

`npm link` adds a `devshare` command to your global npm folder (on Windows,
`%APPDATA%\npm\devshare.cmd`). To remove it later, run `npm unlink -g @devshare/cli`.

To try DevShare without linking, run it from the repository root instead:

```sh
npm run devshare -- "Please check this"
```

## Configuration

DevShare reads two local files, both kept **outside** any repository:

| File          | Default location (Windows)       | Contains                                     |
| ------------- | -------------------------------- | -------------------------------------------- |
| `config.json` | `%APPDATA%\DevShare\config.json` | Destination names and types. **No secrets.** |
| `.env`        | `%APPDATA%\DevShare\.env`        | Webhook URLs (secrets). Optional, see below. |

Set the `DEVSHARE_CONFIG` environment variable to use a different config file; the `.env` file is
always read from the same folder as the config file.

### 1. Create a Discord webhook

For each channel you want to share to:

1. In Discord, open the channel's **Edit Channel** settings (or **Server Settings**).
2. Go to **Integrations → Webhooks → New Webhook**, and choose the channel.
3. Click **Copy Webhook URL**.

Treat the webhook URL like a password: anyone who has it can post to that channel.

### 2. Create `config.json`

In PowerShell:

```powershell
New-Item -ItemType Directory -Force "$env:APPDATA\DevShare"
notepad "$env:APPDATA\DevShare\config.json"
```

Add your destinations:

```json
{
  "defaultDestination": "general",
  "destinations": [
    { "name": "general", "type": "discord", "webhookEnv": "DEVSHARE_GENERAL_WEBHOOK" },
    { "name": "backend", "type": "discord", "webhookEnv": "DEVSHARE_BACKEND_WEBHOOK" }
  ]
}
```

| Setting                     | Required | Meaning                                                                     |
| --------------------------- | -------- | --------------------------------------------------------------------------- |
| `destinations`              | Yes      | Non-empty list of destinations.                                             |
| `destinations[].name`       | Yes      | Your name for the destination; unique, case-insensitive.                    |
| `destinations[].type`       | Yes      | Transport to use. Currently only `discord`.                                 |
| `destinations[].webhookEnv` | Discord  | Name of the environment variable that holds this destination's webhook URL. |
| `defaultDestination`        | No       | Destination used when you don't pass `--destination`.                       |

If there is only one destination, it is used by default.

### 3. Provide the webhook URLs

Either create `%APPDATA%\DevShare\.env` (use [`.env.example`](.env.example) as a template):

```sh
DEVSHARE_GENERAL_WEBHOOK=<your general channel webhook URL>
DEVSHARE_BACKEND_WEBHOOK=<your backend channel webhook URL>
```

or set them as user environment variables:

```powershell
[Environment]::SetEnvironmentVariable('DEVSHARE_GENERAL_WEBHOOK', '<webhook URL>', 'User')
```

Environment variables take precedence over the `.env` file. Open a new terminal after changing
user environment variables.

## Usage

```text
Usage: devshare [options] [message...]

Options:
  -f, --file <path>          Attach a file (repeat for multiple files)
  -d, --destination <name>   Destination to share to (default: from your config)
  -h, --help                 Show this help
  -v, --version              Show the version
```

### Examples

```sh
# Share a message to the default destination
devshare "Please check this authentication issue"

# Share a file
devshare --file publicClient.ts

# Share a screenshot with a message
devshare --file screenshot.png "Please check this screenshot"

# Share several files together, as one message
devshare --file auth.ts --file publicClient.ts "Please review these"

# Share to a specific destination
devshare --destination backend "Please test this"
```

Quote messages that contain shell special characters. Unquoted words are joined with spaces, so
`devshare please check this` also works.

### Exit codes

| Code | Meaning                                                              |
| ---- | -------------------------------------------------------------------- |
| `0`  | Shared successfully                                                  |
| `1`  | Share failed (missing file, configuration problem, network, Discord) |
| `2`  | Invalid command-line usage                                           |

### Example workflow

You hit an error in Claude Code: _"Authentication fails after token refresh."_

1. Take a screenshot with `Win+Shift+S` and save it as `screenshot.png`.
2. Run `devshare -d backend --file screenshot.png "Authentication fails after token refresh"`.
3. Your teammates see the message and screenshot together in the backend channel.

With the desktop app: copy, open DevShare, pick _backend_, check the preview, **Share**. The
planned `Ctrl+Shift+A` shortcut will replace opening the app.

## Desktop app

> **In development.** The desktop app shares messages, files, and clipboard content. The
> `Ctrl+Shift+A` shortcut and a settings screen come next.

When the app opens, whatever you copied is ready to share: copied text fills the message box,
and a copied image or screenshot (for example from `Win+Shift+S`) is attached as a PNG with a
preview. Nothing is sent until you press **Share**. **Paste from clipboard** adds the current
clipboard content again, for example after copying something else.

Pick a destination, edit the message, add files with **Add files…**, remove anything you do
not want to send, and press **Share** (or `Ctrl+Enter` in the message box). Each file can be up to 25 MB; the destination
may set a lower limit (Discord allows 10 attachments per message, and its upload size limit
depends on the server).

DevShare keeps running in the system tray: closing the window hides it, and clicking the tray
icon (or choosing **Open DevShare** from its menu) brings it back with your draft intact.
Starting DevShare again while it is running also brings up the existing window. To exit,
choose **Quit DevShare** from the tray icon's menu.

The desktop app uses the same core library, `config.json`, and `.env` as the CLI; there is
nothing extra to configure. From the repository root:

```sh
npm run desktop       # build and start the app
npm run desktop:dev   # start with live reload while developing the UI
```

The first start downloads the Electron runtime (about 100 MB) into `node_modules`. If your
organization blocks unsigned executables, the CLI remains fully usable.

## Security

- **Secrets stay local.** `config.json` only names environment variables; webhook URLs live in
  your environment or in `%APPDATA%\DevShare\.env`, outside any repository.
- **No secrets in output.** Error messages name the environment variable involved, never its
  value, and network errors are reported without the request URL.
- **Webhook URLs are validated** to be HTTPS Discord webhook URLs before anything is sent, which
  catches pasting the wrong URL.
- **No mentions.** Shared text cannot ping `@everyone`, roles, or users.
- **No backend.** DevShare sends directly from your machine to the destination; nothing passes
  through a DevShare server.
- **Locked-down desktop UI.** The desktop window runs with context isolation, sandboxing, and
  no Node.js access, under a strict Content Security Policy; it cannot navigate away or open
  other windows. It talks to the main process only through a small typed API, and never
  receives webhook URLs or destination settings. Files are chosen in a native dialog and read
  by the main process; the window refers to them only by opaque IDs, so it can never ask
  DevShare to read a path of its choosing.
- **Repository hygiene.** `.gitignore` excludes `.env` files. Never commit real webhook URLs,
  tokens, or other secrets in code, tests, issues, or examples.

If a webhook URL is ever exposed, delete the webhook in Discord and create a new one.

To report a security vulnerability in DevShare, see [SECURITY.md](SECURITY.md); please do not
open a public issue.

## Architecture

DevShare is an npm workspace with one source of truth for sharing logic:

```text
packages/
  core/   @devshare/core: payload model, validation, configuration, sharing service,
          transports (Discord). No runtime dependencies.
  cli/    @devshare/cli: the devshare command. Parses arguments and calls core.
  desktop/ @devshare/desktop: Electron app.
          src/main/      privileged main process: window, security, IPC handlers (uses core)
          src/preload/   exposes the typed window.devshare API to the renderer
          src/shared/    IPC contract shared by main, preload, and renderer
          src/renderer/  React UI; browser APIs only, no Node.js
```

A share flows through the same pipeline regardless of interface:

```text
CLI or desktop main process
  → createSharePayload()          validated text + attachments
  → SharingService.share()        resolves the destination from config.json
  → TransportFactory for its type validates settings, reads the secret
  → Discord transport             one webhook message
```

Interfaces never talk to Discord directly. New transports implement the `TransportFactory`
interface in `packages/core/src/transports/` without changes to the CLI or desktop app.

## Development

```sh
npm install
npm run build
```

| Command                      | Purpose                                            |
| ---------------------------- | -------------------------------------------------- |
| `npm run build`              | Build all packages (core, CLI, desktop)            |
| `npm run devshare -- <args>` | Run the built CLI from the repository              |
| `npm run desktop`            | Build and start the desktop app                    |
| `npm run desktop:dev`        | Start the desktop app with live reload             |
| `npm run typecheck`          | Type-check all packages, tests, and tooling config |
| `npm run lint`               | Lint with ESLint (type-aware)                      |
| `npm run format`             | Format with Prettier                               |
| `npm run format:check`       | Verify formatting without changing files           |
| `npm test`                   | Run the test suite once                            |
| `npm run test:watch`         | Run tests in watch mode                            |
| `npm run check`              | Run format:check, lint, typecheck, test, and build |

Rebuild (`npm run build`) after changing source before using the `devshare` command.

### Testing

Tests use [Vitest](https://vitest.dev/) and live in `packages/*/tests/`. They cover behavior:
payload validation, configuration, destination selection, the sharing service, the Discord
transport, CLI argument handling, and the desktop app's main process (IPC request validation,
attachment and clipboard handling, and sharing). Network access is always faked; tests never contact a real
webhook. Tests and type-checking run against package sources directly, so no build is needed
first.

CI runs `npm run check` on Windows with Node.js 22 and 24 for every pull request.

## Roadmap

| Status    | Feature                                                         |
| --------- | --------------------------------------------------------------- |
| Available | Core library: payload model, configuration, sharing service     |
| Available | Discord webhook transport                                       |
| Available | `devshare` CLI for sharing text and files                       |
| Available | Desktop app shell: secure window, typed IPC, destination picker |
| Available | Desktop: compose and share messages and files                   |
| Available | Desktop: clipboard detection (text, screenshots) with preview   |
| Available | Desktop: runs in the system tray                                |
| Next      | Desktop: global shortcut (`Ctrl+Shift+A`)                       |
| Next      | Desktop: settings (destinations, webhooks, preferences)         |
| Planned   | Windows Explorer "Share with DevShare"                          |
| Planned   | Claude Code `/share` integration                                |
| Planned   | Additional transports (for example Slack)                       |

## Contributing

Issues and pull requests are welcome. Please:

- run `npm run check` before opening a pull request;
- keep sharing logic in `@devshare/core` so every interface reuses it;
- never include real webhook URLs, tokens, or other secrets in code, tests, or examples.

## License

[MIT](LICENSE)
