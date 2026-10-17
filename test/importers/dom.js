// Node has no DOMParser; XML importers use the platform one in browsers and this one in tests.
import {DOMParser} from '@xmldom/xmldom';

globalThis.DOMParser ??= DOMParser;
