/**
 * Hunter Autoworks — single authoritative frontend destination definition.
 *
 * Owner-confirmed on 2026-09-16 via Google Maps Plus Code 6G5X67C8+C35
 * (decoded with the Open Location Code reference implementation and proven by
 * strict round-trip: encode(decode(code), 11) === code, ~3.5 m cell).
 *
 * The previously displayed coordinate was verified ~892 m off site and must
 * never be reintroduced anywhere in the codebase.
 *
 * The server-side directions endpoint imports this same constant, so the
 * routing destination is always server-authoritative — the browser can never
 * supply its own destination.
 *
 * Customer navigation handoff: src/lib/googleMaps.ts builds the universal
 * Google Maps directions URL from this same authoritative constant.
 */
export const HUNTER_LOCATION = {
  latitude: -6.7789875,
  longitude: 39.265234375,
  plusCode: '6G5X67C8+C35',
  address: '3, Kwamsama, Morocco, Kinondoni, Dar es Salaam, Tanzania',
} as const;
