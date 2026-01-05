const {
  withAndroidManifest,
  withInfoPlist,
  AndroidConfig,
  ConfigPlugin,
} = require('@expo/config-plugins');

const withRuttlBugTracking = (config, _props = {}) => {
  config = withAndroidManifest(config, (config) => {
    config.modResults = addAndroidPermissions(config.modResults);
    config.modResults = addService(config.modResults);
    return config;
  });

  config = withInfoPlist(config, (config) => {
    config.modResults = updateInfoPlist(config.modResults);
    return config;
  });

  return config;
};

const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.RECORD_AUDIO',
  'android.permission.INTERNET',
];

function addAndroidPermissions(manifest) {
  const uses = manifest.manifest['uses-permission'] || [];
  PERMISSIONS.forEach((name) => {
    if (!uses.some((u) => u.$?.['android:name'] === name)) {
      uses.push({ $: { 'android:name': name } });
    }
  });
  manifest.manifest['uses-permission'] = uses;
  return manifest;
}

function addService(manifest) {
  const application = manifest.manifest.application[0];
  application.service = application.service || [];
  application.service.push({
    $: {
      'android:name': 'expo.modules.mymodule.ScreenRecordService',
      'android:exported': 'false',
    },
  });
  return manifest;
}

function updateInfoPlist(plist) {
  plist.NSMicrophoneUsageDescription =
    plist.NSMicrophoneUsageDescription ||
    'Ruttl needs microphone access to record audio with screen capture.';
  plist.NSPhotoLibraryAddUsageDescription =
    plist.NSPhotoLibraryAddUsageDescription ||
    'Needed to save or export recordings.';
  plist.UIBackgroundModes = plist.UIBackgroundModes || [];
  if (!plist.UIBackgroundModes.includes('audio'))
    plist.UIBackgroundModes.push('audio');
  return plist;
}

module.exports = withRuttlBugTracking;
