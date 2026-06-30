export const ARABIC_FONT_OPTIONS = [
  {
    id: 'kfgqpc-hafs',
    name: 'KFGQPC Hafs',
    family: "'KFGQPC Hafs Uthmanic Script', 'Amiri Quran', serif",
    mushafIds: ['madani-standard', 'madani-tajweed'],
  },
  {
    id: 'uthman-taha-naskh',
    name: 'Uthman Taha Naskh',
    family: "'KFGQPC Uthman Taha Naskh', 'Amiri Quran', serif",
    mushafIds: ['madani-standard', 'madani-tajweed'],
  },
  {
    id: 'amiri-quran',
    name: 'Amiri Quran',
    family: "'Amiri Quran', serif",
    mushafIds: ['madani-standard', 'madani-tajweed', 'indopak'],
  },
  {
    id: 'noto-naskh-arabic',
    name: 'Noto Naskh Arabic',
    family: "'Noto Naskh Arabic', serif",
    mushafIds: ['madani-standard', 'madani-tajweed'],
  },
  {
    id: 'scheherazade-new',
    name: 'Scheherazade New',
    family: "'Scheherazade New', serif",
    mushafIds: ['madani-standard', 'madani-tajweed', 'indopak'],
  },
];

export const MUSHAFS = [
  {
    id: 'madani-standard',
    name: 'Madani Standard',
    description: 'QPC Hafs script for continuous reading with compatible Madani fonts.',
    apiMushafId: 5,
    verseField: 'text_qpc_hafs',
    scriptField: 'text_qpc_hafs',
    renderMode: 'unicode',
    pageLayout: 'continuous',
    pageCount: 604,
    defaultFontId: 'amiri-quran',
    supportedFontIds: ['amiri-quran', 'kfgqpc-hafs', 'uthman-taha-naskh', 'noto-naskh-arabic', 'scheherazade-new'],
    supportsTajweedToggle: true,
    forcesTajweed: false,
    tajweedSource: 'uthmani_html',
  },
  {
    id: 'madani-tajweed',
    name: 'Madani Tajweed',
    description: 'Mushaf-first setup for page-accurate rendering and Tajweed guidance.',
    apiMushafId: 19,
    verseField: 'text_qpc_hafs',
    scriptField: 'text_qpc_hafs',
    renderMode: 'qcf-page',
    pageLayout: 'page-accurate',
    pageCount: 604,
    defaultFontId: 'kfgqpc-hafs',
    supportedFontIds: ['kfgqpc-hafs', 'uthman-taha-naskh', 'amiri-quran'],
    supportsTajweedToggle: true,
    forcesTajweed: true,
    tajweedSource: 'uthmani_html',
  },
  {
    id: 'indopak',
    name: 'IndoPak',
    description: 'South Asian script with a dedicated Mushaf profile and compatible fonts.',
    apiMushafId: 3,
    verseField: 'text_indopak',
    scriptField: 'text_indopak',
    renderMode: 'unicode',
    pageLayout: 'continuous',
    pageCount: 604,
    defaultFontId: 'scheherazade-new',
    supportedFontIds: ['scheherazade-new', 'amiri-quran'],
    supportsTajweedToggle: false,
    forcesTajweed: false,
    tajweedSource: null,
  },
];

export const DEFAULT_MUSHAF = MUSHAFS[0];

export function getMushafById(mushafId) {
  return MUSHAFS.find((mushaf) => mushaf.id === mushafId) || DEFAULT_MUSHAF;
}

export function getArabicFontById(fontId) {
  return ARABIC_FONT_OPTIONS.find((font) => font.id === fontId) || null;
}

export function getArabicFontByFamily(fontFamily) {
  return ARABIC_FONT_OPTIONS.find((font) => font.family === fontFamily) || null;
}

export function getMushafFontOptions(mushafId) {
  const mushaf = getMushafById(mushafId);
  return ARABIC_FONT_OPTIONS.filter((font) => mushaf.supportedFontIds.includes(font.id));
}

export function getCompatibleArabicFontId(mushafId, requestedFontId) {
  const options = getMushafFontOptions(mushafId);
  if (!options.length) {
    return null;
  }

  if (requestedFontId && options.some((font) => font.id === requestedFontId)) {
    return requestedFontId;
  }

  const mushaf = getMushafById(mushafId);
  if (mushaf.defaultFontId && options.some((font) => font.id === mushaf.defaultFontId)) {
    return mushaf.defaultFontId;
  }

  return options[0].id;
}

export function getArabicFontFamily(fontId, fallbackFamily = DEFAULT_MUSHAF.defaultFontId) {
  const font = getArabicFontById(fontId);
  if (font) {
    return font.family;
  }

  const fallback = getArabicFontById(fallbackFamily);
  return fallback?.family || "'Amiri Quran', serif";
}

export function isTajweedEnabledForMushaf(mushafId, tajweedEnabled) {
  const mushaf = getMushafById(mushafId);
  if (!mushaf.tajweedSource) {
    return false;
  }

  return mushaf.forcesTajweed || tajweedEnabled;
}
