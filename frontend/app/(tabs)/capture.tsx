import { Redirect } from 'expo-router';
import React from 'react';

/** Placeholder route: the tab bar renders a capture button instead of navigating here. */
export default function CaptureTabPlaceholder() {
  return <Redirect href="/(tabs)" />;
}
