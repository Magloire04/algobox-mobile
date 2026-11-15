// Enregistrement local des algorithmes (bibliothèque, session en cours, préférences)
// et échanges de fichiers avec l'appareil. Aucune donnée ne quitte l'appareil.

import { downloadFile } from './domHelpers.js';

const LIBRARY_KEY = 'algobox-mobile.library';
const SESSION_KEY = 'algobox-mobile.session';
const PREFERENCES_KEY = 'algobox-mobile.preferences';

function readJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function listLibrary() {
  const library = readJson(LIBRARY_KEY, {});
  return Object.keys(library)
    .map((name) => ({ name: name, content: library[name].content, updatedAt: library[name].updatedAt }))
    .sort((first, second) => second.updatedAt - first.updatedAt);
}

export function hasLibraryEntry(name) {
  return Object.prototype.hasOwnProperty.call(readJson(LIBRARY_KEY, {}), name);
}

export function saveToLibrary(name, content) {
  const library = readJson(LIBRARY_KEY, {});
  library[name] = { content: content, updatedAt: Date.now() };
  return writeJson(LIBRARY_KEY, library);
}

export function deleteFromLibrary(name) {
  const library = readJson(LIBRARY_KEY, {});
  delete library[name];
  return writeJson(LIBRARY_KEY, library);
}

export function saveSession(session) {
  return writeJson(SESSION_KEY, session);
}

export function loadSession() {
  return readJson(SESSION_KEY, null);
}

export function loadPreferences() {
  return Object.assign({ isConsoleLight: false, hasLineNumbers: true, isTextMode: false, theme: 'auto' }, readJson(PREFERENCES_KEY, {}));
}

export function savePreferences(preferences) {
  return writeJson(PREFERENCES_KEY, preferences);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'UTF-8');
  });
}

// Demande un fichier à l'utilisateur (sélecteur de fichiers du système).
export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files && input.files[0] ? input.files[0] : null), { once: true });
    input.click();
  });
}

// Partage le fichier via le menu de partage du téléphone, sinon le télécharge.
export async function shareOrDownloadFile(fileName, content, mimeType, isShareRequested) {
  if (isShareRequested && navigator.canShare) {
    try {
      const file = new File([content], fileName, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
        return 'shared';
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return 'cancelled';
    }
  }
  downloadFile(fileName, content, mimeType);
  return 'downloaded';
}

export function getBaseName(fileName) {
  return (
    String(fileName || 'sanstitre')
      .replace(/\.[^.]+$/, '')
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim() || 'sanstitre'
  );
}
