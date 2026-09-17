/**
 * Google Maps universal link (Maps URL API — "Get directions" action).
 *
 * - No API key, no SDK, no billing: this is Google's documented universal
 *   link mechanism (developers.google.com/maps/documentation/urls/get-started).
 * - Opens the Google Maps app when installed; falls back to the browser.
 * - The destination is built ONLY from the authoritative, owner-confirmed
 *   HUNTER_LOCATION constant — never from user input or hardcoded literals.
 *
 * This is the single customer navigation handoff (How to Reach Us section).
 */
import { HUNTER_LOCATION } from './hunterLocation';

const params = new URLSearchParams({
  api: '1',
  destination: `${HUNTER_LOCATION.latitude},${HUNTER_LOCATION.longitude}`,
});

export const GOOGLE_MAPS_DIRECTIONS_UNIVERSAL_URL = `https://www.google.com/maps/dir/?${params.toString()}`;
