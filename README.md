# BSA Coaches

The coaches' web app for Brazilian Skills Academy Cape Town. Static site on GitHub Pages,
installable on a phone home screen (Share, Add to Home Screen).

- `index.html` home screen with one tile per tool.
- `attendance.html` one button per venue, opening that venue's live attendance workbook in SharePoint.
- `links.enc.json` the venue sheet links, encrypted with the coach password (PBKDF2-SHA256, AES-256-GCM).
  The plain links and the password live only in `~/.bsa_secrets/` on the Mac mini, never in this repo.

## Change a link, add a venue, or change the coach password

1. Edit `~/.bsa_secrets/coach_app_links.json` (or `coach_app_password.txt`).
2. `node tools/encrypt_links.mjs` then `node tools/encrypt_links.mjs --check`.
3. Commit and push `links.enc.json`. Phones pick it up on next open; after a password change each coach types the new one once.

## Gotchas

- Never commit a plain sheet link, a child's name, a phone number or any export. Anyone with a sheet link can edit it.
- The Data Center Graph app is read-only, so share links are created by hand in OneDrive (Share, Anyone with the link, Can edit).
- A new venue needs a button in `attendance.html` with a `data-key` matching the key in the links file.
