// Fenêtre « AlgoBox Test » : console des résultats, saisie des valeurs, pas à pas,
// graphique et code de l'algorithme avec la ligne en cours surlignée.

import { createElement, askConfirmation } from './domHelpers.js';

const { Execution, GraphRenderer, EXECUTION_STATES, GRAPH_SIZE, buildListing } = window.AlgoEngine;
const CANVAS_SIZE = GRAPH_SIZE + 4;

export class TestWindow {
  constructor({ getAlgorithm, getFileName, isLightConsole }) {
    this.getAlgorithm = getAlgorithm;
    this.getFileName = getFileName;
    this.isLightConsole = isLightConsole;
    this.execution = null;
    this.elements = {
      window: document.getElementById('testWindow'),
      title: document.getElementById('testWindowTitle'),
      body: document.getElementById('testWindowBody'),
      descriptionPanel: document.getElementById('descriptionPanel'),
      descriptionText: document.getElementById('descriptionText'),
      console: document.getElementById('console'),
      graphPanel: document.getElementById('graphPanel'),
      frameCanvas: document.getElementById('frameCanvas'),
      drawingCanvas: document.getElementById('drawingCanvas'),
      graphLegend: document.getElementById('graphLegend'),
      stepPanel: document.getElementById('stepPanel'),
      stepTrace: document.getElementById('stepTrace'),
      codeListing: document.getElementById('codeListing'),
      stepModeCheckbox: document.getElementById('stepModeCheckbox'),
      runButton: document.getElementById('runButton'),
      continueButton: document.getElementById('continueButton'),
      stopButton: document.getElementById('stopButton'),
      closeButton: document.getElementById('closeTestButton'),
      printButton: document.getElementById('printTestButton'),
      runningIndicator: document.getElementById('runningIndicator'),
    };
    this.elements.runButton.addEventListener('click', () => this.run());
    this.elements.continueButton.addEventListener('click', () => this.execution && this.execution.continueExecution());
    this.elements.stopButton.addEventListener('click', () => this.execution && this.execution.stop());
    this.elements.closeButton.addEventListener('click', () => this.close());
    if (this.elements.printButton) this.elements.printButton.addEventListener('click', () => window.print());
    this.elements.window.addEventListener('keydown', (event) => this.handleKeydown(event));
  }

  isOpen() {
    return !this.elements.window.hidden;
  }

  open() {
    const algorithm = this.getAlgorithm();
    const elements = this.elements;
    elements.title.textContent = 'AlgoBox : ' + this.getFileName();
    elements.descriptionText.textContent = algorithm.description || '';
    elements.descriptionPanel.hidden = !algorithm.description;
    elements.console.classList.toggle('console--light', this.isLightConsole());
    elements.console.replaceChildren();
    elements.stepTrace.textContent = '';
    elements.stepPanel.hidden = true;
    elements.graphPanel.hidden = true;
    elements.graphLegend.textContent = '';
    this.renderListing(algorithm);
    this.highlightLine(null);
    this.prepareCanvases();
    this.updateControls(EXECUTION_STATES.IDLE);
    elements.window.hidden = false;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('is-testing');
    elements.body.scrollTop = 0;
    setTimeout(() => elements.runButton.focus(), 50);
  }

  close() {
    if (this.execution && this.execution.isRunning()) this.execution.stop();
    this.execution = null;
    this.elements.window.hidden = true;
    document.body.style.overflow = '';
    document.body.classList.remove('is-testing');
  }

  prepareCanvases() {
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    [this.elements.frameCanvas, this.elements.drawingCanvas].forEach((canvas) => {
      canvas.width = Math.round(CANVAS_SIZE * ratio);
      canvas.height = Math.round(CANVAS_SIZE * ratio);
      const context = canvas.getContext('2d');
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    });
  }

  renderListing(algorithm) {
    const rows = buildListing(algorithm).map((line) =>
      createElement('div', { className: 'code-line', dataset: { line: String(line.number) } }, [
        createElement('span', { className: 'code-line__number', text: String(line.number) }),
        createElement('span', { text: '  '.repeat(line.depth) + line.text }),
      ]),
    );
    this.elements.codeListing.replaceChildren(...rows);
  }

  highlightLine(lineNumber, isError) {
    this.elements.codeListing.querySelectorAll('.code-line--current, .code-line--error').forEach((row) => {
      row.classList.remove('code-line--current', 'code-line--error');
    });
    const banner = document.getElementById('currentLineBanner');
    const row = lineNumber ? this.elements.codeListing.querySelector('[data-line="' + lineNumber + '"]') : null;
    banner.hidden = !row;
    if (!row) return;
    // Sur téléphone, le code est souvent hors de l'écran : la ligne courante reste visible en bas.
    banner.textContent = (isError ? 'Erreur ligne ' : 'Ligne ') + lineNumber + ' : ' + row.lastChild.textContent.trim();
    banner.classList.toggle('current-line--error', Boolean(isError));
    row.classList.add(isError ? 'code-line--error' : 'code-line--current');
    const listing = this.elements.codeListing;
    const rowTop = row.offsetTop - listing.offsetTop;
    if (rowTop < listing.scrollTop || rowTop > listing.scrollTop + listing.clientHeight - row.offsetHeight) {
      listing.scrollTop = rowTop - listing.clientHeight / 2;
    }
  }

  appendConsoleText(text) {
    const consoleElement = this.elements.console;
    const lastChild = consoleElement.lastChild;
    if (lastChild && lastChild.nodeType === Node.TEXT_NODE) lastChild.appendData(text);
    else consoleElement.append(document.createTextNode(text));
    consoleElement.scrollTop = consoleElement.scrollHeight;
  }

  getConsoleText() {
    return this.elements.console.textContent;
  }

  run() {
    if (this.execution && this.execution.isRunning()) return;
    const algorithm = this.getAlgorithm();
    const elements = this.elements;
    const isStepMode = elements.stepModeCheckbox.checked;
    this.renderListing(algorithm);
    this.prepareCanvases();
    elements.console.replaceChildren(document.createTextNode("***Lancement de l'algorithme***"));
    elements.stepTrace.textContent = '';
    elements.stepPanel.hidden = !isStepMode;
    elements.graphPanel.hidden = true;
    const graph = new GraphRenderer(elements.frameCanvas.getContext('2d'), elements.drawingCanvas.getContext('2d'), algorithm.settings);
    this.execution = new Execution(algorithm, {
      graph: graph,
      onClear: () => {
        elements.console.replaceChildren();
        elements.stepTrace.textContent = '';
      },
      onOutput: (text, hasNewline) => this.appendConsoleText(text + (hasNewline ? '\n' : '')),
      onTrace: (text, hasNewline) => {
        elements.stepTrace.append(text + (hasNewline ? '\n' : ''));
        elements.stepTrace.scrollTop = elements.stepTrace.scrollHeight;
      },
      onFrameDefined: (legendLines) => {
        elements.graphPanel.hidden = false;
        elements.graphLegend.replaceChildren(...legendLines.flatMap((line, index) => (index ? [createElement('br'), line] : [line])));
      },
      requestSyncInput: (message) => window.prompt(message),
      requestSyncConfirm: (message) => window.confirm(message),
      onStateChange: (change) => this.handleStateChange(change),
    });
    // Laisse le navigateur afficher « Lancement » avant de démarrer, comme AlgoBox.
    this.updateControls(EXECUTION_STATES.RUNNING);
    setTimeout(() => this.execution && this.execution.start(isStepMode), 30);
  }

  handleStateChange(change) {
    this.updateControls(change.state);
    const states = EXECUTION_STATES;
    if (change.state === states.WAITING_INPUT) {
      this.highlightLine(change.line, false);
      this.showInput(change.prompt, change.message.split('\n').slice(1).join('\n'));
    } else if (change.state === states.STEPPING || change.state === states.PAUSED) {
      this.highlightLine(change.line, false);
      this.elements.continueButton.focus({ preventScroll: true });
    } else if (change.state === states.CONFIRMING) {
      askConfirmation('AlgoBox', change.message, 'Oui', 'Non').then((isStopRequested) => {
        if (this.execution) this.execution.answerConfirmation(isStopRequested);
      });
    } else if (change.state === states.FINISHED) {
      this.removeInput();
      this.highlightLine(change.errorLine, Boolean(change.errorLine));
    } else if (change.state === states.RUNNING) {
      this.highlightLine(null);
    }
  }

  // Saisie dans la console, à la manière de la console d'AlgoBox.
  showInput(prompt, hint) {
    this.removeInput();
    const text = this.getConsoleText();
    if (text && !text.endsWith('\n')) this.appendConsoleText('\n');
    this.appendConsoleText(prompt + ' ');
    const input = createElement('input', {
      className: 'console__input',
      type: 'text',
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
      enterkeyhint: 'done',
      'aria-label': prompt,
    });
    const submit = () => {
      const value = input.value;
      if (!value) return;
      this.removeInput();
      this.elements.console.append(createElement('span', { className: 'console__answer', text: value }));
      this.appendConsoleText('\n');
      if (this.execution) this.execution.submitInput(value);
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        submit();
      }
    });
    const row = createElement('div', { className: 'console__input-row', id: 'consoleInputRow' }, [
      input,
      createElement('button', { type: 'button', className: 'action-button action-button--primary', text: 'OK', onClick: submit }),
    ]);
    const container = createElement('div', { id: 'consoleInputContainer' }, [
      row,
      hint ? createElement('div', { className: 'console__hint', text: hint.trim() }) : null,
    ]);
    this.elements.console.append(container);
    this.elements.console.scrollTop = this.elements.console.scrollHeight;
    setTimeout(() => input.focus({ preventScroll: false }), 20);
  }

  removeInput() {
    const container = document.getElementById('consoleInputContainer');
    if (container) container.remove();
  }

  updateControls(state) {
    const states = EXECUTION_STATES;
    const isActive = state !== states.IDLE && state !== states.FINISHED;
    const elements = this.elements;
    elements.runButton.disabled = isActive;
    elements.stepModeCheckbox.disabled = isActive;
    elements.continueButton.disabled = !(state === states.STEPPING || state === states.PAUSED);
    elements.stopButton.disabled = !isActive;
    elements.runningIndicator.hidden = state !== states.RUNNING;
  }

  // Raccourcis d'AlgoBox : Entrée = lancer, Bas = continuer, Échap = arrêter.
  handleKeydown(event) {
    if (event.target.tagName === 'INPUT' && event.target.type === 'text') return;
    if (document.querySelector('.modal-layer')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.execution && this.execution.isRunning()) this.execution.stop();
      else this.close();
    } else if (event.key === 'ArrowDown' && !this.elements.continueButton.disabled) {
      event.preventDefault();
      this.execution.continueExecution();
    } else if (event.key === 'Enter' && event.target.tagName !== 'BUTTON' && !this.elements.runButton.disabled) {
      event.preventDefault();
      this.run();
    }
  }
}
