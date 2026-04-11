# Publishing Checklist

## Chrome Web Store

- Upload `dist/betterXplayer-chrome.zip`
- Keep `manifest.json` at the archive root
- Keep the listing description and permission disclosure accurate
- Use the final store assets in [docs/store-assets](./store-assets) for screenshots and promo images
- Confirm the package contains no remote code, obfuscation, or unnecessary permissions

Official references:

- https://developer.chrome.com/docs/webstore/prepare
- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/program-policies/policies
- https://developer.chrome.com/docs/extensions/reference/manifest

## Firefox Add-ons

- Upload `dist/betterXplayer-firefox.xpi`
- Keep `browser_specific_settings.gecko.id` in the manifest for signing/distribution
- Declare built-in data consent as `none` if no user data leaves the device
- Include reviewer notes if testing requires an X account or specific playback steps
- Keep the source readable and avoid minified or obfuscated bundles

Official references:

- https://extensionworkshop.com/documentation/publish/package-your-extension/
- https://extensionworkshop.com/documentation/publish/submitting-an-add-on/
- https://extensionworkshop.com/documentation/publish/add-on-policies/
- https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings
