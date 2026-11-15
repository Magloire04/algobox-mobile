// Section « Démo » : vidéo tutoriel et chapitres cliquables.
// La vidéo n'est téléchargée qu'au moment de la lecture ; les chapitres restent
// lisibles sans connexion (ils servent aussi de transcription de la vidéo).

import { createElement } from './domHelpers.js';

const CHAPTERS_URL = 'demo/chapters.json';
const OFFLINE_MESSAGE = 'Pas de connexion : la vidéo ne peut pas être lue pour le moment. Les étapes ci-dessous restent disponibles.';
const LOADING_ERROR_MESSAGE = "La vidéo n'a pas pu être chargée. Vérifier la connexion, puis réessayer.";

function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

export class DemoView {
  constructor() {
    this.video = document.getElementById('demoVideo');
    this.notice = document.getElementById('demoNotice');
    this.chapterList = document.getElementById('demoChapters');
    this.chapters = [];
    this.isLoaded = false;
    this.video.addEventListener('timeupdate', () => this.highlightCurrentChapter());
    this.video.addEventListener('error', () => this.showNotice(navigator.onLine ? LOADING_ERROR_MESSAGE : OFFLINE_MESSAGE), true);
    window.addEventListener('online', () => this.hideNotice());
    window.addEventListener('offline', () => this.showNotice(OFFLINE_MESSAGE));
  }

  async show() {
    if (!navigator.onLine) this.showNotice(OFFLINE_MESSAGE);
    if (!this.isLoaded) await this.loadChapters();
  }

  hide() {
    if (!this.video.paused) this.video.pause();
  }

  async loadChapters() {
    try {
      const response = await fetch(CHAPTERS_URL);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const chapterFile = await response.json();
      this.chapters = chapterFile.chapters || [];
      this.isLoaded = true;
      this.renderChapters();
    } catch {
      this.chapterList.replaceChildren(createElement('li', { className: 'operation-hint', text: 'Les chapitres ne sont pas disponibles pour le moment.' }));
    }
  }

  renderChapters() {
    const items = this.chapters.map((chapter, index) =>
      createElement('li', {}, [
        createElement(
          'button',
          {
            type: 'button',
            className: 'demo-chapter',
            dataset: { index: String(index) },
            'aria-label': 'Aller au chapitre « ' + chapter.title + ' » (' + formatTime(chapter.start) + ')',
            onClick: () => this.playFrom(chapter.start),
          },
          [
            createElement('span', { className: 'demo-chapter__time', text: formatTime(chapter.start) }),
            createElement('span', { className: 'demo-chapter__content' }, [
              createElement('strong', { className: 'demo-chapter__title', text: chapter.title }),
              createElement('span', { className: 'demo-chapter__text', text: chapter.text }),
            ]),
          ],
        ),
      ]),
    );
    this.chapterList.replaceChildren(...items);
  }

  // Avec preload="none", la position ne peut être choisie qu'une fois la durée connue.
  playFrom(startSeconds) {
    const video = this.video;
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      video.currentTime = startSeconds;
    } else {
      video.addEventListener('loadedmetadata', () => (video.currentTime = startSeconds), { once: true });
    }
    video.play().catch(() => {
      // La lecture peut être refusée (pas de connexion, économiseur de données) : le message d'erreur s'en charge.
    });
    video.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  highlightCurrentChapter() {
    const time = this.video.currentTime;
    let currentIndex = -1;
    this.chapters.forEach((chapter, index) => {
      if (time >= chapter.start) currentIndex = index;
    });
    this.chapterList.querySelectorAll('.demo-chapter').forEach((button) => {
      const isCurrent = Number(button.dataset.index) === currentIndex;
      button.classList.toggle('demo-chapter--current', isCurrent);
      if (isCurrent) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }

  showNotice(message) {
    this.notice.textContent = message;
    this.notice.hidden = false;
  }

  hideNotice() {
    this.notice.hidden = true;
  }
}
