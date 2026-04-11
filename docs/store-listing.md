# Store Listing Draft

## Short Description

Hold X videos for instant `2x` playback and keep unfinished long videos easy to resume.

## Full Description

betterXplayer keeps X video playback simple.

Press and hold on a long video to temporarily watch at `2x`, then release to return to the previous speed. The extension also keeps track of unfinished long-form videos, so you can reopen them from a compact popup and continue where you left off after a real watch session.

What it does:

- hold on long X videos for temporary `2x` playback
- save unfinished videos locally in the browser
- resume only for long-form videos after meaningful watch time
- keep the popup focused on unfinished videos only

What it does not do:

- no accounts or sign-in flow
- no remote sync service
- no analytics or ads
- no checkpoint tags, notes, or extra clutter

## Privacy Answers

- Data sold: `No`
- Data shared with third parties: `No`
- Data collected outside the device: `No`
- Data stored locally: unfinished-video progress and related post metadata only

For Firefox's built-in consent flow, the expected declaration is `none` because the add-on does not send user data off-device.

## Submission Notes

- Reviewer steps: see [reviewer-notes.md](./reviewer-notes.md)
- Privacy statement: see [../PRIVACY.md](../PRIVACY.md)
- Build packages with `powershell -ExecutionPolicy Bypass -File .\\scripts\\package.ps1`

## Asset Checklist

- Replace [player placeholder](./assets/readme-player-placeholder.svg) with a real screenshot of the in-player `2x` overlay
- Replace [popup placeholder](./assets/readme-popup-placeholder.svg) with a real screenshot of the popup list
- Export [Chrome promo template](./assets/chrome-promo-placeholder.svg) to a store-ready PNG before Chrome submission
