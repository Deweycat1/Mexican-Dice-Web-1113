#!/usr/bin/env node

function fail(message) {
  console.error(`[version-preflight] ${message}`);
  process.exit(1);
}

function runExpoConfig() {
  try {
    // Use the same resolver that powers `expo config --type public`.
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

  const ios = config.ios || {};
  const android = config.android || {};

  const buildNumber = ios.buildNumber;
  const versionCode = android.versionCode;

  if (buildNumber == null) {
    fail('ios.buildNumber is missing in resolved Expo config.');
  }

  if (typeof buildNumber !== 'string' || !/^[0-9]+$/.test(buildNumber)) {
    fail(
      `ios.buildNumber must be a string of digits (e.g., "1", "2", ...). Got: ${JSON.stringify(
        buildNumber
      )}`
    );
  }

  if (versionCode == null) {
    fail('android.versionCode is missing in resolved Expo config.');
  }

  if (!Number.isInteger(versionCode) || versionCode <= 0) {
    fail(
      `android.versionCode must be a positive integer. Got: ${JSON.stringify(versionCode)}`
    );
  }

  console.log(
    `[version-preflight] OK - ios.buildNumber=${buildNumber}, android.versionCode=${versionCode}`
  );
}

main();
