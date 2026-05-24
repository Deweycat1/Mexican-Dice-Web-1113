#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');

function bumpAppJson() {
  if (!fs.existsSync(appJsonPath)) {
    console.error('[ios-buildnumber] app.json not found. If you are using app.config.js/ts, please bump ios.buildNumber manually.');
    process.exit(1);
  }

  let raw;
  try {
    raw = fs.readFileSync(appJsonPath, 'utf8');
  } catch (err) {
    console.error('[ios-buildnumber] Failed to read app.json:', err);
    process.exit(1);
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error('[ios-buildnumber] Failed to parse app.json as JSON:', err);
    process.exit(1);
  }

  if (!json.expo || !json.expo.ios) {
    console.error('[ios-buildnumber] Missing expo.ios configuration in app.json.');
    process.exit(1);
  }

  const current = Number(json.expo.ios.buildNumber || 0);
  if (!Number.isInteger(current) || current < 0) {
    console.error('[ios-buildnumber] expo.ios.buildNumber is not a valid non-negative integer string:', json.expo.ios.buildNumber);
    process.exit(1);
  }

  const next = current + 1;
  json.expo.ios.buildNumber = String(next);

  try {
    fs.writeFileSync(appJsonPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  } catch (err) {
    console.error('[ios-buildnumber] Failed to write updated app.json:', err);
    process.exit(1);
  }

  console.log('[ios-buildnumber] Bumped expo.ios.buildNumber', {
    from: String(current),
    to: String(next),
  });
}

bumpAppJson();
