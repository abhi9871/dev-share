# Security policy

## Reporting a vulnerability

Please **do not** report security issues in public GitHub issues, discussions, or pull requests.

Report them privately through GitHub instead:
[**Report a vulnerability**](https://github.com/abhi9871/dev-share/security/advisories/new)
(the repository's **Security** tab → **Report a vulnerability**).

Include what you found, how to reproduce it, and its impact. You can expect an initial response
within a week. DevShare is maintained by one person in their spare time, so fixes are made on a
best-effort basis.

Never include a real webhook URL, token, or other secret in a report. If you accidentally exposed
your own Discord webhook URL, delete that webhook in Discord and create a new one; that
invalidates the old URL immediately.

## Supported versions

DevShare is in early development and has no releases yet. Only the latest code on `main` is
supported.

## Scope

In scope: anything in this repository that could expose secrets (for example webhook URLs in
output, logs, or errors), send content somewhere other than the configured destination, or let
shared content trigger unintended behavior at the destination.

Out of scope: vulnerabilities in Discord itself or in third-party dependencies (please report
those upstream), and issues that require an attacker to already control your machine or your
local DevShare configuration files.
