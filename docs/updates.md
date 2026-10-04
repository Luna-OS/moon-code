# Updates

Moon Code updates itself from its GitHub releases with
[electron-updater](https://www.electron.build/auto-update) (`electron/updater.cjs`):

1. The release workflow builds the installer with `build.publish` set to this repository, which
   makes electron-builder write `latest.yml` (version, file name, SHA-512) and the installer's
   `.blockmap`. Both are uploaded to the release next to the installer and the ZIP.
2. Moon Code reads `latest.yml` of the newest release – a few seconds after every start, and on
   "Check for updates" in Settings → Updates. Nothing is downloaded until you click "Download".
3. The installer downloads in the background (with the blockmap only the changed parts when it
   can), its SHA-512 is checked, and "Restart and update" closes Moon Code, installs it quietly
   and starts the new version. An update you downloaded but didn't install goes in when you quit.

Notes:

- The portable ZIP can check for updates, but installing one uses the installer.
- In development (`npm run app`) updates are switched off: there is no installed app to update.
- The repository is public, so no token is needed to read the releases.
- 0.1.0 has no updater yet: install 0.2.0 by hand once.
