/**
 * Registers a curated subset of Simple Icons so they resolve as `i-simple-icons:name`.
 * Imported at app startup in main.ts.
 */
import { addCollection } from "@iconify/vue";
import simpleIconsSubset from "./icons-simple-icons.json";

addCollection(simpleIconsSubset);
