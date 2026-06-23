// Source registry. Add a new public source by writing an adapter with the same
// shape ({ key, baseUrl, collect(browser, opts) → raw[] }) and listing it here.
import { njuskalo } from "./njuskalo.mjs";
import { indexhr } from "./indexhr.mjs";

export const SOURCES = { njuskalo, index: indexhr };
export const SOURCE_KEYS = Object.keys(SOURCES);
