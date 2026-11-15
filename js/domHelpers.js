// Outils d'interface partagés : création d'éléments, coloration syntaxique,
// boîtes de dialogue et notifications. Les textes saisis par l'utilisateur ne passent
// jamais par innerHTML : ils sont toujours insérés comme texte.

export function createElement(tagName, properties = {}, children = []) {
  const element = document.createElement(tagName);
  Object.entries(properties).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) return;
    if (key === 'className') element.className = value;
    else if (key === 'text') element.textContent = value;
    else if (key === 'dataset') Object.assign(element.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) element.setAttribute(key, '');
    else element.setAttribute(key, value);
  });
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return element;
}

const KEYWORD_CLASSES = new Map();
const registerKeywords = (className, words) => words.forEach((word) => KEYWORD_CLASSES.set(word, className));
registerKeywords('syntax-block', ['VARIABLES', 'DEBUT_ALGORITHME', 'FIN_ALGORITHME']);
registerKeywords('syntax-function', ['FONCTION', 'FONCTIONS_UTILISEES', 'DEBUT_FONCTION', 'FIN_FONCTION', 'VARIABLES_FONCTION']);
registerKeywords('syntax-command', [
  'EST_DU_TYPE',
  'PAUSE',
  'LIRE',
  'AFFICHERCALCUL',
  'AFFICHER',
  'PREND_LA_VALEUR',
  'TRACER_POINT',
  'TRACER_POINT_Rouge',
  'TRACER_POINT_Vert',
  'TRACER_POINT_Bleu',
  'TRACER_POINT_Blanc',
  'TRACER_SEGMENT',
  'TRACER_SEGMENT_Rouge',
  'TRACER_SEGMENT_Vert',
  'TRACER_SEGMENT_Bleu',
  'TRACER_SEGMENT_Blanc',
  'EFFACER_GRAPHIQUE',
  'RENVOYER',
  'APPELER_FONCTION',
  'NOMBRE',
  'CHAINE',
  'LISTE',
]);
registerKeywords('syntax-condition', ['SI', 'ALORS', 'SINON', 'DEBUT_SI', 'FIN_SI', 'DEBUT_SINON', 'FIN_SINON']);
registerKeywords('syntax-while', ['TANT_QUE', 'DEBUT_TANT_QUE', 'FIN_TANT_QUE', 'FAIRE']);
registerKeywords('syntax-for', ['POUR', 'ALLANT_DE', 'DEBUT_POUR', 'FIN_POUR']);

// Colore une ligne comme l'arbre d'AlgoBox (mots-clés, commentaires).
export function renderHighlightedLine(text) {
  const fragment = document.createDocumentFragment();
  if (text.startsWith('//')) {
    fragment.append(createElement('span', { className: 'syntax-comment', text: text }));
    return fragment;
  }
  const isForLoop = /^POUR\s/.test(text);
  const tokens = text.split(/("[^"]*"|\b[A-Za-z_]+\*?)/);
  tokens.forEach((token) => {
    if (!token) return;
    const word = token.replace(/\*$/, '');
    const className = KEYWORD_CLASSES.get(word) || (isForLoop && token === 'A' ? 'syntax-for' : null);
    fragment.append(className ? createElement('span', { className: className, text: token }) : document.createTextNode(token));
  });
  return fragment;
}

let overlayRoot = null;
const getOverlayRoot = () => {
  if (!overlayRoot) overlayRoot = document.getElementById('overlayRoot') || document.body;
  return overlayRoot;
};

// Ouvre une boîte de dialogue. Renvoie une promesse résolue avec la valeur de l'action choisie.
export function openDialog({ title, body, actions = [{ label: 'OK', value: true, isPrimary: true }], onOpen, initialFocus, cancelValue = null }) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const titleId = 'dialog-title-' + Math.random().toString(36).slice(2);
    let isClosed = false;
    const close = (value) => {
      if (isClosed) return;
      isClosed = true;
      layer.remove();
      document.removeEventListener('keydown', handleKeydown, true);
      if (previousFocus && previousFocus.focus) previousFocus.focus({ preventScroll: true });
      resolve(value);
    };
    const actionButtons = actions.map((action) =>
      createElement('button', {
        type: 'button',
        className: 'action-button' + (action.isPrimary ? ' action-button--primary' : '') + (action.isDanger ? ' action-button--danger' : ''),
        text: action.label,
        onClick: async () => {
          if (action.validate) {
            const isValid = await action.validate();
            if (!isValid) return;
          }
          close(typeof action.getValue === 'function' ? action.getValue() : action.value);
        },
      }),
    );
    const modal = createElement('div', { className: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId }, [
      createElement('div', { className: 'modal__header' }, [
        createElement('h2', { className: 'modal__title', id: titleId, text: title }),
        createElement('button', { type: 'button', className: 'icon-button', 'aria-label': 'Fermer', text: '✕', onClick: () => close(cancelValue) }),
      ]),
      createElement('div', { className: 'modal__body' }, body ? [body] : []),
      actions.length ? createElement('div', { className: 'modal__actions' }, actionButtons) : null,
    ]);
    const layer = createElement('div', { className: 'modal-layer' }, [modal]);
    layer.addEventListener('click', (event) => {
      if (event.target === layer) close(cancelValue);
    });
    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(cancelValue);
      } else if (event.key === 'Enter' && event.target.tagName === 'INPUT' && event.target.type !== 'checkbox') {
        const primary = actionButtons[actions.findIndex((action) => action.isPrimary)];
        if (primary) {
          event.preventDefault();
          primary.click();
        }
      }
    };
    document.addEventListener('keydown', handleKeydown, true);
    getOverlayRoot().append(layer);
    if (onOpen) onOpen(close);
    const focusTarget = initialFocus || modal.querySelector('input:not([type=checkbox]), select, textarea') || actionButtons[0];
    if (focusTarget) setTimeout(() => focusTarget.focus(), 30);
  });
}

export function showMessage(title, message) {
  return openDialog({ title: title, body: createElement('p', { className: 'message-text', text: message }) });
}

export function askConfirmation(title, message, confirmLabel = 'Confirmer', cancelLabel = 'Abandonner') {
  return openDialog({
    title: title,
    body: createElement('p', { className: 'message-text', text: message }),
    actions: [
      { label: cancelLabel, value: false },
      { label: confirmLabel, value: true, isPrimary: true },
    ],
    cancelValue: false,
  });
}

export function askText(title, label, defaultValue = '') {
  const input = createElement('input', { type: 'text', value: defaultValue, autocomplete: 'off' });
  return openDialog({
    title: title,
    body: createElement('div', { className: 'field' }, [createElement('label', { className: 'field__label', text: label }), input]),
    actions: [
      { label: 'Annuler', value: null },
      { label: 'OK', isPrimary: true, getValue: () => input.value },
    ],
  });
}

let toastTimer = null;
export function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = createElement('div', { className: 'toast', id: 'toast', role: 'status' });
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

export function createField(labelText, control) {
  const id = control.id || 'field-' + Math.random().toString(36).slice(2);
  control.id = id;
  return createElement('div', { className: 'field' }, [createElement('label', { className: 'field__label', for: id, text: labelText }), control]);
}

export function createCheckField(labelText, isChecked) {
  const checkbox = createElement('input', { type: 'checkbox' });
  checkbox.checked = Boolean(isChecked);
  return { element: createElement('label', { className: 'check-field' }, [checkbox, labelText]), checkbox: checkbox };
}

export function createSelect(options, selectedValue) {
  const select = createElement(
    'select',
    {},
    options.map((option) => {
      const value = typeof option === 'string' ? option : option.value;
      const label = typeof option === 'string' ? option : option.label;
      const element = createElement('option', { value: value, text: label });
      if (value === selectedValue) element.selected = true;
      return element;
    }),
  );
  return select;
}

// Insère un texte à la position du curseur, en plaçant le curseur selon `cursorOffset`.
export function insertAtCursor(input, text, cursorOffset = text.length) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  const position = start + cursorOffset;
  input.focus();
  input.setSelectionRange(position, position);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function downloadFile(fileName, content, mimeType) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = createElement('a', { href: url, download: fileName });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
