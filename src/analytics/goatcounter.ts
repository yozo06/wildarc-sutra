// Adapter for GoatCounter (https://www.goatcounter.com), an open-source counter
// with a free hosted plan. A hit becomes one GET of a 1x1 image:
//   https://<code>.goatcounter.com/count?p=<event name>&e=true&rnd=<anything>
// Parameters are documented at https://www.goatcounter.com/help/pixel and are stable.
// To use another backend, write another function like this one.
import type { Hit } from './index.js';

/** The counting endpoint for a GoatCounter site code, e.g. 'lets' -> https://lets.goatcounter.com/count */
export const goatcounterEndpoint = (code: string): string => `https://${code}.goatcounter.com/count`;

/** The URL that records one hit. `nonce` only defeats caches; any short text will do. */
export const goatcounterUrl = (endpoint: string, hit: Hit, nonce: string): string =>
  `${endpoint}?p=${encodeURIComponent(hit.name)}&t=${encodeURIComponent(hit.name)}&e=true&rnd=${encodeURIComponent(nonce)}`;
