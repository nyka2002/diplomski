// Source registry. Add a new public source by writing an adapter with the same
// shape ({ key, baseUrl, collect(browser, opts) → raw[] }) and listing it here.
import { njuskalo } from "./njuskalo.mjs";
import { indexhr } from "./indexhr.mjs";
import { oglasnik } from "./oglasnik.mjs";

export const SOURCES = { njuskalo, index: indexhr, oglasnik };
export const SOURCE_KEYS = Object.keys(SOURCES);
