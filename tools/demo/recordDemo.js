'use strict';

// Enregistre la vidéo tutoriel de la section « Démo » en pilotant l'application.
// Lancement : npm run demo:record (Playwright, Chromium et ffmpeg doivent être installés).
// Produit demo/algobox-mobile-demo.mp4, demo/poster.jpg et demo/chapters.json.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { startStaticServer } = require('../staticServer.js');

const ROOT_DIRECTORY = path.resolve(__dirname, '..', '..');
const OUTPUT_DIRECTORY = path.join(ROOT_DIRECTORY, 'demo');
const VIDEO_FILE_NAME = 'algobox-mobile-demo.mp4';
const VIDEO_FILE = path.join(OUTPUT_DIRECTORY, VIDEO_FILE_NAME);
const POSTER_FILE = path.join(OUTPUT_DIRECTORY, 'poster.jpg');
const CHAPTERS_FILE = path.join(OUTPUT_DIRECTORY, 'chapters.json');
const VIEWPORT = { width: 390, height: 844 };
const PIXEL_RATIO = 2;
const TYPING_DELAY = 110;
const PUBLIC_ADDRESS = 'algobox-mobile.bytechnum.com';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const writeProgress = (message) => process.stdout.write(message + '\n');

// Temps de lecture d'une légende : assez long pour la lire sur un téléphone.
const getReadingTime = (text) => Math.min(7000, Math.max(2800, 1200 + text.length * 40));

// Légendes, repères d'appui et cartons, ajoutés à la page seulement pendant l'enregistrement.
function installOverlay() {
  const style = document.createElement('style');
  style.textContent = `
    #demoCaption { position: fixed; top: 8px; left: 10px; right: 10px; z-index: 1000; padding: 10px 14px 12px;
      border-radius: 14px; background: rgba(17, 24, 39, 0.94); color: #fff; font: 600 15px/1.35 system-ui, sans-serif;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35); pointer-events: none; transition: opacity 0.25s; }
    #demoCaption[hidden] { display: none; }
    #demoCaption .demo-caption__label { display: block; margin-bottom: 3px; color: #ffd54f; font-size: 12px;
      font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
    .demo-tap { position: fixed; z-index: 1001; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
      background: rgba(255, 213, 79, 0.45); border: 3px solid #ffd54f; pointer-events: none; animation: demoTap 0.8s ease-out forwards; }
    @keyframes demoTap { from { transform: scale(0.5); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }
    #demoCard { position: fixed; inset: 0; z-index: 1002; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 16px; padding: 28px; background: linear-gradient(#4a82bd, #2b5687); color: #fff;
      font-family: system-ui, sans-serif; text-align: center; }
    #demoCard[hidden] { display: none; }
    #demoCard img { width: 128px; height: 128px; border-radius: 28px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3); }
    #demoCard h1 { margin: 0; font-size: 32px; }
    #demoCard p { margin: 0; font-size: 19px; line-height: 1.4; opacity: 0.92; }`;
  document.head.append(style);

  const caption = document.createElement('div');
  caption.id = 'demoCaption';
  caption.hidden = true;
  const captionLabel = document.createElement('span');
  captionLabel.className = 'demo-caption__label';
  const captionText = document.createElement('span');
  caption.append(captionLabel, captionText);

  const card = document.createElement('div');
  card.id = 'demoCard';
  card.hidden = true;
  const cardImage = document.createElement('img');
  cardImage.src = 'app-icons/icon-512.png';
  cardImage.alt = '';
  const cardTitle = document.createElement('h1');
  const cardSubtitle = document.createElement('p');
  card.append(cardImage, cardTitle, cardSubtitle);
  document.body.append(caption, card);

  window.demoOverlay = {
    setCaption(label, text) {
      captionLabel.textContent = label;
      captionText.textContent = text;
      caption.hidden = false;
      caption.style.opacity = '1';
    },
    // Un appui sous la légende : la légende s'efface le temps de l'appui.
    showTap(x, y) {
      const marker = document.createElement('div');
      marker.className = 'demo-tap';
      marker.style.left = x + 'px';
      marker.style.top = y + 'px';
      document.body.append(marker);
      setTimeout(() => marker.remove(), 900);
      const area = caption.getBoundingClientRect();
      if (!caption.hidden && x >= area.left && x <= area.right && y >= area.top && y <= area.bottom) {
        caption.style.opacity = '0.12';
        setTimeout(() => (caption.style.opacity = '1'), 1400);
      }
    },
    showCard(title, subtitle) {
      cardTitle.textContent = title;
      cardSubtitle.textContent = subtitle;
      card.hidden = false;
    },
    hideCard() {
      card.hidden = true;
    },
  };
}

// Capture d'écran en continu, en haute définition (l'enregistreur vidéo intégré de
// Playwright ignore la densité d'écran et donnerait une vidéo floue sur téléphone).
class FrameRecorder {
  constructor(page, directory) {
    this.page = page;
    this.directory = directory;
    this.frames = [];
    this.isRunning = false;
    this.captureLoop = null;
  }

  start() {
    this.isRunning = true;
    this.captureLoop = this.captureFrames();
  }

  async captureFrames() {
    while (this.isRunning) {
      const captureStart = Date.now();
      const image = await this.page.screenshot({ type: 'jpeg', quality: 82, scale: 'device', caret: 'initial' });
      const file = path.join(this.directory, 'image' + String(this.frames.length).padStart(6, '0') + '.jpg');
      fs.writeFileSync(file, image);
      this.frames.push({ file: file, time: (captureStart + Date.now()) / 2 });
    }
  }

  async stop() {
    this.isRunning = false;
    await this.captureLoop;
  }

  getStartTime() {
    return this.frames.length ? this.frames[0].time : Date.now();
  }

  // Liste pour le « concat » de ffmpeg : chaque image dure jusqu'à la suivante.
  writeConcatList(listFile) {
    const lines = ['ffconcat version 1.0'];
    this.frames.forEach((frame, index) => {
      const next = this.frames[index + 1];
      const duration = next ? (next.time - frame.time) / 1000 : 1;
      lines.push("file '" + frame.file + "'", 'duration ' + Math.max(0.001, duration).toFixed(3));
    });
    lines.push("file '" + this.frames[this.frames.length - 1].file + "'");
    fs.writeFileSync(listFile, lines.join('\n') + '\n');
  }
}

class DemoDirector {
  constructor(page) {
    this.page = page;
    this.chapters = [];
  }

  addChapter(title, text) {
    this.chapters.push({ time: Date.now(), title: title, text: text });
  }

  // Positions des chapitres en secondes depuis la première image de la vidéo.
  getChapters(videoStartTime) {
    return this.chapters.map((chapter) => ({
      start: Math.max(0, Math.round((chapter.time - videoStartTime - 200) / 100) / 10),
      title: chapter.title,
      text: chapter.text,
    }));
  }

  async chapter(title, text) {
    this.addChapter(title, text);
    writeProgress('  ' + title);
    await this.page.evaluate(([label, caption]) => window.demoOverlay.setCaption(label, caption), [title, text]);
    await wait(getReadingTime(text));
  }

  async showTapOn(locator) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (box) await this.page.evaluate(([x, y]) => window.demoOverlay.showTap(x, y), [box.x + box.width / 2, box.y + box.height / 2]);
    await wait(450);
  }

  async tap(locator, pauseAfter = 700) {
    await this.showTapOn(locator);
    await locator.click();
    await wait(pauseAfter);
  }

  async type(locator, text) {
    await this.tap(locator, 250);
    await locator.pressSequentially(text, { delay: TYPING_DELAY });
    await wait(450);
  }

  // Les listes déroulantes natives ne s'affichent pas à l'enregistrement : on montre l'appui
  // puis on choisit la valeur directement.
  async choose(locator, value) {
    await this.showTapOn(locator);
    await locator.selectOption(value);
    await wait(700);
  }

  async showCard(title, subtitle, duration) {
    await this.page.evaluate(([cardTitle, cardSubtitle]) => window.demoOverlay.showCard(cardTitle, cardSubtitle), [title, subtitle]);
    await wait(duration);
  }

  async hideCard() {
    await this.page.evaluate(() => window.demoOverlay.hideCard());
  }
}

async function recordScenes(director, page) {
  const button = (name) => page.getByRole('button', { name: name, exact: true });
  const okButton = () => button('OK');
  const menuItem = (name) => page.getByRole('menuitem', { name: name, exact: true });
  const treeRow = (text) => page.locator('.tree-row', { hasText: text }).first();
  const dialogText = () => page.locator('.modal input[type=text]').first();
  const dialogExpression = (position = 0) => page.locator('.modal input.mono').nth(position);
  const answerInConsole = async (value) => {
    await page.locator('.console__input').waitFor();
    await director.type(page.locator('.console__input'), value);
    await director.tap(page.locator('#consoleInputRow button'), 1200);
  };

  director.addChapter('Introduction', "AlgoBox Mobile permet d'écrire, de tester et d'enregistrer des algorithmes sur son téléphone, avec la syntaxe d'AlgoBox.");
  await director.showCard('AlgoBox Mobile', 'Tutoriel : écrire et tester un algorithme sur son téléphone', 4500);
  await director.hideCard();

  await director.chapter("L'écran principal", "En haut, l'arbre de l'algorithme. En bas, les onglets d'opérations pour ajouter des instructions.");

  await director.chapter('Déclarer les variables', '« Déclarer nouvelle variable » : on choisit un nom et un type (NOMBRE, CHAINE ou LISTE).');
  for (const name of ['N', 'somme', 'i']) {
    await director.tap(button('Déclarer nouvelle variable'));
    await director.type(dialogText(), name);
    await director.tap(okButton());
  }

  await director.chapter('Lire une valeur', 'On sélectionne DEBUT_ALGORITHME, puis « Ajouter LIRE variable » : la valeur de N sera demandée au lancement.');
  await director.tap(treeRow('DEBUT_ALGORITHME'));
  await director.tap(button('Ajouter LIRE variable'));
  await director.choose(page.locator('.modal select'), 'N');
  await director.tap(okButton());

  await director.chapter('Affecter une valeur', '« AFFECTER valeur à variable » : la variable somme prend la valeur 0.');
  await director.tap(button('AFFECTER valeur à variable'));
  await director.choose(page.locator('.modal select'), 'somme');
  await director.type(dialogExpression(0), '0');
  await director.tap(okButton());

  await director.chapter('Une boucle POUR', '« Ajouter POUR...DE...A » : i va de 1 à N. Les instructions répétées se placent entre DEBUT_POUR et FIN_POUR.');
  await director.tap(button('Ajouter POUR...DE...A'));
  await director.choose(page.locator('.modal select'), 'i');
  await director.type(dialogExpression(0), '1');
  await director.type(dialogExpression(1), 'N');
  await director.tap(okButton());
  await director.tap(button('AFFECTER valeur à variable'));
  await director.choose(page.locator('.modal select'), 'somme');
  await director.type(dialogExpression(0), 'somme+i');
  await director.tap(okButton(), 1500);

  await director.chapter('Afficher le résultat', 'Sur la ligne FIN_POUR : « Ajouter AFFICHER Message », puis « Ajouter AFFICHER Variable ».');
  await director.tap(treeRow('FIN_POUR'));
  await director.tap(button('Ajouter AFFICHER Message'));
  await director.type(dialogText(), 'La somme vaut ');
  await director.tap(okButton());
  await director.tap(button('Ajouter AFFICHER Variable'));
  await director.choose(page.locator('.modal select'), 'somme');
  await director.tap(okButton(), 1500);

  await director.chapter("Tester l'algorithme", '« Tester » ouvre la fenêtre de test. « Lancer Algorithme », puis on saisit la valeur de N dans la console.');
  await director.tap(page.locator('#testButton'), 1000);
  await director.tap(page.locator('#runButton'));
  await answerInConsole('10');
  await wait(2500);

  await director.chapter('Le mode pas à pas', "Avec « Mode pas à pas », l'algorithme s'arrête à chaque étape et montre la valeur des variables. « Continuer » avance d'une étape.");
  await director.tap(page.locator('#stepModeCheckbox'));
  await director.tap(page.locator('#runButton'));
  await answerInConsole('3');
  await page.locator('#stepPanel').scrollIntoViewIfNeeded();
  for (let step = 0; step < 6; step++) await director.tap(page.locator('#continueButton'), 1100);
  await director.tap(page.locator('#stopButton'), 1800);
  // Retour au mode normal pour les lancements suivants.
  await director.tap(page.locator('#stepModeCheckbox'));
  await director.tap(page.locator('#closeTestButton'), 1000);

  await director.chapter('Enregistrer', 'Menu ☰ > « Sauver sous » : l\'algorithme est enregistré sur le téléphone, dans « Mes algorithmes ».');
  await director.tap(page.locator('#menuButton'));
  await director.tap(menuItem('Sauver sous…'));
  await director.type(dialogText(), 'somme_entiers');
  await director.tap(okButton(), 2000);

  await director.chapter('Un exemple avec un graphique', 'Menu ☰ > « Ouvrir un exemple » : ici, une valeur approchée de π obtenue en plaçant des points au hasard.');
  await director.tap(page.locator('#menuButton'));
  await director.tap(menuItem('Ouvrir un exemple'));
  await director.tap(page.locator('.library-item__open', { hasText: 'Monte-Carlo' }), 1500);
  await director.tap(page.locator('#testButton'), 1000);
  await director.tap(page.locator('#runButton'));
  await answerInConsole('1500');
  await wait(1500);
  await page.locator('#graphPanel').scrollIntoViewIfNeeded();
  await wait(4500);
  await director.tap(page.locator('#closeTestButton'), 1000);

  await director.chapter('Le mode éditeur de texte', 'Menu ☰ > « Mode éditeur texte » : on écrit le code directement, et « Vérifier code » contrôle la syntaxe.');
  await director.tap(page.locator('#menuButton'));
  await director.tap(page.getByRole('menuitemcheckbox', { name: 'Mode éditeur texte' }), 3000);
  await director.tap(page.locator('#checkCodeButton'), 2800);
  await director.tap(page.locator('#normalModeButton'), 1200);

  await director.chapter("Installer l'application", 'Android : menu ⋮ > « Installer l\'application ». iPhone : Partager > « Sur l\'écran d\'accueil ». Elle marche ensuite sans connexion.');
  await director.tap(page.locator('#menuButton'));
  await director.tap(menuItem("Installer l'application"), 5500);
  await director.tap(okButton(), 1000);

  await director.showCard('À vous de jouer !', PUBLIC_ADDRESS, 4500);
}

function runFfmpeg(argumentsList) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...argumentsList], { stdio: 'inherit' });
}

function readDuration(file) {
  const output = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file]);
  return Math.round(parseFloat(String(output)) * 10) / 10;
}

async function recordDemo() {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'algobox-demo-'));
  const { server, url } = await startStaticServer(ROOT_DIRECTORY);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: PIXEL_RATIO,
      isMobile: true,
      hasTouch: true,
      locale: 'fr-FR',
      colorScheme: 'light',
    });
    const page = await context.newPage();
    const director = new DemoDirector(page);
    const recorder = new FrameRecorder(page, temporaryDirectory);
    await page.goto(url);
    await page.evaluate(installOverlay);
    writeProgress('Enregistrement des scènes :');
    recorder.start();
    try {
      await recordScenes(director, page);
    } catch (error) {
      await recorder.stop();
      const screenshotFile = path.join(os.tmpdir(), 'algobox-demo-erreur.png');
      await page.screenshot({ path: screenshotFile }).catch(() => {});
      throw new Error(error.message.split('\n')[0] + ' (capture : ' + screenshotFile + ')', { cause: error });
    }
    await recorder.stop();
    await context.close();

    writeProgress('Assemblage de ' + recorder.frames.length + ' images en MP4 (H.264)…');
    const listFile = path.join(temporaryDirectory, 'images.txt');
    recorder.writeConcatList(listFile);
    runFfmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-vf', 'fps=25,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-movflags', '+faststart', '-an', VIDEO_FILE]);
    runFfmpeg(['-ss', '2', '-i', VIDEO_FILE, '-frames:v', '1', '-q:v', '4', POSTER_FILE]);
    const chapterFile = { video: VIDEO_FILE_NAME, duration: readDuration(VIDEO_FILE), chapters: director.getChapters(recorder.getStartTime()) };
    fs.writeFileSync(CHAPTERS_FILE, JSON.stringify(chapterFile, null, 2) + '\n');
    writeProgress('Vidéo : ' + path.relative(ROOT_DIRECTORY, VIDEO_FILE) + ' (' + chapterFile.duration + ' s, ' + Math.round(fs.statSync(VIDEO_FILE).size / 1024) + ' Ko)');
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

recordDemo().catch((error) => {
  process.stderr.write('Échec de l\'enregistrement : ' + error.message + '\n');
  process.exitCode = 1;
});
