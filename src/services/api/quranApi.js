import axios from 'axios';
import { getMushafById } from '../../config/mushaf';
import { getOfflineCacheData, setOfflineCacheEntry } from '../../utils/offlineCache';

const api = axios.create({
  baseURL: 'https://api.quran.com/api/v4',
  headers: {
    Accept: 'application/json',
  },
});

const buildCacheKey = (path, params = {}) => {
  const normalizedParams = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  return `${path}?${new URLSearchParams(normalizedParams).toString()}`;
};

export const buildOfflineCacheKey = buildCacheKey;

const fetchWithOfflineCache = async (path, params = {}) => {
  const cacheKey = buildCacheKey(path, params);

  try {
    const { data } = await api.get(path, { params });
    await setOfflineCacheEntry(cacheKey, data);
    return data;
  } catch (error) {
    const offlineData = await getOfflineCacheData(cacheKey);
    if (offlineData) {
      return offlineData;
    }

    throw error;
  }
};

const WORD_FIELD_BY_MUSHAF = {
  text_uthmani: ['text_uthmani', 'page_number', 'line_number'],
  text_indopak: ['text_indopak', 'text_uthmani', 'page_number', 'line_number'],
  text_qpc_hafs: ['text_qpc_hafs', 'text_uthmani', 'page_number', 'line_number'],
};

const VERSE_FIELD_BY_MUSHAF = {
  text_uthmani: ['text_uthmani', 'page_number'],
  text_indopak: ['text_indopak', 'text_uthmani', 'page_number'],
  text_qpc_hafs: ['text_qpc_hafs', 'text_uthmani', 'page_number'],
};

const buildFieldsForMushaf = (mushafId) => {
  const mushaf = getMushafById(mushafId);
  const verseFields = VERSE_FIELD_BY_MUSHAF[mushaf.verseField] || VERSE_FIELD_BY_MUSHAF.text_uthmani;
  const wordFields = WORD_FIELD_BY_MUSHAF[mushaf.scriptField] || WORD_FIELD_BY_MUSHAF.text_uthmani;

  return {
    mushaf,
    fields: verseFields.join(','),
    wordFields: wordFields.join(','),
  };
};

const decorateVerses = (verses = [], mushaf) => verses.map((verse) => ({
  ...verse,
  arabic_text: verse[mushaf.verseField] || verse.text_uthmani || verse.text_indopak || verse.text_qpc_hafs || '',
}));

export const getChapters = async () => {
  const data = await fetchWithOfflineCache('/chapters', { language: 'en' });
  return data.chapters;
};

export const getChapter = async (id) => {
  const data = await fetchWithOfflineCache(`/chapters/${id}`, { language: 'en' });
  return data.chapter;
};

export const getVerses = async (chapterId, translationId = 85, reciterId = 7, page = 1, mushafId = 'madani-standard', perPage = 50) => {
  const { mushaf, fields, wordFields } = buildFieldsForMushaf(mushafId);
  const isEveryAyah = typeof reciterId === 'string';
  const params = {
    language: 'en',
    words: true,
    translations: translationId,
    audio: isEveryAyah ? 7 : reciterId,
    fields,
    word_fields: wordFields,
    mushaf: mushaf.apiMushafId,
    page,
    per_page: perPage,
  };
  const data = await fetchWithOfflineCache(`/verses/by_chapter/${chapterId}`, params);
  
  if (isEveryAyah) {
      data.verses.forEach(v => {
          const [chapter, ayah] = v.verse_key.split(':');
          const chapterStr = String(chapter).padStart(3, '0');
          const ayahStr = String(ayah).padStart(3, '0');
          v.audio = { url: `https://everyayah.com/data/${reciterId}/${chapterStr}${ayahStr}.mp3` };
      });
  }

  return {
    ...data,
    verses: decorateVerses(data.verses, mushaf),
  };
};

export const getVersesByPage = async (pageNumber, translationId = 85, reciterId = 7, mushafId = 'madani-standard') => {
  const { mushaf, fields, wordFields } = buildFieldsForMushaf(mushafId);
  const isEveryAyah = typeof reciterId === 'string';
  const params = {
    language: 'en',
    words: true,
    translations: translationId,
    audio: isEveryAyah ? 7 : reciterId,
    fields,
    word_fields: wordFields,
    mushaf: mushaf.apiMushafId,
    per_page: 50,
  };
  const data = await fetchWithOfflineCache(`/verses/by_page/${pageNumber}`, params);
  
  if (isEveryAyah) {
      data.verses.forEach(v => {
          const [chapter, ayah] = v.verse_key.split(':');
          const chapterStr = String(chapter).padStart(3, '0');
          const ayahStr = String(ayah).padStart(3, '0');
          v.audio = { url: `https://everyayah.com/data/${reciterId}/${chapterStr}${ayahStr}.mp3` };
      });
  }

  return {
    ...data,
    verses: decorateVerses(data.verses, mushaf),
  };
};


export const getChapterAudio = async (chapterId, reciterId = 7) => {
  const data = await fetchWithOfflineCache(`/chapter_recitations/${reciterId}/${chapterId}`);
  return data.audio_file;
};

export const getChapterTafsirs = async (chapterId, tafsirId = 169) => {
  const data = await fetchWithOfflineCache(`/tafsirs/${tafsirId}/by_chapter/${chapterId}`);
  return data.tafsirs;
};

export const getPageTafsirs = async (pageNumber, tafsirId = 169) => {
  const data = await fetchWithOfflineCache(`/tafsirs/${tafsirId}/by_page/${pageNumber}`);
  return data.tafsirs;
};

export const getTajweedVerses = async (chapterId) => {
  const data = await fetchWithOfflineCache('/quran/verses/uthmani_tajweed', { chapter_number: chapterId });
  return data.verses; // Array of { id, verse_key, text_uthmani_tajweed }
};

export const getTajweedVersesByPage = async (pageNumber) => {
  const data = await fetchWithOfflineCache('/quran/verses/uthmani_tajweed', { page_number: pageNumber });
  return data.verses;
};

export const getJuzs = async () => {
  const data = await fetchWithOfflineCache('/juzs');
  return data.juzs;
};
