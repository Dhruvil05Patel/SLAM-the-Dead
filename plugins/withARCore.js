const { withAndroidManifest, withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to integrate ARCore native module
 * 
 * This plugin:
 * 1. Adds ARCore permissions to AndroidManifest.xml
 * 2. Adds ARCore dependency to build.gradle
 * 3. Registers the ARCoreModule package
 */
const withARCore = (config) => {
  // Add ARCore manifest entries
  config = withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;

    // Ensure application exists
    if (!manifest.application) {
      manifest.application = [{}];
    }

    // Add AR_REQUIRED metadata
    const application = manifest.application[0];
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    // Check if already exists
    const hasArMetadata = application['meta-data'].some(
      (meta) => meta.$?.['android:name'] === 'com.google.ar.core'
    );

    if (!hasArMetadata) {
      application['meta-data'].push({
        $: {
          'android:name': 'com.google.ar.core',
          'android:value': 'optional', // Use 'required' if ARCore is mandatory
        },
      });
    }

    // Add AR camera feature
    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }

    const hasArFeature = manifest['uses-feature'].some(
      (feature) => feature.$?.['android:name'] === 'android.hardware.camera.ar'
    );

    if (!hasArFeature) {
      manifest['uses-feature'].push({
        $: {
          'android:name': 'android.hardware.camera.ar',
          'android:required': 'false', // Optional - fallback to simulation if not available
        },
      });
    }

    return config;
  });

  // Add ARCore dependency to build.gradle
  config = withAppBuildGradle(config, (config) => {
    const { modResults } = config;
    let gradle = modResults.contents;

    // Add ARCore dependency if not already present
    if (!gradle.includes('com.google.ar:core')) {
      const dependenciesRegex = /dependencies\s*{/;
      gradle = gradle.replace(
        dependenciesRegex,
        `dependencies {
    // ARCore for SLAM tracking
    implementation 'com.google.ar:core:1.40.0'`
      );
      modResults.contents = gradle;
    }

    return config;
  });

  return config;
};

module.exports = withARCore;
