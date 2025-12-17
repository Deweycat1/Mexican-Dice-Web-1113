#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');

function bumpAppJson() {
  if (!fs.existsSync(appJsonPath)) {
    console.error('[android-versioncode] app.json not found. If you are using app.config.js/ts, please bump android.versionCode manually.');
    process.exit(1);
  }

  let raw;
  try {
    raw = fs.readFileSync(appJsonPath, 'utf8');
  } catch (err) {
    console.error('[android-versioncode] Failed to read app.json:', err);
    process.exit(1);
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error('[android-versioncode] Failed to parse app.json as JSON:', err);
    process.exit(1);
  }

  if (!json.expo || !json.expo.android) {
    console.error('[android-versioncode] Missing expo.android configuration in app.json.');
    process.exit(1);
  }

  const current = Number(json.expo.android.versionCode || 0);
  if (!Number.isInteger(current) || current < 0) {
    console.error('[android-versioncode] expo.android.versionCode is not a valid non-negative integer:', json.expo.android.versionCode);
    process.exit(1);
  }

  const next = current + 1;
  json.expo.android.versionCode = next;

  try {
    fs.writeFileSync(appJsonPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  } catch (err) {
    console.error('[android-versioncode] Failed to write updated app.json:', err);
    process.exit(1);
  }

  console.log('[android-versioncode] Bumped expo.android.versionCode', {
    from: current,
    to: next,
  });
}

bumpAppJson();

