#!/usr/bin/env node

const MIN_VERSION_CODE = 100;
const FORBIDDEN_VERSION_CODES = new Set([19]);

function fail(message) {
  console.error(`[android-versioncode:check] ${message}`);
  process.exit(1);
}

function runExpoConfig() {
  try {
    // Use Expo's config reader to get the resolved public config.
    // This mirrors what `expo config --type public` would output.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { getConfig } = require('@expo/config');
    const projectRoot = process.cwd();
    const { exp } = getConfig(projectRoot, { isPublicConfig: true });
    return exp;
  } catch (error) {
    fail(`Failed to load Expo config via @expo/config: ${error.message}`);
  }
}

function main() {
  const config = runExpoConfig();

  if (!config.android) {
    fail('Resolved Expo config is missing "android" section.');
  }

  const versionCode = config.android.versionCode;

  if (versionCode == null) {
    fail('android.versionCode is missing from resolved Expo config.');
  }

  if (!Number.isInteger(versionCode)) {
    fail(`android.versionCode must be an integer. Got: ${JSON.stringify(versionCode)}`);
  }

  if (FORBIDDEN_VERSION_CODES.has(versionCode)) {
    fail(
      `android.versionCode is ${versionCode}, which is explicitly disallowed (e.g., already used on Google Play).`
    );
  }

  if (versionCode < MIN_VERSION_CODE) {
    fail(
      `android.versionCode is ${versionCode}, which is less than the minimum allowed (${MIN_VERSION_CODE}).`
    );
  }

  console.log(
    `[android-versioncode:check] OK - resolved android.versionCode = ${versionCode} (>= ${MIN_VERSION_CODE})`
  );
}

main();
