// Contrôleur principal d'AlgoBox Mobile.

import { createElement, openDialog, showMessage, askConfirmation, askText, showToast, createField, createCheckField, insertAtCursor } from './domHelpers.js';
import { TreeView } from './treeView.js';
import { TextEditor } from './textEditor.js';
import { TestWindow } from './testWindow.js';
import { DemoView } from './demoView.js';
import * as dialogs from './instructionDialogs.js';
import * as storage from './fileStorage.js';
import * as exporters from './exporters.js';
import { NUMBER_COMMANDS, TEXT_SNIPPETS } from './commandPalette.js';
import { renderGeneralHelp } from './helpContent.js';

const engine = window.AlgoEngine;
const { getNodeType, getLineCapabilities } = engine;
const APP_VERSION = '1.0.0';
const UNTITLED = 'sanstitre';
const ALG_MIME_TYPE = 'application/xml';

const state = {
  algorithm: engine.createAlgorithm(),
  fileName: UNTITLED,
  isModified: false,
  isTextMode: false,
  selectedNode: null,
  clipboardNode: null,
  collapsedNodes: new WeakSet(),
  operationsTab: 'standard',
  isOperationsCollapsed: false,
  preferences: storage.loadPreferences(),
  installPrompt: null,
};

const elements = {
  fileNameLabel: document.getElementById('fileNameLabel'),
  treeView: document.getElementById('treeView'),
  textEditor: document.getElementById('textEditor'),
  textEditorInput: document.getElementById('textEditorInput'),
  textEditorGutter: document.getElementById('textEditorGutter'),
  textEditorStatus: document.getElementById('textEditorStatus'),
  lineActions: document.getElementById('lineActions'),
  textActions: document.getElementById('textActions'),
  operationsPanel: document.getElementById('operationsPanel'),
  operationsTabs: document.getElementById('operationsTabs'),
  operationsContent: document.getElementById('operationsContent'),
  algorithmView: document.getElementById('algorithmView'),
  presentationView: document.getElementById('presentationView'),
  algorithmViewTab: document.getElementById('algorithmViewTab'),
  presentationViewTab: document.getElementById('presentationViewTab'),
  demoView: document.getElementById('demoView'),
  demoViewTab: document.getElementById('demoViewTab'),
  descriptionInput: document.getElementById('descriptionInput'),
  parameterList: document.getElementById('parameterList'),
  buttons: {
    menu: document.getElementById('menuButton'),
    test: document.getElementById('testButton'),
    newLine: document.getElementById('newLineButton'),
    editLine: document.getElementById('editLineButton'),
    deleteLine: document.getElementById('deleteLineButton'),
    copyLine: document.getElementById('copyLineButton'),
    cutLine: document.getElementById('cutLineButton'),
    pasteLine: document.getElementById('pasteLineButton'),
    checkCode: document.getElementById('checkCodeButton'),
    nextField: document.getElementById('nextFieldButton'),
    normalMode: document.getElementById('normalModeButton'),
    changeSettings: document.getElementById('changeSettingsButton'),
  },
};

const treeView = new TreeView(elements.treeView, {
  onSelect: (node) => selectNode(node),
  onActivate: (node) => editSelectedLine(node),
  onToggle: (node) => {
    if (state.collapsedNodes.has(node)) state.collapsedNodes.delete(node);
    else state.collapsedNodes.add(node);
    renderTree();
  },
});

const textEditor = new TextEditor({
  input: elements.textEditorInput,
  gutter: elements.textEditorGutter,
  status: elements.textEditorStatus,
  onChange: () => markModified({ isTreeChanged: false }),
});

const testWindow = new TestWindow({
  getAlgorithm: () => state.algorithm,
  getFileName: () => state.fileName,
  isLightConsole: () => state.preferences.isConsoleLight,
});

/* ------------------------------------------------------------------ */
/* État et rendu                                                       */
/* ------------------------------------------------------------------ */

let sessionTimer = null;

function markModified({ isTreeChanged = true } = {}) {
  state.isModified = true;
  renderTitle();
  if (isTreeChanged) render();
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(saveSessionNow, 400);
}

function saveSessionNow() {
  clearTimeout(sessionTimer);
  storage.saveSession({
    content: engine.serializeAlgFile(state.algorithm),
    fileName: state.fileName,
    isModified: state.isModified,
    isTextMode: state.isTextMode,
    text: state.isTextMode ? textEditor.getText() : null,
  });
}

function setAlgorithm(algorithm, fileName, { isModified = false, textCode = null } = {}) {
  state.algorithm = algorithm;
  state.fileName = fileName || UNTITLED;
  state.isModified = isModified;
  state.collapsedNodes = new WeakSet();
  state.selectedNode = findNodeByText(algorithm, algorithm.currentLineText) || engine.getSections(algorithm).start;
  if (state.isTextMode) textEditor.setText(textCode !== null ? textCode : engine.treeToText(algorithm));
  render();
  saveSessionNow();
}

function findNodeByText(algorithm, text) {
  if (!text) return null;
  let found = null;
  const visit = (node) => {
    if (found) return;
    if (node.text === text) found = node;
    node.children.forEach(visit);
  };
  algorithm.tree.forEach(visit);
  return found;
}

function renderTitle() {
  elements.fileNameLabel.textContent = state.fileName + (state.isModified ? ' [modifié]' : '');
  document.title = 'AlgoBox : ' + state.fileName;
}

function render() {
  renderTitle();
  renderTree();
  renderLineActions();
  renderOperations();
  renderPresentation();
}

function renderTree() {
  if (state.isTextMode) return;
  treeView.render(state.algorithm, state.selectedNode, state.collapsedNodes, state.preferences.hasLineNumbers);
}

function getCapabilities() {
  return getLineCapabilities(state.algorithm, state.selectedNode, Boolean(state.clipboardNode));
}

function renderLineActions() {
  const isTextMode = state.isTextMode;
  elements.treeView.hidden = isTextMode;
  elements.textEditor.hidden = !isTextMode;
  elements.lineActions.hidden = isTextMode;
  elements.textActions.hidden = !isTextMode;
  if (isTextMode) return;
  elements.textEditorStatus.hidden = true;
  const capabilities = getCapabilities();
  const buttons = elements.buttons;
  buttons.newLine.disabled = !capabilities.canAddLine;
  buttons.editLine.disabled = !capabilities.canEditLine;
  buttons.deleteLine.disabled = !capabilities.canRemoveLine;
  buttons.copyLine.disabled = !capabilities.canCopyLine;
  buttons.cutLine.disabled = !capabilities.canCutLine;
  buttons.pasteLine.disabled = !(state.clipboardNode && (capabilities.canPasteLine || capabilities.canAddLine));
}

function selectNode(node) {
  state.selectedNode = node;
  state.algorithm.currentLineText = node ? node.text : '';
  renderTree();
  renderLineActions();
  renderOperations();
}

function renderPresentation() {
  if (document.activeElement !== elements.descriptionInput) elements.descriptionInput.value = state.algorithm.description;
  const settings = state.algorithm.settings;
  elements.parameterList.replaceChildren(
    ...[
      'Arrondi auto : ' + (settings.isAutoRoundingEnabled ? 'vrai' : 'faux'),
      'max itérations par boucles : ' + settings.maxLoopIterations,
      "max itérations pour l'algo : " + settings.maxTotalIterations,
      'max affichage console : ' + settings.maxDisplays,
      'épaisseur lignes : ' + settings.lineWidth,
      'épaisseur points : ' + settings.pointWidth,
      'nb décimales affichées : ' + settings.displayedDigits,
    ].map((text) => createElement('li', { text: text })),
  );
}

/* ------------------------------------------------------------------ */
/* Onglets des opérations                                              */
/* ------------------------------------------------------------------ */

function isAdvancedFunctionUsed() {
  const advanced = state.algorithm.advancedFunction;
  return advanced.isEnabled || advanced.rules.length > 0 || Boolean(advanced.parameters);
}

function getOperationTabs() {
  const tabs = state.isTextMode ? [{ id: 'snippets', label: 'Insérer' }] : [{ id: 'standard', label: 'Opérations standards' }];
  tabs.push({ id: 'numeric', label: 'Utiliser une fonction numérique' }, { id: 'graph', label: 'Dessiner dans un repère' });
  if (!state.isTextMode) tabs.push({ id: 'functions', label: 'Fonctions locales' });
  if (isAdvancedFunctionUsed()) tabs.push({ id: 'advanced', label: 'Fonction avancée' });
  return tabs;
}

function renderOperations() {
  const tabs = getOperationTabs();
  if (!tabs.some((tab) => tab.id === state.operationsTab)) state.operationsTab = tabs[0].id;
  elements.operationsPanel.classList.toggle('operations--collapsed', state.isOperationsCollapsed);
  elements.operationsTabs.replaceChildren(
    ...tabs.map((tab) =>
      createElement('button', {
        type: 'button',
        role: 'tab',
        className: 'operations__tab',
        'aria-selected': String(tab.id === state.operationsTab && !state.isOperationsCollapsed),
        text: tab.label,
        onClick: () => {
          state.isOperationsCollapsed = state.operationsTab === tab.id ? !state.isOperationsCollapsed : false;
          state.operationsTab = tab.id;
          renderOperations();
        },
      }),
    ),
    createElement('button', {
      type: 'button',
      className: 'operations__collapse',
      'aria-label': state.isOperationsCollapsed ? 'Afficher les opérations' : 'Masquer les opérations',
      text: state.isOperationsCollapsed ? '▲' : '▼',
      onClick: () => {
        state.isOperationsCollapsed = !state.isOperationsCollapsed;
        renderOperations();
      },
    }),
  );
  if (state.isOperationsCollapsed) return;
  const renderers = {
    standard: renderStandardOperations,
    snippets: renderSnippetOperations,
    numeric: renderNumericFunctionTab,
    graph: renderGraphTab,
    functions: renderFunctionsTab,
    advanced: renderAdvancedFunctionTab,
  };
  const scrollTop = elements.operationsContent.scrollTop;
  elements.operationsContent.replaceChildren(renderers[state.operationsTab]());
  elements.operationsContent.scrollTop = scrollTop;
}

function operationButton(label, onClick, isEnabled = true) {
  return createElement('button', { type: 'button', className: 'operation-button', text: label, disabled: !isEnabled, onClick: onClick });
}

function canPlaceInstruction() {
  const capabilities = getCapabilities();
  return capabilities.canInsertInstruction || (capabilities.canAddLine && isInsideAlgorithmBody(state.selectedNode));
}

function isInsideAlgorithmBody(node) {
  if (!node) return false;
  const type = getNodeType(node);
  if (type === 200 || type === 202 || type === 100) return false;
  let current = node;
  while (current) {
    const parent = engine.findParent(state.algorithm, current);
    if (!parent) return getNodeType(current) === 101 || getNodeType(current) === 200;
    if (getNodeType(parent) === 200 && getNodeType(current) !== 201) return false;
    current = parent;
  }
  return false;
}

function renderStandardOperations() {
  const canPlace = canPlaceInstruction();
  const children = [
    operationButton('Déclarer nouvelle variable', declareVariable),
    operationButton('Ajouter LIRE variable', () => insertInstruction(dialogs.editRead), canPlace),
    operationButton('AFFECTER valeur à variable', () => insertInstruction(dialogs.editAssignment), canPlace),
    createElement('div', { className: 'operation-separator' }),
    operationButton('Ajouter AFFICHER Variable', () => insertInstruction(dialogs.editDisplayVariable), canPlace),
    operationButton('Ajouter AFFICHER Message', () => insertInstruction(dialogs.editDisplayMessage), canPlace),
    operationButton('Ajouter AFFICHER Calcul', () => insertInstruction(dialogs.editDisplayCalculation), canPlace),
    createElement('div', { className: 'operation-separator' }),
    operationButton('Ajouter SI...ALORS', () => insertInstruction(dialogs.editCondition), canPlace),
    operationButton('Ajouter POUR...DE...A', () => insertInstruction(dialogs.editForLoop), canPlace),
    operationButton('Ajouter TANT QUE...', () => insertInstruction(dialogs.editWhileLoop), canPlace),
    createElement('div', { className: 'operation-separator' }),
    operationButton('Pause', () => insertInstruction(() => Promise.resolve(engine.instructions.pause())), canPlace),
    operationButton('Commentaire', () => insertInstruction(dialogs.editComment), canPlace),
  ];
  const hint = canPlace
    ? null
    : createElement('p', { className: 'operation-hint', text: "Sélectionner une ligne de DEBUT_ALGORITHME (ou d'une fonction) pour ajouter une instruction." });
  return createElement('div', {}, [hint, createElement('div', { className: 'operation-grid' }, children)]);
}

function renderSnippetOperations() {
  return createElement('div', {}, [
    createElement('p', {
      className: 'operation-hint',
      text: "Toucher un modèle pour l'insérer, puis compléter les champs • (bouton « Champ • suivant » ou touche Tab).",
    }),
    createElement(
      'div',
      { className: 'palette__items' },
      TEXT_SNIPPETS.map((snippet) =>
        createElement('button', { type: 'button', className: 'chip', text: snippet.split('\n')[0], onClick: () => textEditor.insertSnippet(snippet) }),
      ),
    ),
  ]);
}

function renderNumericFunctionTab() {
  const numericFunction = state.algorithm.numericFunction;
  const check = createCheckField('Utiliser la fonction F1', numericFunction.isEnabled);
  const expressionInput = createElement('input', {
    type: 'text',
    className: 'mono',
    value: numericFunction.expression,
    autocapitalize: 'off',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  expressionInput.disabled = !numericFunction.isEnabled;
  check.checkbox.addEventListener('change', () => {
    numericFunction.isEnabled = check.checkbox.checked;
    expressionInput.disabled = !numericFunction.isEnabled;
    markModified({ isTreeChanged: false });
    renderOperations();
  });
  expressionInput.addEventListener('input', () => {
    numericFunction.expression = expressionInput.value;
    markModified({ isTreeChanged: false });
  });
  const palette = createElement(
    'div',
    { className: 'palette__items' },
    NUMBER_COMMANDS.filter((command) => !command.label.startsWith('ALGOBOX_')).map((command) =>
      createElement('button', {
        type: 'button',
        className: 'chip',
        title: command.description,
        text: command.label,
        disabled: !numericFunction.isEnabled,
        onClick: () => insertAtCursor(expressionInput, command.insert, command.cursor),
      }),
    ),
  );
  return createElement('div', {}, [
    check.element,
    createField('F1(x)=', expressionInput),
    createElement('p', { className: 'palette__title', text: 'Commandes disponibles' }),
    palette,
    createElement('p', {
      className: 'operation-hint',
      text: "F1(x) peut ensuite être utilisée dans tous les calculs de l'algorithme. Exemple : x*x-2 ou 1/(1+pow(x,2)).",
    }),
  ]);
}

function renderGraphTab() {
  const frame = state.algorithm.frame;
  const check = createCheckField('Utiliser le repère :', frame.isEnabled);
  const fieldNames = [
    ['xMin', 'Xmin :'],
    ['xMax', 'Xmax :'],
    ['xStep', 'Graduations X :'],
    ['yMin', 'Ymin :'],
    ['yMax', 'Ymax :'],
    ['yStep', 'Graduations Y :'],
  ];
  const inputs = fieldNames.map(([key, label]) => {
    const input = createElement('input', { type: 'text', className: 'mono', value: frame[key], inputmode: 'decimal', autocomplete: 'off' });
    input.disabled = !frame.isEnabled;
    input.addEventListener('input', () => {
      frame[key] = input.value;
      markModified({ isTreeChanged: false });
    });
    return createField(label, input);
  });
  check.checkbox.addEventListener('change', () => {
    frame.isEnabled = check.checkbox.checked;
    markModified({ isTreeChanged: false });
    renderOperations();
  });
  const canDraw = frame.isEnabled && (state.isTextMode || canPlaceInstruction());
  const snippetOrInstruction = (snippet, dialogFunction) => () => (state.isTextMode ? textEditor.insertSnippet(snippet) : insertInstruction(dialogFunction));
  return createElement('div', {}, [
    check.element,
    createElement('div', { className: 'inline-fields' }, inputs),
    createElement('div', { className: 'operation-grid' }, [
      operationButton('Ajouter TRACER POINT', snippetOrInstruction('TRACER_POINT_Rouge (•,•)', dialogs.editPoint), canDraw),
      operationButton('Ajouter TRACER SEGMENT', snippetOrInstruction('TRACER_SEGMENT_Rouge (•,•)->(•,•)', dialogs.editSegment), canDraw),
      operationButton(
        'Ajouter EFFACER GRAPHIQUE',
        snippetOrInstruction('EFFACER_GRAPHIQUE', () => Promise.resolve(engine.instructions.clearGraph())),
        canDraw,
      ),
    ]),
  ]);
}

function renderFunctionsTab() {
  const canPlace = canPlaceInstruction();
  return createElement('div', {}, [
    createElement('p', {
      className: 'operation-hint',
      text: 'Une fonction locale se déclare dans FONCTIONS_UTILISEES. Ses variables locales se déclarent sur la ligne VARIABLES_FONCTION ; RENVOYER donne le résultat de la fonction.',
    }),
    createElement('div', { className: 'operation-grid' }, [
      operationButton('Déclarer nouvelle fonction', declareFunction),
      operationButton('Déclarer variable locale', declareLocalVariable),
      operationButton('Ajouter RENVOYER valeur', () => insertInstruction(dialogs.editReturnValue), canPlace),
      operationButton('Appeler Fonction', () => insertInstruction(dialogs.editFunctionCall), canPlace),
    ]),
  ]);
}

function renderAdvancedFunctionTab() {
  const advanced = state.algorithm.advancedFunction;
  const check = createCheckField('Utiliser la fonction F2 avec comme paramètres :', advanced.isEnabled);
  const parametersInput = createElement('input', {
    type: 'text',
    className: 'mono',
    value: advanced.parameters,
    placeholder: 'Séparer les paramètres par une virgule',
  });
  const defaultInput = createElement('input', { type: 'text', className: 'mono', value: advanced.defaultValue });
  const conditionInput = createElement('input', { type: 'text', className: 'mono' });
  const returnInput = createElement('input', { type: 'text', className: 'mono' });
  const update = () => markModified({ isTreeChanged: false });
  check.checkbox.addEventListener('change', () => {
    advanced.isEnabled = check.checkbox.checked;
    update();
  });
  parametersInput.addEventListener('input', () => {
    advanced.parameters = parametersInput.value;
    update();
  });
  defaultInput.addEventListener('input', () => {
    advanced.defaultValue = defaultInput.value;
    update();
  });
  const moveRule = (index, offset) => {
    const target = index + offset;
    if (target < 0 || target >= advanced.rules.length) return;
    [advanced.rules[index], advanced.rules[target]] = [advanced.rules[target], advanced.rules[index]];
    update();
    renderOperations();
  };
  const ruleItems = advanced.rules.map((rule, index) =>
    createElement('li', {}, [
      createElement('span', { className: 'rule-list__text', text: 'SI (' + rule.condition + ') RENVOYER ' + rule.returnValue }),
      createElement('button', { type: 'button', className: 'icon-button', 'aria-label': 'Vers le haut', text: '↑', onClick: () => moveRule(index, -1) }),
      createElement('button', { type: 'button', className: 'icon-button', 'aria-label': 'Vers le bas', text: '↓', onClick: () => moveRule(index, 1) }),
      createElement('button', {
        type: 'button',
        className: 'icon-button',
        'aria-label': 'Supprimer',
        text: '✕',
        onClick: () => {
          advanced.rules.splice(index, 1);
          update();
          renderOperations();
        },
      }),
    ]),
  );
  return createElement('div', {}, [
    check.element,
    createField('Paramètres', parametersInput),
    ruleItems.length ? createElement('ul', { className: 'rule-list' }, ruleItems) : null,
    createElement('div', { className: 'inline-fields' }, [createField('Si', conditionInput), createField('renvoyer', returnInput)]),
    operationButton('Ajouter', () => {
      if (!conditionInput.value.trim() || !returnInput.value.trim()) return;
      advanced.rules.push({ condition: conditionInput.value.replace(/[#@]/g, ''), returnValue: returnInput.value.replace(/[#@]/g, '') });
      update();
      renderOperations();
    }),
    createField('Dans les autres cas, renvoyer', defaultInput),
  ]);
}

/* ------------------------------------------------------------------ */
/* Édition de l'arbre                                                  */
/* ------------------------------------------------------------------ */

// Place une instruction sur la ligne vide sélectionnée, ou sur une nouvelle ligne.
async function insertInstruction(createInstruction) {
  if (state.isTextMode) return;
  const capabilities = getCapabilities();
  if (!capabilities.canInsertInstruction && !(capabilities.canAddLine && isInsideAlgorithmBody(state.selectedNode))) {
    showToast("Sélectionner d'abord une ligne de l'algorithme.");
    return;
  }
  const node = await createInstruction({ algorithm: state.algorithm });
  if (!node) return;
  let target = state.selectedNode;
  if (!capabilities.canInsertInstruction) target = engine.insertNewLine(state.algorithm, target);
  if (!target) return;
  engine.replaceNode(state.algorithm, target, node);
  const blockStart = node.children.find((child) => [7, 13, 16].includes(getNodeType(child)));
  state.selectedNode = blockStart || node;
  markModified();
  treeView.scrollToSelected();
}

async function declareVariable() {
  if (state.isTextMode) {
    textEditor.insertSnippet('• EST_DU_TYPE NOMBRE');
    return;
  }
  const declaration = await dialogs.askVariableDeclaration();
  if (!declaration) return;
  if (engine.isForbiddenName(declaration.name, state.algorithm)) {
    showMessage('Erreur', 'Nom de variable interdit');
    return;
  }
  const sections = engine.getSections(state.algorithm);
  sections.variables.children.push(engine.instructions.variable(declaration.name, declaration.type));
  if (!state.selectedNode || state.selectedNode === sections.variables) state.selectedNode = sections.start;
  markModified();
}

function findEnclosingFunction(node) {
  let current = node;
  while (current) {
    if (getNodeType(current) === 201) return current;
    current = engine.findParent(state.algorithm, current);
  }
  return null;
}

async function declareLocalVariable() {
  const functionNode = findEnclosingFunction(state.selectedNode);
  if (!functionNode) {
    showMessage('AlgoBox', "Sélectionner d'abord la ligne VARIABLES_FONCTION (ou une ligne) de la fonction concernée.");
    return;
  }
  const declaration = await dialogs.askVariableDeclaration('Déclarer une variable locale');
  if (!declaration) return;
  if (engine.isForbiddenName(declaration.name, state.algorithm)) {
    showMessage('Erreur', 'Nom de variable interdit');
    return;
  }
  let localBlock = functionNode.children.find((child) => getNodeType(child) === 202);
  if (!localBlock) {
    localBlock = engine.createNode('VARIABLES_FONCTION', '202#declarationsvariablesfonction');
    functionNode.children.unshift(localBlock);
  }
  localBlock.children.push(engine.instructions.variable(declaration.name, declaration.type));
  markModified();
}

async function declareFunction() {
  const node = await dialogs.editFunctionDeclaration({ algorithm: state.algorithm });
  if (!node) return;
  const functionsSection = engine.getSections(state.algorithm).functions;
  const selected = state.selectedNode;
  const isEmptyLineInFunctions = selected && selected.text === '' && engine.findParent(state.algorithm, selected) === functionsSection;
  if (isEmptyLineInFunctions) engine.replaceNode(state.algorithm, selected, node);
  else functionsSection.children.push(node);
  state.collapsedNodes.delete(functionsSection);
  state.selectedNode = node.children.find((child) => child.text === '') || node;
  markModified();
  treeView.scrollToSelected();
}

function addNewLine() {
  const newLine = engine.insertNewLine(state.algorithm, state.selectedNode);
  if (!newLine) {
    showToast("Impossible d'ajouter une ligne à cet endroit.");
    return;
  }
  state.selectedNode = newLine;
  markModified();
  treeView.scrollToSelected();
}

async function editSelectedLine(node = state.selectedNode) {
  if (!node || !getLineCapabilities(state.algorithm, node).canEditLine) return;
  const replacement = await dialogs.editExistingNode({ algorithm: state.algorithm }, node);
  if (!replacement) return;
  engine.updateNode(node, replacement);
  markModified();
}

function getDeletionMessage(node) {
  const type = getNodeType(node);
  if (type === 1)
    return "Etes-vous sûr de vouloir supprimer la déclaration de cette variable?\n(si elle est utilisée dans le reste du code, l'algorithme ne pourra plus fonctionner)";
  if ([6, 12, 15, 201].includes(type))
    return "La suppression de cette ligne entrainera la suppression de tout le bloc qui en dépend.\nEtes-vous sûr de vouloir supprimer tout ce bloc d'instructions?";
  return 'Etes-vous sûr de vouloir supprimer cette ligne?';
}

async function deleteSelectedLine({ isCut = false } = {}) {
  const node = state.selectedNode;
  if (!node || !getCapabilities().canRemoveLine) return;
  if (node.text !== '') {
    const isConfirmed = await askConfirmation('AlgoBox', getDeletionMessage(node), 'Confirmer la suppression', 'Abandonner');
    if (!isConfirmed) return;
  }
  if (isCut) state.clipboardNode = engine.cloneNode(node);
  state.selectedNode = engine.removeNode(state.algorithm, node);
  markModified();
}

function copySelectedLine() {
  if (!getCapabilities().canCopyLine) return;
  state.clipboardNode = engine.cloneNode(state.selectedNode);
  showToast('Ligne copiée');
  renderLineActions();
}

function pasteLine() {
  if (!state.clipboardNode) return;
  const capabilities = getCapabilities();
  let target = state.selectedNode;
  if (!capabilities.canPasteLine) {
    if (!capabilities.canAddLine) return;
    target = engine.insertNewLine(state.algorithm, target);
    if (!target) return;
  }
  const pasted = engine.cloneNode(state.clipboardNode);
  engine.replaceNode(state.algorithm, target, pasted);
  state.selectedNode = pasted;
  markModified();
}

/* ------------------------------------------------------------------ */
/* Mode éditeur de texte                                               */
/* ------------------------------------------------------------------ */

// Analyse le code texte ; renvoie true si l'arbre a été mis à jour.
function applyTextCode({ isSilentOnSuccess = true } = {}) {
  try {
    const algorithm = engine.textToTree(textEditor.getText(), state.algorithm);
    state.algorithm.tree = algorithm.tree;
    if (!isSilentOnSuccess) textEditor.showStatus('Le code est valide (' + engine.numberLines(state.algorithm).length + " lignes dans l'arbre).", 'success');
    return true;
  } catch (error) {
    if (!(error instanceof engine.TextSyntaxError)) throw error;
    textEditor.showStatus('Erreur détectée : ' + error.message, 'error');
    textEditor.selectLine(error.line);
    return false;
  }
}

function setTextMode(isTextMode) {
  if (isTextMode === state.isTextMode) return;
  if (isTextMode) {
    textEditor.setText(engine.treeToText(state.algorithm));
    state.isTextMode = true;
  } else {
    if (!applyTextCode()) {
      showMessage('Erreur', "Le code n'est pas valide. Impossible de revenir au mode normal.\n" + elements.textEditorStatus.textContent);
      return;
    }
    state.isTextMode = false;
    state.selectedNode = engine.getSections(state.algorithm).start;
  }
  state.preferences.isTextMode = state.isTextMode;
  storage.savePreferences(state.preferences);
  render();
  saveSessionNow();
}

// Avant de tester, d'enregistrer ou d'exporter : le code texte doit être valide.
function ensureTreeIsCurrent(actionLabel) {
  if (!state.isTextMode) return true;
  if (applyTextCode()) return true;
  showMessage('Erreur', "Le code n'est pas valide. Impossible " + actionLabel + '.\n' + elements.textEditorStatus.textContent);
  return false;
}

/* ------------------------------------------------------------------ */
/* Fichiers                                                            */
/* ------------------------------------------------------------------ */

async function confirmDiscardChanges() {
  if (!state.isModified) return true;
  const choice = await openDialog({
    title: 'AlgoBox',
    body: createElement('p', { className: 'message-text', text: "L'algorithme « " + state.fileName + " » a été modifié.\nVoulez-vous l'enregistrer ?" }),
    actions: [
      { label: 'Annuler', value: 'cancel' },
      { label: 'Ne pas enregistrer', value: 'discard' },
      { label: 'Enregistrer', value: 'save', isPrimary: true },
    ],
    cancelValue: 'cancel',
  });
  if (choice === 'save') return saveAlgorithm();
  return choice === 'discard';
}

async function createNewAlgorithm() {
  if (!(await confirmDiscardChanges())) return;
  setAlgorithm(engine.createAlgorithm(), UNTITLED);
}

function openAlgorithmContent(content, fileName) {
  try {
    const algorithm = engine.parseAlgFile(content);
    setAlgorithm(algorithm, storage.getBaseName(fileName));
    showToast('Algorithme « ' + state.fileName + ' » ouvert');
    return true;
  } catch (error) {
    showMessage('Erreur', "Impossible d'ouvrir ce fichier.\n" + error.message);
    return false;
  }
}

async function openFromDevice() {
  if (!(await confirmDiscardChanges())) return;
  const file = await storage.pickFile('.alg,.xml,application/xml,text/xml');
  if (!file) return;
  const content = await storage.readFileAsText(file);
  if (/\.txt$/i.test(file.name) || !/<Algo[\s>]/.test(content)) openTextCode(content, file.name);
  else openAlgorithmContent(content, file.name);
}

async function openTextCodeFromDevice() {
  if (!(await confirmDiscardChanges())) return;
  const file = await storage.pickFile('.txt,text/plain');
  if (!file) return;
  openTextCode(await storage.readFileAsText(file), file.name);
}

function openTextCode(text, fileName) {
  state.isTextMode = true;
  setAlgorithm(engine.createAlgorithm(), storage.getBaseName(fileName), { textCode: text, isModified: true });
  applyTextCode({ isSilentOnSuccess: false });
}

async function saveAlgorithm() {
  if (state.fileName === UNTITLED) return saveAlgorithmAs();
  if (!ensureTreeIsCurrent("d'enregistrer l'algorithme")) return false;
  state.algorithm.currentLineText = state.selectedNode ? state.selectedNode.text : '';
  if (!storage.saveToLibrary(state.fileName, engine.serializeAlgFile(state.algorithm))) {
    showMessage('Erreur', "L'enregistrement sur l'appareil a échoué (espace de stockage plein ou désactivé). Utiliser « Télécharger le fichier .alg ».");
    return false;
  }
  state.isModified = false;
  renderTitle();
  saveSessionNow();
  showToast("Algorithme enregistré sur l'appareil");
  return true;
}

async function saveAlgorithmAs() {
  if (!ensureTreeIsCurrent("d'enregistrer l'algorithme")) return false;
  const answer = await askText('Sauver sous', "Nom de l'algorithme :", state.fileName === UNTITLED ? '' : state.fileName);
  if (answer === null) return false;
  const name = storage.getBaseName(answer);
  if (name === UNTITLED && !answer.trim()) return false;
  if (name !== state.fileName && storage.hasLibraryEntry(name)) {
    const isConfirmed = await askConfirmation('Sauver sous', 'Un algorithme nommé « ' + name + ' » existe déjà. Le remplacer ?', 'Remplacer', 'Annuler');
    if (!isConfirmed) return false;
  }
  state.fileName = name;
  return saveAlgorithm();
}

async function shareAlgorithmFile(isShareRequested) {
  if (!ensureTreeIsCurrent("d'exporter l'algorithme")) return;
  await storage.shareOrDownloadFile(state.fileName + '.alg', engine.serializeAlgFile(state.algorithm), ALG_MIME_TYPE, isShareRequested);
}

function formatUpdateDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('fr-FR') + ' à ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function openLibrary() {
  const entries = storage.listLibrary();
  const list = createElement('ul', { className: 'library-list' });
  let closeDialog = null;
  const renderEntries = () => {
    const items = storage.listLibrary().map((entry) =>
      createElement('li', { className: 'library-item' }, [
        createElement(
          'button',
          {
            type: 'button',
            className: 'library-item__open',
            onClick: async () => {
              closeDialog();
              if (!(await confirmDiscardChanges())) return;
              openAlgorithmContent(entry.content, entry.name);
            },
          },
          [
            createElement('span', { className: 'library-item__name', text: entry.name }),
            createElement('span', { className: 'library-item__date', text: 'Modifié le ' + formatUpdateDate(entry.updatedAt) }),
          ],
        ),
        createElement('button', {
          type: 'button',
          className: 'icon-button',
          'aria-label': 'Télécharger ' + entry.name,
          text: '⤓',
          onClick: () => storage.shareOrDownloadFile(entry.name + '.alg', entry.content, ALG_MIME_TYPE, true),
        }),
        createElement('button', {
          type: 'button',
          className: 'icon-button',
          'aria-label': 'Supprimer ' + entry.name,
          text: '🗑',
          onClick: async () => {
            if (!(await askConfirmation('Mes algorithmes', 'Supprimer définitivement « ' + entry.name + " » de l'appareil ?", 'Supprimer', 'Annuler'))) return;
            storage.deleteFromLibrary(entry.name);
            renderEntries();
          },
        }),
      ]),
    );
    list.replaceChildren(
      ...(items.length
        ? items
        : [createElement('li', { className: 'operation-hint', text: 'Aucun algorithme enregistré sur cet appareil. Utiliser « Sauver » pour en ajouter.' })]),
    );
  };
  renderEntries();
  openDialog({
    title: 'Mes algorithmes (' + entries.length + ')',
    body: list,
    actions: [{ label: 'Fermer', value: null, isPrimary: true }],
    onOpen: (close) => (closeDialog = close),
  });
}

function openExamples() {
  const { EXAMPLES, createExampleAlgorithm } = window.AlgoExamples;
  let closeDialog = null;
  const list = createElement(
    'ul',
    { className: 'library-list' },
    EXAMPLES.map((example) =>
      createElement('li', { className: 'library-item' }, [
        createElement(
          'button',
          {
            type: 'button',
            className: 'library-item__open',
            onClick: async () => {
              closeDialog();
              if (!(await confirmDiscardChanges())) return;
              setAlgorithm(createExampleAlgorithm(engine, example), example.fileName);
              showToast('Exemple « ' + example.title + ' » ouvert');
            },
          },
          [
            createElement('span', { className: 'library-item__name', text: example.title }),
            createElement('span', { className: 'library-item__date', text: example.description.split('\n')[0] }),
          ],
        ),
      ]),
    ),
  );
  openDialog({
    title: 'Ouvrir un exemple',
    body: list,
    actions: [{ label: 'Fermer', value: null, isPrimary: true }],
    onOpen: (close) => (closeDialog = close),
  });
}

async function exportWebPage() {
  if (!ensureTreeIsCurrent("d'exporter l'algorithme")) return;
  try {
    const page = await exporters.buildWebPageExport(state.algorithm, state.fileName);
    await storage.shareOrDownloadFile(state.fileName + '.html', page, 'text/html', true);
  } catch (error) {
    showMessage('Erreur', "L'export vers une page web a échoué.\n" + error.message);
  }
}

async function exportText() {
  if (!ensureTreeIsCurrent("d'exporter l'algorithme")) return;
  await storage.shareOrDownloadFile(state.fileName + '.txt', exporters.buildTextExport(state.algorithm, state.fileName), 'text/plain', true);
}

async function exportLatex() {
  if (!ensureTreeIsCurrent("d'exporter l'algorithme")) return;
  await storage.shareOrDownloadFile(state.fileName + '.tex', exporters.buildLatexExport(state.algorithm, state.fileName), 'application/x-tex', true);
}

async function exportImage() {
  if (!ensureTreeIsCurrent("d'exporter l'algorithme")) return;
  const image = await exporters.buildTreeImage(state.algorithm);
  await storage.shareOrDownloadFile(state.fileName + '.png', image, 'image/png', true);
}

function printCurrentAlgorithm() {
  if (!ensureTreeIsCurrent("d'imprimer l'algorithme")) return;
  exporters.printAlgorithm(state.algorithm, state.fileName);
}

/* ------------------------------------------------------------------ */
/* Test, options, menu                                                 */
/* ------------------------------------------------------------------ */

function openTestWindow() {
  if (!ensureTreeIsCurrent("de lancer l'algorithme")) return;
  testWindow.open();
}

async function changeExecutionSettings() {
  const updated = await dialogs.editExecutionSettings(state.algorithm.settings);
  if (!updated) return;
  Object.assign(state.algorithm.settings, updated);
  markModified({ isTreeChanged: false });
  renderPresentation();
}

const demoView = new DemoView();

// Trois vues : « algorithm » (arbre), « presentation » (cadre Présentation) et « demo ».
function showView(view) {
  const views = [
    { name: 'algorithm', panel: elements.algorithmView, tab: elements.algorithmViewTab },
    { name: 'presentation', panel: elements.presentationView, tab: elements.presentationViewTab },
    { name: 'demo', panel: elements.demoView, tab: elements.demoViewTab },
  ];
  views.forEach(({ name, panel, tab }) => {
    panel.hidden = name !== view;
    tab.setAttribute('aria-selected', String(name === view));
  });
  if (view === 'presentation') renderPresentation();
  if (view === 'demo') demoView.show();
  else demoView.hide();
}

function applyTheme() {
  const theme = state.preferences.theme;
  if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
  else document.documentElement.removeAttribute('data-theme');
}

function togglePreference(key) {
  state.preferences[key] = !state.preferences[key];
  storage.savePreferences(state.preferences);
  render();
}

function showAbout() {
  openDialog({
    title: "À propos d'AlgoBox Mobile",
    body: createElement('div', { className: 'help-text' }, [
      createElement('p', { text: 'AlgoBox Mobile ' + APP_VERSION + ' (moteur compatible AlgoBox ' + engine.ENGINE_VERSION + ').' }),
      createElement('p', {
        text: "Éditeur et testeur d'algorithmes pour téléphone, compatible avec la syntaxe et les fichiers .alg d'AlgoBox, le logiciel libre de Pascal Brachet (xm1math.net/algobox).",
      }),
      createElement('p', { text: "Application indépendante : elle fonctionne hors ligne et les algorithmes restent enregistrés sur l'appareil." }),
    ]),
  });
}

function showInstallHelp() {
  if (state.installPrompt) {
    state.installPrompt.prompt();
    state.installPrompt.userChoice.finally(() => (state.installPrompt = null));
    return;
  }
  showMessage(
    "Installer l'application",
    "Sur iPhone ou iPad (Safari) : bouton Partager, puis « Sur l'écran d'accueil ».\nSur Android (Chrome) : menu ⋮, puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».\nUne fois installée, l'application fonctionne sans connexion.",
  );
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function openMenu() {
  const themeLabels = { auto: 'automatique', light: 'clair', dark: 'sombre' };
  const item = (label, onClick, options = {}) =>
    createElement('button', {
      type: 'button',
      className: 'drawer__item',
      role: options.isCheckable ? 'menuitemcheckbox' : 'menuitem',
      'aria-checked': options.isCheckable ? String(Boolean(options.isChecked)) : null,
      disabled: options.isDisabled,
      text: label,
      onClick: () => {
        closeMenu();
        onClick();
      },
    });
  const section = (title) => createElement('p', { className: 'drawer__section', text: title });
  const capabilities = getCapabilities();
  const drawer = createElement('nav', { className: 'drawer', role: 'menu', 'aria-label': 'Menu principal' }, [
    createElement('div', { className: 'drawer__brand' }, [createElement('img', { src: 'app-icons/icon-192.png', alt: '' }), 'AlgoBox']),
    section('Fichier'),
    item('Nouveau', createNewAlgorithm),
    item('Ouvrir…', openFromDevice),
    item('Ouvrir code texte…', openTextCodeFromDevice),
    item('Mes algorithmes', openLibrary),
    item('Ouvrir un exemple', openExamples),
    item('Sauver', saveAlgorithm),
    item('Sauver sous…', saveAlgorithmAs),
    item('Télécharger le fichier .alg', () => shareAlgorithmFile(false)),
    item('Partager le fichier .alg', () => shareAlgorithmFile(true)),
    item('Exporter algorithme complet vers page web', exportWebPage),
    item('Exporter code vers fichier texte', exportText),
    item('Exporter code vers document LaTeX', exportLatex),
    item("Copie d'écran de l'algorithme", exportImage),
    item('Imprimer algorithme', printCurrentAlgorithm),
    section('Edition'),
    item('Copier Ligne', copySelectedLine, { isDisabled: state.isTextMode || !capabilities.canCopyLine }),
    item('Couper Ligne', () => deleteSelectedLine({ isCut: true }), { isDisabled: state.isTextMode || !capabilities.canCutLine }),
    item('Coller Ligne', pasteLine, { isDisabled: state.isTextMode || !state.clipboardNode }),
    item('Mode normal', () => setTextMode(false), { isCheckable: true, isChecked: !state.isTextMode }),
    item('Mode éditeur texte', () => setTextMode(true), { isCheckable: true, isChecked: state.isTextMode }),
    section('Affichage'),
    item('Numéros de ligne', () => togglePreference('hasLineNumbers'), { isCheckable: true, isChecked: state.preferences.hasLineNumbers }),
    item('Console « Résultats » claire', () => togglePreference('isConsoleLight'), { isCheckable: true, isChecked: state.preferences.isConsoleLight }),
    item('Thème : ' + themeLabels[state.preferences.theme], () => {
      const order = ['auto', 'light', 'dark'];
      state.preferences.theme = order[(order.indexOf(state.preferences.theme) + 1) % order.length];
      storage.savePreferences(state.preferences);
      applyTheme();
    }),
    section('Options'),
    item('Configurer exécution des algorithmes', changeExecutionSettings),
    section('Aide'),
    item('Aide', () => openDialog({ title: 'Aide', body: renderGeneralHelp(), actions: [{ label: 'Fermer', value: null, isPrimary: true }] })),
    item('Démo vidéo (tutoriel)', () => showView('demo')),
    item('Tutoriel en ligne', () => window.open('https://www.xm1math.net/algobox/tutoalgobox/index.html', '_blank', 'noopener')),
    item("À propos d'AlgoBox Mobile", showAbout),
    isStandalone() ? null : section('Application'),
    isStandalone() ? null : item("Installer l'application", showInstallHelp),
  ]);
  const layer = createElement('div', { className: 'drawer-layer' }, [drawer]);
  const closeMenu = () => {
    layer.remove();
    document.removeEventListener('keydown', handleEscape, true);
    elements.buttons.menu.focus();
  };
  const handleEscape = (event) => {
    if (event.key === 'Escape') closeMenu();
  };
  layer.addEventListener('click', (event) => {
    if (event.target === layer) closeMenu();
  });
  document.addEventListener('keydown', handleEscape, true);
  document.getElementById('overlayRoot').append(layer);
  const firstItem = drawer.querySelector('.drawer__item');
  if (firstItem) firstItem.focus();
}

/* ------------------------------------------------------------------ */
/* Clavier (écrans avec clavier physique)                              */
/* ------------------------------------------------------------------ */

function handleGlobalKeydown(event) {
  if (testWindow.isOpen() || document.querySelector('.modal-layer, .drawer-layer')) return;
  const isEditingText = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
  const isShortcut = event.ctrlKey || event.metaKey;
  if (isShortcut && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveAlgorithm();
  } else if (isShortcut && event.key === 'Enter' && !state.isTextMode) {
    event.preventDefault();
    addNewLine();
  } else if (isShortcut && event.key.toLowerCase() === 'd' && !state.isTextMode) {
    event.preventDefault();
    declareVariable();
  } else if (!isEditingText && !state.isTextMode) {
    const visibleNodes = treeView.getVisibleNodes();
    const index = visibleNodes.indexOf(state.selectedNode);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = visibleNodes[Math.min(visibleNodes.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))];
      if (next) {
        selectNode(next);
        treeView.scrollToSelected();
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      editSelectedLine();
    } else if (event.key === 'Delete') {
      event.preventDefault();
      deleteSelectedLine();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Démarrage                                                           */
/* ------------------------------------------------------------------ */

function bindEvents() {
  const buttons = elements.buttons;
  buttons.menu.addEventListener('click', openMenu);
  buttons.test.addEventListener('click', openTestWindow);
  buttons.newLine.addEventListener('click', addNewLine);
  buttons.editLine.addEventListener('click', () => editSelectedLine());
  buttons.deleteLine.addEventListener('click', () => deleteSelectedLine());
  buttons.copyLine.addEventListener('click', copySelectedLine);
  buttons.cutLine.addEventListener('click', () => deleteSelectedLine({ isCut: true }));
  buttons.pasteLine.addEventListener('click', pasteLine);
  buttons.checkCode.addEventListener('click', () => applyTextCode({ isSilentOnSuccess: false }));
  buttons.nextField.addEventListener('click', () => textEditor.selectNextField() || showToast('Aucun champ • à compléter'));
  buttons.normalMode.addEventListener('click', () => setTextMode(false));
  buttons.changeSettings.addEventListener('click', changeExecutionSettings);
  elements.algorithmViewTab.addEventListener('click', () => showView('algorithm'));
  elements.presentationViewTab.addEventListener('click', () => showView('presentation'));
  elements.demoViewTab.addEventListener('click', () => showView('demo'));
  elements.descriptionInput.addEventListener('input', () => {
    state.algorithm.description = elements.descriptionInput.value;
    markModified({ isTreeChanged: false });
  });
  document.addEventListener('keydown', handleGlobalKeydown);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveSessionNow();
  });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.installPrompt = event;
  });
}

function restoreSession() {
  const session = storage.loadSession();
  if (!session || !session.content) return false;
  try {
    state.isTextMode = Boolean(session.isTextMode);
    setAlgorithm(engine.parseAlgFile(session.content), session.fileName, {
      isModified: session.isModified,
      textCode: session.isTextMode ? session.text : null,
    });
    return true;
  } catch {
    state.isTextMode = false;
    return false;
  }
}

// Fichiers .alg ouverts depuis le système (application installée sur ordinateur).
function handleLaunchedFiles() {
  if (!('launchQueue' in window)) return;
  window.launchQueue.setConsumer(async (launchParams) => {
    const handle = launchParams.files && launchParams.files[0];
    if (!handle) return;
    const file = await handle.getFile();
    openAlgorithmContent(await storage.readFileAsText(file), file.name);
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker
    .register('serviceWorker.js')
    .then((registration) => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showToast("Nouvelle version disponible : relancer l'application pour l'utiliser.");
          }
        });
      });
    })
    .catch(() => {
      // Sans service worker l'application fonctionne, mais pas hors ligne.
    });
}

function start() {
  applyTheme();
  bindEvents();
  if (!restoreSession()) {
    state.isTextMode = false;
    setAlgorithm(engine.createAlgorithm(), UNTITLED);
  }
  handleLaunchedFiles();
  registerServiceWorker();
}

start();
