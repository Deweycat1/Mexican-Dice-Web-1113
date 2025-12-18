## Versioning Policy

- **Android**: Every Google Play Store upload must increase `expo.android.versionCode` by at least **1**.
- **iOS**: Every App Store Connect upload must increase `expo.ios.buildNumber` by at least **1**.
- **Marketing version**: `expo.version` is the user‑facing marketing version. Change it only when you want the visible app version to change.

When in doubt, bump both `expo.android.versionCode` and `expo.ios.buildNumber` by **+1** for each store submission.

## Release Workflow

1. Run a preflight check:
   - `npm run version:check`
2. Bump native store counters:
   - `expo.android.versionCode += 1`
   - `expo.ios.buildNumber += 1`
3. Run the preflight check again:
   - `npm run version:check`
4. Build for release:
   - Android: `eas build --platform android`
   - iOS: `eas build --platform ios`

