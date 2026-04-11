# Reviewer Notes

## Single Purpose

betterXplayer improves long-form video playback on X by:

- temporarily switching to `2x` while the pointer is held on the video
- keeping unfinished long videos in a compact popup so they can be reopened later

## Test Steps

1. Sign in to `x.com` or open a public post containing a video that is at least 60 seconds long.
2. Start playback and press-and-hold on the video surface for about 180ms.
3. Confirm playback changes to `2x` only while held, and returns to the previous speed on release.
4. Watch part of the video, refresh the page, and confirm the popup lists it as unfinished.
5. Watch past roughly 30 seconds total, reload the same post, and confirm playback resumes near the saved position.
6. Delete the entry from the popup and confirm it disappears from the unfinished list.

## Permissions

- `storage`: saves unfinished-video progress locally
- host access for `x.com` and `twitter.com`: needed to detect X video elements and restore progress on those pages

## Data Handling

- The extension stores data locally only.
- No remote scripts, analytics, or external APIs are used.
