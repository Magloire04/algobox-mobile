// Boîtes de saisie des instructions, avec les mêmes intitulés que dans AlgoBox.
// Chaque fonction renvoie une promesse : la ligne construite, ou null si l'utilisateur annule.

import { createElement, openDialog, showMessage, createField, createCheckField, createSelect, insertAtCursor } from './domHelpers.js';
import { OPERATORS, COMPARISONS, NUMBER_COMMANDS, LIST_COMMANDS, STRING_COMMANDS, getAlgorithmCommands } from './commandPalette.js';
import { renderAssignmentHelp, renderConditionHelp, renderLoopHelp } from './helpContent.js';

const { instructions } = window.AlgoEngine;

const createTextInput = (value, isMonospace = true) =>
  createElement('input', {
    type: 'text',
    value: value || '',
    className: isMonospace ? 'mono' : '',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
  });

function createPaletteSection(title, commands, getTarget, className) {
  return createElement('div', {}, [
    createElement('p', { className: 'palette__title', text: title }),
    createElement(
      'div',
      { className: 'palette__items' },
      commands.map((item) =>
        createElement('button', {
          type: 'button',
          className: 'chip' + (className ? ' ' + className : ''),
          title: item.description || '',
          text: item.label,
          onClick: () => {
            const target = getTarget();
            if (target) insertAtCursor(target, item.insert, item.cursor);
          },
        }),
      ),
    ),
  ]);
}

// Palette « Opérations / Commandes / Variables déclarées » reliée au dernier champ actif.
function createExpressionPalette(context, inputs, options = {}) {
  let activeInput = inputs[0];
  inputs.forEach((input) => input.addEventListener('focus', () => (activeInput = input)));
  const getTarget = () => activeInput;
  const variables = AlgoEngine.listVariables(context.algorithm);
  const sections = [createPaletteSection('Opérations', options.hasComparisons ? OPERATORS.concat(COMPARISONS) : OPERATORS, getTarget)];
  if (variables.length) {
    sections.push(
      createPaletteSection(
        'Variables déclarées',
        variables.map((variable) => ({ label: variable.name, insert: variable.name, description: 'variable du type ' + variable.type })),
        getTarget,
        'chip--variable',
      ),
    );
  }
  const algorithmCommands = getAlgorithmCommands(context.algorithm, AlgoEngine.listFunctions(context.algorithm));
  sections.push(createPaletteSection('Commandes', algorithmCommands.concat(NUMBER_COMMANDS), getTarget));
  sections.push(createPaletteSection('Listes', LIST_COMMANDS, getTarget));
  sections.push(createPaletteSection('Chaînes', STRING_COMMANDS, getTarget));
  return createElement('div', { className: 'palette' }, sections);
}

function createHelpToggle(helpContent) {
  const details = createElement('details', { className: 'help-text' }, [createElement('summary', { text: 'Aide' })]);
  details.append(helpContent());
  return details;
}

const OK_CANCEL = (getValue, validate) => [
  { label: 'Annuler', value: null },
  { label: 'OK', isPrimary: true, getValue: getValue, validate: validate },
];

function requireVariables(context) {
  const variables = AlgoEngine.listVariables(context.algorithm);
  if (!variables.length) {
    showMessage('AlgoBox', "Aucune variable n'a encore été déclarée.");
    return null;
  }
  return variables;
}

function createVariableSelector(variables, selectedName, onChange) {
  const select = createSelect(
    variables.map((variable) => ({ value: variable.name, label: variable.name + ' (' + variable.type + ')' })),
    selectedName,
  );
  select.addEventListener('change', onChange);
  return select;
}

export function askVariableDeclaration(title = 'Déclarer une variable') {
  const nameInput = createTextInput('');
  const typeSelect = createSelect(AlgoEngine.VARIABLE_TYPES, 'NOMBRE');
  return openDialog({
    title: title,
    body: createElement('div', {}, [createField('Nom de la variable :', nameInput), createField('Type de variable :', typeSelect)]),
    actions: OK_CANCEL(() => ({ name: AlgoEngine.sanitizeVariableName(nameInput.value), type: typeSelect.value })),
  });
}

export function editRead(context, current = {}) {
  const variables = requireVariables(context);
  if (!variables) return Promise.resolve(null);
  const rankInput = createTextInput(current.rank);
  const rankField = createField('Rang du terme de la liste :', rankInput);
  const typeOf = (name) => variables.find((variable) => variable.name === name).type;
  const select = createVariableSelector(variables, current.name, () => (rankField.hidden = typeOf(select.value) !== 'LISTE'));
  rankField.hidden = typeOf(select.value) !== 'LISTE';
  return openDialog({
    title: 'Lire une variable',
    body: createElement('div', {}, [createField('LIRE la variable :', select), rankField]),
    actions: OK_CANCEL(
      () => instructions.read(select.value, typeOf(select.value) === 'LISTE' ? rankInput.value.replace(/#/g, '').trim() : ''),
      () => typeOf(select.value) !== 'LISTE' || Boolean(rankInput.value.trim()) || (showMessage('AlgoBox', 'Indiquer le rang du terme de la liste.'), false),
    ),
  });
}

export function editDisplayVariable(context, current = {}) {
  const variables = requireVariables(context);
  if (!variables) return Promise.resolve(null);
  const rankInput = createTextInput(current.rank);
  const rankField = createField('Rang du terme de la liste :', rankInput);
  const newline = createCheckField('Ajouter un retour à la ligne', current.hasNewline);
  const typeOf = (name) => variables.find((variable) => variable.name === name).type;
  const select = createVariableSelector(variables, current.name, () => (rankField.hidden = typeOf(select.value) !== 'LISTE'));
  rankField.hidden = typeOf(select.value) !== 'LISTE';
  return openDialog({
    title: 'Afficher une variable',
    body: createElement('div', {}, [createField('AFFICHER la variable :', select), newline.element, rankField]),
    actions: OK_CANCEL(
      () =>
        instructions.displayVariable(select.value, newline.checkbox.checked, typeOf(select.value) === 'LISTE' ? rankInput.value.replace(/#/g, '').trim() : ''),
      () => typeOf(select.value) !== 'LISTE' || Boolean(rankInput.value.trim()) || (showMessage('AlgoBox', 'Indiquer le rang du terme de la liste.'), false),
    ),
  });
}

export function editDisplayMessage(context, current = {}) {
  const messageInput = createTextInput(current.message, false);
  const newline = createCheckField('Ajouter un retour à la ligne', current.hasNewline);
  return openDialog({
    title: 'Afficher un message',
    body: createElement('div', {}, [createField('AFFICHER le message :', messageInput), newline.element]),
    actions: OK_CANCEL(() => instructions.displayMessage(messageInput.value.replace(/"/g, ''), newline.checkbox.checked)),
  });
}

export function editDisplayCalculation(context, current = {}) {
  const expressionInput = createTextInput(current.expression);
  const newline = createCheckField('Ajouter un retour à la ligne', current.hasNewline);
  return openDialog({
    title: 'Afficher un calcul',
    body: createElement('div', {}, [
      createField('AFFICHER le calcul :', expressionInput),
      newline.element,
      createExpressionPalette(context, [expressionInput]),
      createHelpToggle(renderAssignmentHelp),
    ]),
    actions: OK_CANCEL(
      () => instructions.displayCalculation(expressionInput.value.trim(), newline.checkbox.checked),
      () => Boolean(expressionInput.value.trim()) || (showMessage('AlgoBox', 'Calcul vide.'), false),
    ),
  });
}

export function editAssignment(context, current = {}) {
  const variables = requireVariables(context);
  if (!variables) return Promise.resolve(null);
  const valueInput = createTextInput(current.value);
  const rankInput = createTextInput(current.rank);
  const rankField = createField('Rang du terme de la liste :', rankInput);
  const typeOf = (name) => variables.find((variable) => variable.name === name).type;
  const select = createVariableSelector(variables, current.name, () => (rankField.hidden = typeOf(select.value) !== 'LISTE'));
  rankField.hidden = typeOf(select.value) !== 'LISTE';
  return openDialog({
    title: 'Affecter une valeur à une variable',
    body: createElement('div', {}, [
      createField('La variable :', select),
      createField('prend la valeur :', valueInput),
      rankField,
      createExpressionPalette(context, [valueInput, rankInput]),
      createHelpToggle(renderAssignmentHelp),
    ]),
    initialFocus: valueInput,
    actions: OK_CANCEL(
      () => instructions.assignment(select.value, valueInput.value.trim(), typeOf(select.value) === 'LISTE' ? rankInput.value.replace(/#/g, '').trim() : ''),
      () => {
        if (!valueInput.value.trim()) return (showMessage('AlgoBox', 'Affectation vide'), false);
        if (typeOf(select.value) === 'LISTE' && !rankInput.value.trim()) return (showMessage('AlgoBox', 'Indiquer le rang du terme de la liste.'), false);
        return true;
      },
    ),
  });
}

export function editCondition(context, current = {}) {
  const conditionInput = createTextInput(current.condition);
  const elseBranch = createCheckField('Ajouter SINON', current.hasElse);
  return openDialog({
    title: 'Si...alors...',
    body: createElement('div', {}, [
      createField('SI la condition :', conditionInput),
      createElement('p', { className: 'operation-hint', text: 'est vérifiée ALORS...' }),
      elseBranch.element,
      createExpressionPalette(context, [conditionInput], { hasComparisons: true }),
      createHelpToggle(renderConditionHelp),
    ]),
    actions: OK_CANCEL(
      () => instructions.condition(conditionInput.value.trim(), elseBranch.checkbox.checked),
      () => Boolean(conditionInput.value.trim()) || (showMessage('AlgoBox', 'Pas de condition définie'), false),
    ),
  });
}

export function editForLoop(context, current = {}) {
  const numberVariables = AlgoEngine.listVariables(context.algorithm).filter((variable) => variable.type === 'NOMBRE');
  if (!numberVariables.length) {
    showMessage('AlgoBox', "Il faut d'abord déclarer une variable du type NOMBRE pour servir de compteur.");
    return Promise.resolve(null);
  }
  const select = createSelect(
    numberVariables.map((variable) => variable.name),
    current.name,
  );
  const startInput = createTextInput(current.start);
  const endInput = createTextInput(current.end);
  return openDialog({
    title: 'Pour...',
    body: createElement('div', {}, [
      createField('POUR la variable :', select),
      createElement('div', { className: 'inline-fields' }, [createField('ALLANT DE', startInput), createField('A', endInput)]),
      createExpressionPalette(context, [startInput, endInput]),
      createHelpToggle(renderLoopHelp),
    ]),
    initialFocus: startInput,
    actions: OK_CANCEL(
      () => instructions.forLoop(select.value, startInput.value.trim(), endInput.value.trim()),
      () =>
        (Boolean(startInput.value.trim()) && Boolean(endInput.value.trim())) ||
        (showMessage('AlgoBox', 'Les valeurs minimales et maximales du compteur ne sont pas définies'), false),
    ),
  });
}

export function editWhileLoop(context, current = {}) {
  const conditionInput = createTextInput(current.condition);
  return openDialog({
    title: 'Tant que...',
    body: createElement('div', {}, [
      createField('TANT QUE la condition :', conditionInput),
      createElement('p', { className: 'operation-hint', text: 'est vérifiée' }),
      createExpressionPalette(context, [conditionInput], { hasComparisons: true }),
      createHelpToggle(renderConditionHelp),
    ]),
    actions: OK_CANCEL(
      () => instructions.whileLoop(conditionInput.value.trim()),
      () => Boolean(conditionInput.value.trim()) || (showMessage('AlgoBox', 'Pas de condition définie'), false),
    ),
  });
}

export function editComment(context, current = {}) {
  const textInput = createTextInput(current.text, false);
  return openDialog({
    title: 'Insérer un commentaire',
    body: createField('Commentaire :', textInput),
    actions: OK_CANCEL(
      () => instructions.comment(textInput.value),
      () => Boolean(textInput.value.trim()),
    ),
  });
}

const COLOR_OPTIONS = ['Rouge', 'Vert', 'Bleu', 'Blanc'];

export function editPoint(context, current = {}) {
  const xInput = createTextInput(current.x);
  const yInput = createTextInput(current.y);
  const colorSelect = createSelect(COLOR_OPTIONS, current.color || 'Rouge');
  return openDialog({
    title: 'Tracer un point',
    body: createElement('div', {}, [
      createElement('p', { className: 'field__label', text: 'Coordonnées du point :' }),
      createElement('div', { className: 'inline-fields' }, [createField('X :', xInput), createField('Y :', yInput)]),
      createField('Couleur du point :', colorSelect),
      createExpressionPalette(context, [xInput, yInput]),
    ]),
    actions: OK_CANCEL(
      () => instructions.point(xInput.value.trim(), yInput.value.trim(), colorSelect.value),
      () => (Boolean(xInput.value.trim()) && Boolean(yInput.value.trim())) || (showMessage('AlgoBox', "Au moins une des coordonnées n'est pas définie"), false),
    ),
  });
}

export function editSegment(context, current = {}) {
  const inputs = [current.xStart, current.yStart, current.xEnd, current.yEnd].map((value) => createTextInput(value));
  const colorSelect = createSelect(COLOR_OPTIONS, current.color || 'Rouge');
  return openDialog({
    title: 'Tracer un segment',
    body: createElement('div', {}, [
      createElement('p', { className: 'field__label', text: 'Coordonnées du point de départ :' }),
      createElement('div', { className: 'inline-fields' }, [createField('X :', inputs[0]), createField('Y :', inputs[1])]),
      createElement('p', { className: 'field__label', text: "Coordonnées du point d'arrivée :" }),
      createElement('div', { className: 'inline-fields' }, [createField('X :', inputs[2]), createField('Y :', inputs[3])]),
      createField('Couleur du segment :', colorSelect),
      createExpressionPalette(context, inputs),
    ]),
    actions: OK_CANCEL(
      () => instructions.segment(...inputs.map((input) => input.value.trim()), colorSelect.value),
      () => inputs.every((input) => input.value.trim()) || (showMessage('AlgoBox', "Au moins une des coordonnées n'est pas définie"), false),
    ),
  });
}

export function editFunctionDeclaration(context, current = {}) {
  const nameInput = createTextInput(current.name);
  const parametersInput = createTextInput(current.parameters);
  return openDialog({
    title: 'Déclarer Fonction',
    body: createElement('div', {}, [
      createField('Nom de la fonction :', nameInput),
      createField('Paramètres :', parametersInput),
      createElement('p', { className: 'operation-hint', text: 'Séparer les paramètres par une virgule. Exemple : FONCTION aire(longueur,largeur)' }),
    ]),
    actions: OK_CANCEL(
      () => instructions.declareFunction(nameInput.value.trim(), parametersInput.value.trim()),
      () => /^[A-Za-z_][\w]*$/.test(nameInput.value.trim()) || (showMessage('Erreur', 'Fonction non valide'), false),
    ),
  });
}

export function editReturnValue(context, current = {}) {
  const expressionInput = createTextInput(current.expression);
  return openDialog({
    title: 'Insérer RENVOYER',
    body: createElement('div', {}, [createField('RENVOYER', expressionInput), createExpressionPalette(context, [expressionInput])]),
    actions: OK_CANCEL(
      () => instructions.returnValue(expressionInput.value.trim()),
      () => Boolean(expressionInput.value.trim()),
    ),
  });
}

export function editFunctionCall(context, current = {}) {
  const expressionInput = createTextInput(current.expression);
  const functions = AlgoEngine.listFunctions(context.algorithm);
  return openDialog({
    title: 'Insérer APPELER_FONCTION',
    body: createElement('div', {}, [
      createField('APPELER_FONCTION', expressionInput),
      functions.length ? null : createElement('p', { className: 'operation-hint', text: "Aucune fonction n'est encore déclarée dans FONCTIONS_UTILISEES." }),
      createExpressionPalette(context, [expressionInput]),
    ]),
    actions: OK_CANCEL(
      () => instructions.callFunction(expressionInput.value.trim()),
      () => Boolean(expressionInput.value.trim()),
    ),
  });
}

// « Configurer exécution des algorithmes » (mêmes bornes que la boîte d'AlgoBox).
export function editExecutionSettings(settings) {
  const rounding = createCheckField("Arrondir automatiquement lors d'une affectation", settings.isAutoRoundingEnabled);
  const numberInput = (value, minimum, maximum, step) =>
    createElement('input', { type: 'number', value: value, min: minimum, max: maximum, step: step, inputmode: 'numeric' });
  const fields = {
    maxDisplays: numberInput(settings.maxDisplays, 1000, 10000, 1000),
    maxLoopIterations: numberInput(settings.maxLoopIterations, 100000, 1000000, 100000),
    maxTotalIterations: numberInput(settings.maxTotalIterations, 1000000, 90000000, 1000000),
    lineWidth: numberInput(settings.lineWidth, 1, 5, 1),
    pointWidth: numberInput(settings.pointWidth, 1, 5, 1),
    displayedDigits: numberInput(settings.displayedDigits, 8, 12, 1),
  };
  const readValue = (input) => {
    const value = parseInt(input.value, 10);
    return Math.min(Number(input.max), Math.max(Number(input.min), isNaN(value) ? Number(input.min) : value));
  };
  return openDialog({
    title: 'Configurer exécution des algorithmes',
    body: createElement('div', {}, [
      rounding.element,
      createField("Nombre maximal d'affichage dans la console", fields.maxDisplays),
      createField("Nombre maximal d'itérations pour une boucle", fields.maxLoopIterations),
      createField("Nombre maximal d'itérations pour tout l'algorithme", fields.maxTotalIterations),
      createField('Epaisseur des lignes', fields.lineWidth),
      createField('Epaisseur des points', fields.pointWidth),
      createField('Nombre de décimales affichées', fields.displayedDigits),
    ]),
    actions: OK_CANCEL(() => {
      const updated = { isAutoRoundingEnabled: rounding.checkbox.checked };
      Object.keys(fields).forEach((key) => (updated[key] = readValue(fields[key])));
      return updated;
    }),
  });
}

const EDITORS = {
  read: editRead,
  displayVariable: editDisplayVariable,
  displayMessage: editDisplayMessage,
  displayCalculation: editDisplayCalculation,
  assignment: editAssignment,
  condition: editCondition,
  forLoop: editForLoop,
  whileLoop: editWhileLoop,
  comment: editComment,
  point: editPoint,
  segment: editSegment,
  declareFunction: editFunctionDeclaration,
  returnValue: editReturnValue,
  callFunction: editFunctionCall,
};

// « Modifier ligne » : rouvre la boîte correspondant au type de la ligne.
export function editExistingNode(context, node) {
  const description = AlgoEngine.describeNode(node);
  const editor = EDITORS[description.kind];
  return editor ? editor(context, description) : Promise.resolve(null);
}
