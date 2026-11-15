/*
 * Moteur d'AlgoBox Mobile.
 *
 * Reproduit le comportement d'AlgoBox 1.2 : modèle en arbre, format de fichier .alg,
 * mode éditeur de texte, traduction de l'algorithme en JavaScript et exécution
 * (normale ou pas à pas). Le module ne dépend pas du DOM : il fonctionne dans le
 * navigateur (global `AlgoEngine`) comme dans Node (tests unitaires).
 */
(function registerEngine(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AlgoEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function createEngine() {
  'use strict';

  const ENGINE_VERSION = '1.2.0';

  const DEFAULT_SETTINGS = Object.freeze({
    isAutoRoundingEnabled: true,
    maxLoopIterations: 500000,
    maxTotalIterations: 5000000,
    maxDisplays: 1000,
    lineWidth: 2,
    pointWidth: 2,
    displayedDigits: 8,
  });

  const VARIABLE_TYPES = ['NOMBRE', 'CHAINE', 'LISTE'];
  const COLORS = ['Bleu', 'Rouge', 'Vert', 'Blanc'];

  // Liste des noms interdits d'AlgoBox (datas/documents/interdits.txt), complétée par les
  // mots réservés de JavaScript qui rendraient le code généré invalide.
  const FORBIDDEN_NAMES = new Set(
    (
      'CONTINUE CASE F1 F2 FONCTION RENVOYER DEBUT_FONCTION FIN_FONCTION VARIABLES VARIABLES_FONCTION ' +
      'DEBUT FIN DEBUT_SI FIN_SI DEBUT_SINON FIN_SINON DEBUT_POUR FIN_POUR DEBUT_TANT_QUE FIN_TANT_QUE ' +
      'DEBUT_ALGORITHME FIN_ALGORITHME EST DU TYPE EST_DU_TYPE LIRE AFFICHER PREND VALEUR PREND_LA_VALEUR ' +
      'SI SINON POUR ALLANT ALLANT_DE TANT TANT_QUE NOMBRE LISTE CHAINE FAIRE OU ET TRACER_POINT ' +
      'TRACER_SEGMENT NEW DELETE ARRAY NUMBER INT STRING ALERT PROMPT APPLY ASSIGN BACK BOOL CALL CEIL ' +
      'CHARAT CLEAR CLOSE CONCAT MATH. DEFAULT DOCUMENT WRITE WRITELN ESCAPE EVAL EXEC FIND FORM GO IF ' +
      'ELSE JOIN JAVA ISNAN PARSE PARSEFLOAT PARSEINT PRINT PRINTF REPLACE RESET RETURN FOR WHILE THEN ' +
      'WEND TYPE TYPEOF VALUE WHICH WINDOW SQRT POW RANDOM PI FLOOR COS SIN TAN EXP LOG ROUND LENGTH ' +
      'SUBSTR TOSTRING ABS + * = - # / ! == != < > <= >= % ; : , ( ) [ ] { } " \' & ' +
      'MATH AWAIT BREAK CATCH CLASS CONST DEBUGGER DO ENUM EXPORT EXTENDS FALSE FINALLY FUNCTION ' +
      'IMPLEMENTS IMPORT IN INSTANCEOF INTERFACE LET NULL PACKAGE PRIVATE PROTECTED PUBLIC STATIC ' +
      'SUPER SWITCH THIS THROW TRUE TRY VAR VOID WITH YIELD ARGUMENTS UNDEFINED NAN INFINITY SELF'
    ).split(/\s+/),
  );
  const FORBIDDEN_FRAGMENTS = [
    'algobox',
    'f1(',
    'acos(',
    'asin(',
    'atan(',
    'sqrt(',
    'pow(',
    'random(',
    'floor(',
    'cos(',
    'sin(',
    'tan(',
    'exp(',
    'log(',
    'round(',
    'max(',
    'min(',
    'abs(',
  ];

  const NUMBER_INPUT_HINT = '\n(utiliser le . comme séparateur décimal)\n(exemples de syntaxe possible : -3 ; 2.6 ; 4/3 ; 1+sqrt(3) ; ...)';
  const TOO_MANY_DISPLAYS_MESSAGE = "L'algorithme demande d'afficher un très grand nombre de données.\nSouhaitez-vous arrêter l'algorithme?";

  /* ------------------------------------------------------------------ */
  /* Modèle : nœuds de l'arbre                                           */
  /* ------------------------------------------------------------------ */

  function createNode(text, code, children) {
    return { text: text, code: code, children: children || [] };
  }

  function getNodeType(node) {
    if (!node) return 0;
    return parseInt(String(node.code).split('#')[0], 10) || 0;
  }

  function getNodeParams(node) {
    return String(node.code).split('#');
  }

  function cloneNode(node) {
    return createNode(node.text, node.code, node.children.map(cloneNode));
  }

  function removeHashes(value) {
    return String(value === null || value === undefined ? '' : value).replace(/#/g, '');
  }

  // Constructeurs des lignes, avec exactement le texte et le code qu'AlgoBox enregistre.
  const instructions = {
    variable(name, type) {
      return createNode(name + ' EST_DU_TYPE ' + type, '1#' + type + '#' + name);
    },
    read(name, rank) {
      return rank ? createNode('LIRE ' + name + '[' + rank + ']', '2#' + name + '#' + rank) : createNode('LIRE ' + name, '2#' + name + '#pasliste');
    },
    displayVariable(name, hasNewline, rank) {
      return createNode('AFFICHER ' + name + (rank ? '[' + rank + ']' : ''), '3#' + name + '#' + (hasNewline ? '1' : '0') + '#' + (rank || 'pasliste'));
    },
    displayMessage(message, hasNewline) {
      const cleanMessage = removeHashes(message);
      return createNode('AFFICHER "' + cleanMessage + '"', '4#' + cleanMessage + '#' + (hasNewline ? '1' : '0'));
    },
    displayCalculation(expression, hasNewline) {
      const cleanExpression = removeHashes(expression);
      return createNode('AFFICHERCALCUL ' + cleanExpression, '20#' + cleanExpression + '#' + (hasNewline ? '1' : '0'));
    },
    assignment(name, value, rank) {
      const cleanValue = removeHashes(value);
      return createNode(
        (rank ? name + '[' + rank + ']' : name) + ' PREND_LA_VALEUR ' + cleanValue,
        '5#' + name + '#' + cleanValue + '#' + (rank || 'pasliste'),
      );
    },
    condition(condition, hasElse) {
      const cleanCondition = removeHashes(condition);
      const children = [createNode('DEBUT_SI', '7#debutsi'), createNode('FIN_SI', '8#finsi')];
      if (hasElse) children.push(instructions.elseBranch());
      return createNode('SI (' + cleanCondition + ') ALORS', '6#' + cleanCondition, children);
    },
    elseBranch() {
      return createNode('SINON', '9#sinon', [createNode('DEBUT_SINON', '10#debutsinon'), createNode('FIN_SINON', '11#finsinon')]);
    },
    forLoop(name, start, end) {
      const cleanStart = removeHashes(start);
      const cleanEnd = removeHashes(end);
      return createNode('POUR ' + name + ' ALLANT_DE ' + cleanStart + ' A ' + cleanEnd, '12#' + name + '#' + cleanStart + '#' + cleanEnd, [
        createNode('DEBUT_POUR', '13#debutpour'),
        createNode('FIN_POUR', '14#finpour'),
      ]);
    },
    whileLoop(condition) {
      const cleanCondition = removeHashes(condition);
      return createNode('TANT_QUE (' + cleanCondition + ') FAIRE', '15#' + cleanCondition, [
        createNode('DEBUT_TANT_QUE', '16#debuttantque'),
        createNode('FIN_TANT_QUE', '17#fintantque'),
      ]);
    },
    pause() {
      return createNode('PAUSE', '18#pause');
    },
    comment(text) {
      const cleanText = removeHashes(text);
      return createNode('//' + cleanText, '19#' + cleanText);
    },
    point(x, y, color) {
      const cleanX = removeHashes(x);
      const cleanY = removeHashes(y);
      return createNode('TRACER_POINT (' + cleanX + ',' + cleanY + ')', '50#' + cleanX + '#' + cleanY + '#' + color);
    },
    segment(xStart, yStart, xEnd, yEnd, color) {
      const values = [xStart, yStart, xEnd, yEnd].map(removeHashes);
      return createNode('TRACER_SEGMENT (' + values[0] + ',' + values[1] + ')->(' + values[2] + ',' + values[3] + ')', '51#' + values.join('#') + '#' + color);
    },
    clearGraph() {
      return createNode('EFFACER_GRAPHIQUE', '52#effacer');
    },
    declareFunction(name, parameters) {
      const cleanName = removeHashes(name);
      const cleanParameters = removeHashes(parameters) || ' ';
      return createNode('FONCTION ' + cleanName + '(' + cleanParameters + ')', '201#' + cleanName + '#' + cleanParameters, [
        createNode('VARIABLES_FONCTION', '202#declarationsvariablesfonction'),
        createNode('DEBUT_FONCTION', '203#debutfonction'),
        instructions.emptyLine(),
        createNode('FIN_FONCTION', '204#finfonction'),
      ]);
    },
    returnValue(expression) {
      const cleanExpression = removeHashes(expression);
      return createNode('RENVOYER ' + cleanExpression, '205#' + cleanExpression);
    },
    callFunction(expression) {
      const cleanExpression = removeHashes(expression);
      return createNode('APPELER_FONCTION ' + cleanExpression, '206#' + cleanExpression);
    },
    emptyLine() {
      return createNode('', '103#commentaire');
    },
  };

  // Décode une ligne en champs éditables (utilisé par les boîtes « Modifier ligne »).
  function describeNode(node) {
    const params = getNodeParams(node);
    const type = getNodeType(node);
    const rankOf = (value) => (value && value !== 'pasliste' ? value : '');
    switch (type) {
      case 1:
        return { kind: 'variable', type: params[1], name: params[2] };
      case 2:
        return { kind: 'read', name: params[1], rank: rankOf(params[2]) };
      case 3:
        return { kind: 'displayVariable', name: params[1], hasNewline: params[2] === '1', rank: rankOf(params[3]) };
      case 4:
        return { kind: 'displayMessage', message: params[1], hasNewline: params[2] === '1' };
      case 20:
        return { kind: 'displayCalculation', expression: params[1], hasNewline: params[2] === '1' };
      case 5:
        return { kind: 'assignment', name: params[1], value: params[2], rank: rankOf(params[3]) };
      case 6:
        return { kind: 'condition', condition: params.slice(1).join('#'), hasElse: node.children.some((child) => getNodeType(child) === 9) };
      case 12:
        return { kind: 'forLoop', name: params[1], start: params[2], end: params[3] };
      case 15:
        return { kind: 'whileLoop', condition: params.slice(1).join('#') };
      case 18:
        return { kind: 'pause' };
      case 19:
        return { kind: 'comment', text: params.slice(1).join('#') };
      case 50:
        return { kind: 'point', x: params[1], y: params[2], color: params[3] || 'Bleu' };
      case 51:
        return { kind: 'segment', xStart: params[1], yStart: params[2], xEnd: params[3], yEnd: params[4], color: params[5] || 'Bleu' };
      case 52:
        return { kind: 'clearGraph' };
      case 201:
        return { kind: 'declareFunction', name: params[1], parameters: (params[2] || '').trim() };
      case 205:
        return { kind: 'returnValue', expression: params.slice(1).join('#') };
      case 206:
        return { kind: 'callFunction', expression: params.slice(1).join('#') };
      default:
        return { kind: type === 103 || node.text === '' ? 'emptyLine' : 'structure' };
    }
  }

  // Met à jour une ligne existante avec de nouveaux champs, en conservant son contenu
  // (les instructions placées dans un bloc SI, POUR, TANT_QUE ou FONCTION).
  function updateNode(node, replacement) {
    const type = getNodeType(replacement);
    if (type === 6) {
      const currentElse = node.children.find((child) => getNodeType(child) === 9);
      const wantsElse = replacement.children.some((child) => getNodeType(child) === 9);
      node.children = node.children.filter((child) => getNodeType(child) !== 9);
      if (wantsElse) node.children.push(currentElse || instructions.elseBranch());
    } else if (type === 12 || type === 15 || type === 201) {
      // les enfants restent ceux de la ligne d'origine
    } else {
      node.children = replacement.children;
    }
    node.text = replacement.text;
    node.code = replacement.code;
    return node;
  }

  /* ------------------------------------------------------------------ */
  /* Algorithme complet                                                  */
  /* ------------------------------------------------------------------ */

  function createAlgorithm() {
    return {
      description: '',
      currentLineText: '',
      extensionName: 'inactif',
      numericFunction: { isEnabled: false, expression: '' },
      advancedFunction: { isEnabled: false, parameters: '', defaultValue: '', rules: [] },
      frame: { isEnabled: false, xMin: '-10', xMax: '10', yMin: '-10', yMax: '10', xStep: '2', yStep: '2' },
      settings: Object.assign({}, DEFAULT_SETTINGS),
      tree: [
        createNode('FONCTIONS_UTILISEES', '200#declarationfonctions'),
        createNode('VARIABLES', '100#declarationsvariables'),
        createNode('DEBUT_ALGORITHME', '101#debutalgo'),
        createNode('FIN_ALGORITHME', '102#finalgo'),
      ],
    };
  }

  function cloneAlgorithm(algorithm) {
    return JSON.parse(JSON.stringify(algorithm));
  }

  function getSection(algorithm, type) {
    return algorithm.tree.find((node) => getNodeType(node) === type) || null;
  }

  function getSections(algorithm) {
    return {
      functions: getSection(algorithm, 200),
      variables: getSection(algorithm, 100),
      start: getSection(algorithm, 101),
      end: getSection(algorithm, 102),
    };
  }

  // Variables déclarées : globales puis variables locales des fonctions (même ordre qu'AlgoBox).
  function listVariables(algorithm) {
    const declarations = [];
    const pattern = /^(.*) EST_DU_TYPE (.*)$/;
    const sections = getSections(algorithm);
    const addDeclaration = (node, isLocal) => {
      const match = pattern.exec(node.text);
      if (match) declarations.push({ name: match[1], type: match[2], isLocal: isLocal });
    };
    if (sections.variables) sections.variables.children.forEach((node) => addDeclaration(node, false));
    if (sections.functions) {
      sections.functions.children.forEach((functionNode) => {
        functionNode.children
          .filter((child) => child.text === 'VARIABLES_FONCTION')
          .forEach((block) => block.children.forEach((node) => addDeclaration(node, true)));
      });
    }
    return declarations;
  }

  function listFunctions(algorithm) {
    const sections = getSections(algorithm);
    if (!sections.functions) return [];
    return sections.functions.children
      .filter((node) => getNodeType(node) === 201)
      .map((node) => {
        const params = getNodeParams(node);
        return { name: params[1], parameters: (params[2] || '').trim() };
      });
  }

  // FiltreNomVariable d'AlgoBox : retire les caractères spéciaux et remplace les espaces.
  function sanitizeVariableName(name) {
    let cleanName = String(name || '').trim();
    '*+-/%(){}[];:!\'"&|^#,.'.split('').forEach((character) => {
      cleanName = cleanName.split(character).join('');
    });
    return cleanName.replace(/ /g, '_');
  }

  function isForbiddenName(name, algorithm) {
    if (!name) return true;
    const upperName = name.toUpperCase();
    if (FORBIDDEN_NAMES.has(upperName)) return true;
    if (!/^[A-Za-z_À-ſ][\wÀ-ſ]*$/.test(name)) return true;
    if (algorithm && listVariables(algorithm).some((variable) => variable.name.toUpperCase() === upperName)) return true;
    const lowerName = name.toLowerCase();
    return FORBIDDEN_FRAGMENTS.some((fragment) => lowerName.includes(fragment));
  }

  /* ------------------------------------------------------------------ */
  /* Édition de l'arbre                                                  */
  /* ------------------------------------------------------------------ */

  function findParent(algorithm, target) {
    const search = (parent) => {
      for (const child of parent.children) {
        if (child === target) return parent;
        const found = search(child);
        if (found) return found;
      }
      return null;
    };
    for (const topNode of algorithm.tree) {
      if (topNode === target) return null;
      const found = search(topNode);
      if (found) return found;
    }
    return null;
  }

  function isTopLevel(algorithm, node) {
    return algorithm.tree.includes(node);
  }

  // Droits par type de ligne, recopiés d'ActualiserArbre() dans AlgoBox :
  // A = nouvelle ligne, R = supprimer, E = modifier, C = copier, U = couper.
  const LINE_RULES = {
    1: 'R',
    2: 'ARECU',
    3: 'ARECU',
    4: 'ARECU',
    5: 'ARECU',
    6: 'RECU',
    7: 'A',
    8: 'A',
    9: 'R',
    10: 'A',
    11: 'A',
    12: 'RECU',
    13: 'A',
    14: 'A',
    15: 'RECU',
    16: 'A',
    17: 'A',
    18: 'ARCU',
    19: 'ARECU',
    20: 'ARECU',
    50: 'ARECU',
    51: 'ARECU',
    52: 'ARCU',
    100: '',
    101: 'A',
    102: '',
    200: 'A',
    201: 'RE',
    202: '',
    203: 'A',
    204: '',
    205: 'ARECU',
    206: 'ARECU',
  };
  const BLOCK_START_TYPES = [7, 10, 13, 16];
  const BLOCK_END_TYPES = [8, 9, 11, 14, 17, 102, 204];

  function getLineCapabilities(algorithm, node, hasClipboard) {
    if (!node) {
      return {
        canAddLine: false,
        canRemoveLine: false,
        canEditLine: false,
        canCopyLine: false,
        canPasteLine: false,
        canCutLine: false,
        canAddFunction: false,
        canAddLocalVariable: false,
        canInsertInstruction: false,
      };
    }
    const type = getNodeType(node);
    const parent = findParent(algorithm, node);
    const isEmptyLine = node.text === '';
    const isInFunctionList = Boolean(parent && getNodeType(parent) === 200);
    const rule = isEmptyLine ? 'R' : LINE_RULES[type] !== undefined ? LINE_RULES[type] : 'AR';
    return {
      canAddLine: rule.includes('A'),
      canRemoveLine: rule.includes('R'),
      canEditLine: rule.includes('E'),
      canCopyLine: rule.includes('C'),
      canPasteLine: isEmptyLine && Boolean(hasClipboard),
      canCutLine: rule.includes('U'),
      canAddFunction: isEmptyLine && isInFunctionList,
      canAddLocalVariable: type === 202,
      canInsertInstruction: isEmptyLine && !isInFunctionList && Boolean(parent),
    };
  }

  // NouvelleLigne() d'AlgoBox : renvoie la ligne vide créée (ou null).
  function insertNewLine(algorithm, node) {
    if (!node) return null;
    const newLine = instructions.emptyLine();
    const parent = findParent(algorithm, node);
    const type = getNodeType(node);
    if (type === 200 || type === 101) {
      node.children.unshift(newLine);
      return newLine;
    }
    if (BLOCK_END_TYPES.includes(type)) {
      return parent ? insertNewLine(algorithm, parent) : null;
    }
    if (type === 203 || type === 202) {
      if (!parent) return null;
      const startIndex = parent.children.findIndex((child) => getNodeType(child) === 203);
      parent.children.splice(startIndex + 1, 0, newLine);
      return newLine;
    }
    if (BLOCK_START_TYPES.includes(type)) {
      if (!parent) return null;
      parent.children.splice(parent.children.indexOf(node) + 1, 0, newLine);
      return newLine;
    }
    if (!parent) return null;
    if (getNodeType(parent) === 100 || getNodeType(parent) === 202) return null;
    parent.children.splice(parent.children.indexOf(node) + 1, 0, newLine);
    return newLine;
  }

  // Supprime une ligne (et son bloc). Renvoie la ligne à sélectionner ensuite.
  function removeNode(algorithm, node) {
    const parent = findParent(algorithm, node);
    if (!parent) return null;
    const index = parent.children.indexOf(node);
    parent.children.splice(index, 1);
    if (parent.children.length === 0) return parent;
    return parent.children[Math.min(index, parent.children.length - 1)];
  }

  function replaceNode(algorithm, node, replacement) {
    const parent = findParent(algorithm, node);
    if (!parent) return null;
    parent.children[parent.children.indexOf(node)] = replacement;
    return replacement;
  }

  /* ------------------------------------------------------------------ */
  /* Fichier .alg (XML)                                                  */
  /* ------------------------------------------------------------------ */

  function decodeEntities(text) {
    return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|lt|gt|amp|quot|apos);/g, (match, entity) => {
      if (entity[0] === '#') {
        const codePoint = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
        return String.fromCodePoint(codePoint);
      }
      return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[entity];
    });
  }

  function escapeXmlAttribute(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '&#xa;')
      .replace(/\r/g, '&#xd;')
      .replace(/\t/g, '&#x9;');
  }

  // Petit analyseur XML suffisant pour les fichiers .alg (éléments et attributs).
  function parseXml(source) {
    const documentNode = { tag: '#document', attributes: {}, children: [] };
    const stack = [documentNode];
    let position = 0;
    while (position < source.length) {
      const tagStart = source.indexOf('<', position);
      if (tagStart < 0) break;
      if (source.startsWith('<?', tagStart)) {
        position = source.indexOf('?>', tagStart) + 2;
        continue;
      }
      if (source.startsWith('<!--', tagStart)) {
        position = source.indexOf('-->', tagStart) + 3;
        continue;
      }
      if (source.startsWith('<!', tagStart)) {
        position = source.indexOf('>', tagStart) + 1;
        continue;
      }
      if (source.startsWith('</', tagStart)) {
        position = source.indexOf('>', tagStart) + 1;
        if (stack.length > 1) stack.pop();
        continue;
      }
      let cursor = tagStart + 1;
      let quote = null;
      while (cursor < source.length) {
        const character = source[cursor];
        if (quote) {
          if (character === quote) quote = null;
        } else if (character === '"' || character === "'") {
          quote = character;
        } else if (character === '>') {
          break;
        }
        cursor++;
      }
      if (cursor >= source.length) throw new Error('Fichier XML incomplet');
      let tagContent = source.slice(tagStart + 1, cursor);
      const isSelfClosing = /\/\s*$/.test(tagContent);
      if (isSelfClosing) tagContent = tagContent.replace(/\/\s*$/, '');
      const nameMatch = /^\s*([^\s/>]+)/.exec(tagContent);
      const element = { tag: nameMatch ? nameMatch[1] : '', attributes: {}, children: [] };
      const attributePattern = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let attributeMatch;
      while ((attributeMatch = attributePattern.exec(tagContent.slice(nameMatch ? nameMatch[0].length : 0)))) {
        const rawValue = attributeMatch[3] !== undefined ? attributeMatch[3] : attributeMatch[4];
        element.attributes[attributeMatch[1]] = decodeEntities(rawValue);
      }
      stack[stack.length - 1].children.push(element);
      if (!isSelfClosing) stack.push(element);
      position = cursor + 1;
    }
    return documentNode;
  }

  function parseAlgFile(source) {
    const xmlDocument = parseXml(String(source).replace(/^\uFEFF/, ''));
    const root = xmlDocument.children.find((element) => element.tag === 'Algo');
    if (!root) throw new Error("Ce fichier n'est pas un algorithme AlgoBox.");
    const algorithm = createAlgorithm();
    const sections = getSections(algorithm);
    const fixedSections = {
      FONCTIONS_UTILISEES: sections.functions,
      VARIABLES: sections.variables,
      DEBUT_ALGORITHME: sections.start,
      FIN_ALGORITHME: sections.end,
    };
    const toNode = (element) => {
      const node = createNode(element.attributes.algoitem, element.attributes.code);
      element.children.forEach((child) => {
        if (child.tag === 'item' && 'algoitem' in child.attributes && 'code' in child.attributes) {
          node.children.push(toNode(child));
        }
      });
      return node;
    };
    root.children.forEach((element) => {
      const attributes = element.attributes;
      if ('texte' in attributes && 'courant' in attributes) {
        algorithm.description = attributes.texte;
        algorithm.currentLineText = attributes.courant;
      } else if ('extnom' in attributes) {
        algorithm.extensionName = attributes.extnom;
      } else if ('fctetat' in attributes && 'fctcode' in attributes) {
        algorithm.numericFunction = { isEnabled: attributes.fctetat === 'actif', expression: attributes.fctcode };
      } else if ('F2etat' in attributes && 'F2para' in attributes && 'F2defaut' in attributes) {
        algorithm.advancedFunction = {
          isEnabled: attributes.F2etat === 'actif',
          parameters: attributes.F2para,
          defaultValue: attributes.F2defaut,
          rules: (attributes.F2lignes || '')
            .split('#')
            .map((line) => line.split('@'))
            .filter((parts) => parts.length === 2)
            .map((parts) => ({ condition: parts[0], returnValue: parts[1] })),
        };
      } else if ('repetat' in attributes && 'repcode' in attributes) {
        const values = attributes.repcode.split('#');
        algorithm.frame.isEnabled = attributes.repetat === 'actif';
        if (values.length === 6) {
          Object.assign(algorithm.frame, { xMin: values[0], xMax: values[1], yMin: values[2], yMax: values[3], xStep: values[4], yStep: values[5] });
        }
      } else if ('arrondiAuto' in attributes) {
        const settings = algorithm.settings;
        settings.isAutoRoundingEnabled = attributes.arrondiAuto === 'vrai';
        const readInteger = (name, key) => {
          if (name in attributes && !isNaN(parseInt(attributes[name], 10))) settings[key] = parseInt(attributes[name], 10);
        };
        readInteger('maxBoucle', 'maxLoopIterations');
        readInteger('totalBoucles', 'maxTotalIterations');
        readInteger('totalAffichages', 'maxDisplays');
        readInteger('epaisseurLigne', 'lineWidth');
        readInteger('epaisseurPoint', 'pointWidth');
        readInteger('nbDecimales', 'displayedDigits');
      } else if (element.tag === 'item' && 'algoitem' in attributes && 'code' in attributes) {
        const fixedSection = fixedSections[attributes.algoitem];
        if (fixedSection) {
          element.children
            .filter((child) => child.tag === 'item' && 'algoitem' in child.attributes && 'code' in child.attributes)
            .forEach((child) => fixedSection.children.push(toNode(child)));
        }
      }
    });
    return algorithm;
  }

  function serializeAlgFile(algorithm) {
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<Algo>'];
    const element = (tag, attributes) =>
      '    <' +
      tag +
      Object.keys(attributes)
        .map((key) => ' ' + key + '="' + escapeXmlAttribute(attributes[key]) + '"')
        .join('') +
      '/>';
    const frame = algorithm.frame;
    const settings = algorithm.settings;
    const advanced = algorithm.advancedFunction;
    lines.push(element('description', { texte: algorithm.description || '', courant: algorithm.currentLineText || '' }));
    lines.push(element('extension', { extnom: algorithm.extensionName || 'inactif' }));
    lines.push(
      element('fonction', { fctetat: algorithm.numericFunction.isEnabled ? 'actif' : 'inactif', fctcode: algorithm.numericFunction.expression || '' }),
    );
    lines.push(
      element('F2', {
        F2etat: advanced.isEnabled ? 'actif' : 'inactif',
        F2para: advanced.parameters || '',
        F2defaut: advanced.defaultValue || '',
        F2lignes: advanced.rules.map((rule) => rule.condition + '@' + rule.returnValue + '#').join(''),
      }),
    );
    const frameValue = (value, fallback) => (String(value || '').length ? removeHashes(value) : fallback);
    lines.push(
      element('repere', {
        repetat: frame.isEnabled ? 'actif' : 'inactif',
        repcode: [
          frameValue(frame.xMin, '-10'),
          frameValue(frame.xMax, '10'),
          frameValue(frame.yMin, '-10'),
          frameValue(frame.yMax, '10'),
          frameValue(frame.xStep, '2'),
          frameValue(frame.yStep, '2'),
        ].join('#'),
      }),
    );
    lines.push(
      element('param', {
        arrondiAuto: settings.isAutoRoundingEnabled ? 'vrai' : 'faux',
        maxBoucle: settings.maxLoopIterations,
        totalBoucles: settings.maxTotalIterations,
        totalAffichages: settings.maxDisplays,
        epaisseurLigne: settings.lineWidth,
        epaisseurPoint: settings.pointWidth,
        nbDecimales: settings.displayedDigits,
      }),
    );
    const writeNode = (node, depth) => {
      const indent = '    '.repeat(depth);
      const opening = indent + '<item algoitem="' + escapeXmlAttribute(node.text) + '" code="' + escapeXmlAttribute(node.code) + '"';
      if (!node.children.length) {
        lines.push(opening + '/>');
        return;
      }
      lines.push(opening + '>');
      node.children.forEach((child) => writeNode(child, depth + 1));
      lines.push(indent + '</item>');
    };
    algorithm.tree.forEach((node) => writeNode(node, 1));
    lines.push('</Algo>');
    return lines.join('\n') + '\n';
  }

  /* ------------------------------------------------------------------ */
  /* Mode éditeur de texte                                               */
  /* ------------------------------------------------------------------ */

  // AlgoNoeudCode() : AFFICHER* pour un retour à la ligne, TRACER_POINT_Couleur, etc.
  function getNodeCodeLine(node) {
    const params = getNodeParams(node);
    const type = getNodeType(node);
    if (type === 20 || type === 3 || type === 4) {
      const keyword = type === 20 ? 'AFFICHERCALCUL' : 'AFFICHER';
      const content = node.text.replace(/^AFFICHER(CALCUL)?\s+/, '');
      return params[2] === '1' ? keyword + '* ' + content : node.text;
    }
    if (type === 50 && params.length === 4) return 'TRACER_POINT_' + params[3] + ' ' + node.text.replace(/^TRACER_POINT\s+/, '');
    if (type === 51 && params.length === 6) return 'TRACER_SEGMENT_' + params[5] + ' ' + node.text.replace(/^TRACER_SEGMENT\s+/, '');
    return node.text;
  }

  function treeToText(algorithm) {
    const lines = [];
    const writeNode = (node, depth) => {
      lines.push('  '.repeat(depth) + getNodeCodeLine(node));
      node.children.forEach((child) => writeNode(child, depth + 1));
    };
    algorithm.tree.forEach((node) => writeNode(node, 0));
    return lines.join('\n') + '\n';
  }

  // Découpe "a,b" au niveau supérieur (sans tenir compte des virgules entre parenthèses).
  function splitTopLevel(text, separator) {
    const parts = [];
    let depth = 0;
    let quote = null;
    let current = '';
    for (let index = 0; index < text.length; index++) {
      const character = text[index];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if ('([{'.includes(character)) {
        depth++;
      } else if (')]}'.includes(character)) {
        depth--;
      } else if (depth === 0 && text.startsWith(separator, index)) {
        parts.push(current);
        current = '';
        index += separator.length - 1;
        continue;
      }
      current += character;
    }
    parts.push(current);
    return parts;
  }

  function splitRank(target) {
    const match = /\[(.*)\]/.exec(target);
    if (!match) return { name: target.trim(), rank: '' };
    return { name: target.replace(/\[(.*)\]/, '').trim(), rank: match[1] };
  }

  class TextSyntaxError extends Error {
    constructor(message, line) {
      super(message + ' (ligne ' + line + ')');
      this.reason = message;
      this.line = line;
    }
  }

  // EditeurVersArbre() : reconstruit l'arbre à partir du code texte.
  function textToTree(text, baseAlgorithm) {
    const algorithm = baseAlgorithm ? cloneAlgorithm(baseAlgorithm) : createAlgorithm();
    algorithm.tree = createAlgorithm().tree;
    const sections = getSections(algorithm);
    const sourceLines = String(text).split(/\r?\n/);
    const lines = [];
    for (let index = 0; index < sourceLines.length; index++) {
      const line = sourceLines[index].replace(/^[0-9]+/, '').trim();
      if (line.includes('•')) throw new TextSyntaxError('Le code contient un champ • non complété', index + 1);
      if (line) lines.push({ text: line, number: index + 1 });
    }
    const findIndex = (pattern) => lines.findIndex((line) => pattern.test(line.text));
    const lastLineNumber = lines.length ? lines[lines.length - 1].number : 1;
    const variablesIndex = findIndex(/^VARIABLES(?!_)/i);
    const startIndex = findIndex(/^DEBUT_ALGORITHME/i);
    const endIndex = findIndex(/^FIN_ALGORITHME/i);
    if (variablesIndex < 0) throw new TextSyntaxError('Instruction VARIABLES manquante', lastLineNumber);
    if (startIndex < 0 || startIndex < variablesIndex) throw new TextSyntaxError('Instruction DEBUT_ALGORITHME manquante', lastLineNumber);
    if (endIndex < 0 || endIndex < startIndex) throw new TextSyntaxError('Instruction FIN_ALGORITHME manquante', lastLineNumber);

    const declarationPattern = /^(.*)\s+EST_DU_TYPE\s+(.*)$/i;
    const declaredNames = new Set();
    const declareVariable = (line, container) => {
      const match = declarationPattern.exec(line.text);
      const name = sanitizeVariableName(match[1]);
      const type = match[2].trim();
      if (isForbiddenName(name) || declaredNames.has(name.toUpperCase())) throw new TextSyntaxError('Nom de variable interdit', line.number);
      declaredNames.add(name.toUpperCase());
      if (!VARIABLE_TYPES.includes(type)) throw new TextSyntaxError('Type de variable non reconnu', line.number);
      container.children.push(instructions.variable(name, type));
    };
    // 1. Variables globales (entre VARIABLES et DEBUT_ALGORITHME)
    for (let index = variablesIndex + 1; index < startIndex; index++) {
      if (declarationPattern.test(lines[index].text)) declareVariable(lines[index], sections.variables);
      else throw new TextSyntaxError('Instruction non reconnue', lines[index].number);
    }
    // 2. Variables locales (déclarées dans les fonctions, avant VARIABLES)
    const functionLines = lines.slice(0, variablesIndex).filter((line) => !/^FONCTIONS_UTILISEES/i.test(line.text));
    const localVariables = [];
    functionLines.forEach((line) => {
      if (declarationPattern.test(line.text)) localVariables.push(line);
    });
    const temporaryLocals = createNode('VARIABLES_FONCTION', '202#');
    localVariables.forEach((line) => declareVariable(line, temporaryLocals));
    const knownTypes = new Map();
    listVariables(algorithm).forEach((variable) => knownTypes.set(variable.name, variable.type));
    temporaryLocals.children.forEach((node) => {
      const params = getNodeParams(node);
      knownTypes.set(params[2], params[1]);
    });
    // 3. Fonctions puis 4. corps de l'algorithme
    parseStatements(functionLines, sections.functions, knownTypes, true);
    parseStatements(lines.slice(startIndex + 1, endIndex), sections.start, knownTypes, false);
    return algorithm;
  }

  function parseStatements(lines, rootContainer, knownTypes, isFunctionSection) {
    const stack = [{ node: rootContainer, kind: 'root', state: 'body' }];
    let lastClosedCondition = null;
    const top = () => stack[stack.length - 1];
    const fail = (message, line) => {
      throw new TextSyntaxError(message, line.number);
    };
    const append = (node, line) => {
      const frame = top();
      if (isFunctionSection && frame.kind === 'root' && getNodeType(node) !== 201) fail('Instruction non reconnue', line);
      if (frame.state !== 'body') fail('Instruction non reconnue', line);
      frame.node.children.push(node);
      return node;
    };
    const requireVariable = (name, line) => {
      if (!name) fail('Nom de variable non reconnu.', line);
      if (!knownTypes.has(name)) fail('Variable non déclarée.', line);
      return knownTypes.get(name);
    };
    const openBlock = (keyword, line) => {
      const frame = top();
      if (frame.state !== 'awaitStart' || frame.startKeyword !== keyword) fail('Instruction non reconnue', line);
      frame.node.children.push(createNode(keyword, frame.startCode));
      frame.state = 'body';
    };
    const closeBlock = (keyword, line) => {
      const frame = top();
      if (frame.state !== 'body' || frame.endKeyword !== keyword) fail('Instruction non reconnue', line);
      frame.node.children.push(createNode(keyword, frame.endCode));
      stack.pop();
      return frame.node;
    };
    const pushBlock = (node, kind, startKeyword, startCode, endKeyword, endCode) => {
      stack.push({ node: node, kind: kind, state: 'awaitStart', startKeyword, startCode, endKeyword, endCode });
    };

    lines.forEach((line) => {
      const text = line.text;
      let match;
      const closedCondition = lastClosedCondition;
      lastClosedCondition = null;
      if ((match = /^\/\/(.*)$/.exec(text))) {
        append(instructions.comment(match[1]), line);
      } else if (/^FONCTION\s+/i.test(text)) {
        match = /^FONCTION\s+(.*)\((.*)\)/i.exec(text);
        if (!match || !match[1].trim()) fail('Déclaration de fonction incomplète', line);
        if (!isFunctionSection || top().kind !== 'root') fail('Instruction non reconnue', line);
        const functionNode = createNode('FONCTION ' + match[1].trim() + '(' + (match[2] || ' ') + ')', '201#' + match[1].trim() + '#' + (match[2] || ' '));
        rootContainer.children.push(functionNode);
        stack.push({ node: functionNode, kind: 'function', state: 'awaitVariables' });
      } else if (/^VARIABLES_FONCTION/i.test(text)) {
        const frame = top();
        if (frame.kind !== 'function' || frame.state !== 'awaitVariables') fail('Instruction non reconnue', line);
        frame.locals = createNode('VARIABLES_FONCTION', '202#declarationsvariablesfonction');
        frame.node.children.push(frame.locals);
        frame.state = 'variables';
      } else if (/^(.*)\s+EST_DU_TYPE\s+(.*)$/i.test(text)) {
        const frame = top();
        if (frame.kind !== 'function' || frame.state !== 'variables') fail('Instruction non reconnue', line);
        const declaration = /^(.*)\s+EST_DU_TYPE\s+(.*)$/i.exec(text);
        frame.locals.children.push(instructions.variable(sanitizeVariableName(declaration[1]), declaration[2].trim()));
      } else if (/^DEBUT_FONCTION/i.test(text)) {
        const frame = top();
        if (frame.kind !== 'function' || frame.state === 'body') fail('Instruction non reconnue', line);
        if (!frame.locals) frame.node.children.push(createNode('VARIABLES_FONCTION', '202#declarationsvariablesfonction'));
        frame.node.children.push(createNode('DEBUT_FONCTION', '203#debutfonction'));
        frame.state = 'body';
      } else if (/^FIN_FONCTION/i.test(text)) {
        const frame = top();
        if (frame.kind !== 'function' || frame.state !== 'body') fail('Instruction non reconnue', line);
        frame.node.children.push(createNode('FIN_FONCTION', '204#finfonction'));
        stack.pop();
      } else if (/^PAUSE/i.test(text)) {
        append(instructions.pause(), line);
      } else if ((match = /^APPELER_FONCTION\s+(.*)/i.exec(text))) {
        append(instructions.callFunction(match[1]), line);
      } else if ((match = /^RENVOYER\s+(.*)/i.exec(text))) {
        if (!stack.some((frame) => frame.kind === 'function')) fail('Pas de fonction correspondante', line);
        append(instructions.returnValue(match[1]), line);
      } else if ((match = /^LIRE\s+(.+)/i.exec(text))) {
        const target = splitRank(removeHashes(match[1]));
        const type = requireVariable(target.name, line);
        append(instructions.read(target.name, type === 'LISTE' ? target.rank : ''), line);
      } else if ((match = /^AFFICHERCALCUL(\*?)\s+(.*)/i.exec(text))) {
        if (!removeHashes(match[2]).trim()) fail('Calcul vide.', line);
        append(instructions.displayCalculation(match[2], match[1] === '*'), line);
      } else if ((match = /^AFFICHER(\*?)\s+"(.*)"/i.exec(text))) {
        if (!match[2]) fail('Message vide.', line);
        append(instructions.displayMessage(match[2], match[1] === '*'), line);
      } else if ((match = /^AFFICHER(\*?)\s+(.*)/i.exec(text))) {
        const target = splitRank(removeHashes(match[2]));
        const type = requireVariable(target.name, line);
        append(instructions.displayVariable(target.name, match[1] === '*', type === 'LISTE' ? target.rank : ''), line);
      } else if ((match = /^(.*?)\s+PREND_LA_VALEUR\s+(.*)/i.exec(text))) {
        if (knownTypes.size === 0) fail("Aucune variable n'a encore été définie.", line);
        const target = splitRank(match[1]);
        if (!target.name) fail('Pas de variable définie', line);
        const type = requireVariable(target.name, line);
        if (!removeHashes(match[2]).trim()) fail('Affectation vide', line);
        append(instructions.assignment(target.name, match[2], type === 'LISTE' ? target.rank : ''), line);
      } else if ((match = /^TRACER_POINT(?:_(Rouge|Vert|Bleu|Blanc))?\s+\((.*)\)\s*$/i.exec(text))) {
        const coordinates = splitTopLevel(match[2], ',');
        if (coordinates.length !== 2 || coordinates.some((value) => !value.trim())) fail("Au moins une des coordonnées n'est pas définie", line);
        append(instructions.point(coordinates[0], coordinates[1], normalizeColor(match[1])), line);
      } else if ((match = /^TRACER_SEGMENT(?:_(Rouge|Vert|Bleu|Blanc))?\s+(.*)$/i.exec(text))) {
        const points = splitTopLevel(match[2], '->').map((part) => /^\s*\((.*)\)\s*$/.exec(part));
        const coordinates = points.length === 2 && points[0] && points[1] ? splitTopLevel(points[0][1], ',').concat(splitTopLevel(points[1][1], ',')) : [];
        if (coordinates.length !== 4 || coordinates.some((value) => !value.trim())) fail("Au moins une des coordonnées n'est pas définie", line);
        append(instructions.segment(coordinates[0], coordinates[1], coordinates[2], coordinates[3], normalizeColor(match[1])), line);
      } else if (/^EFFACER_GRAPHIQUE/i.test(text)) {
        append(instructions.clearGraph(), line);
      } else if ((match = /^TANT_QUE\s+\((.*)\)\s+FAIRE/i.exec(text))) {
        if (!removeHashes(match[1]).trim()) fail('Pas de condition définie', line);
        const node = append(createNode('TANT_QUE (' + removeHashes(match[1]) + ') FAIRE', '15#' + removeHashes(match[1])), line);
        pushBlock(node, 'while', 'DEBUT_TANT_QUE', '16#debuttantque', 'FIN_TANT_QUE', '17#fintantque');
      } else if (/^DEBUT_TANT_QUE/i.test(text)) {
        openBlock('DEBUT_TANT_QUE', line);
      } else if (/^FIN_TANT_QUE/i.test(text)) {
        closeBlock('FIN_TANT_QUE', line);
      } else if ((match = /^POUR\s+(.*)\s+ALLANT_DE\s+(.*)\s+A\s+(.*)/i.exec(text))) {
        const name = match[1].trim();
        if (!name) fail('Pas de variable définie', line);
        if (!removeHashes(match[2]).trim() || !removeHashes(match[3]).trim()) fail('Les valeurs minimales et maximales du compteur ne sont pas définies', line);
        requireVariable(name, line);
        const loop = instructions.forLoop(name, match[2].trim(), match[3].trim());
        loop.children = [];
        append(loop, line);
        pushBlock(loop, 'for', 'DEBUT_POUR', '13#debutpour', 'FIN_POUR', '14#finpour');
      } else if (/^DEBUT_POUR/i.test(text)) {
        openBlock('DEBUT_POUR', line);
      } else if (/^FIN_POUR/i.test(text)) {
        closeBlock('FIN_POUR', line);
      } else if ((match = /^SI\s+\((.*)\)\s+ALORS/i.exec(text))) {
        if (!removeHashes(match[1]).trim()) fail('Pas de condition définie', line);
        const node = append(createNode('SI (' + removeHashes(match[1]) + ') ALORS', '6#' + removeHashes(match[1])), line);
        pushBlock(node, 'if', 'DEBUT_SI', '7#debutsi', 'FIN_SI', '8#finsi');
      } else if (/^DEBUT_SINON/i.test(text)) {
        openBlock('DEBUT_SINON', line);
      } else if (/^FIN_SINON/i.test(text)) {
        closeBlock('FIN_SINON', line);
      } else if (/^DEBUT_SI/i.test(text)) {
        openBlock('DEBUT_SI', line);
      } else if (/^FIN_SI/i.test(text)) {
        lastClosedCondition = closeBlock('FIN_SI', line);
      } else if (/^SINON/i.test(text)) {
        if (!closedCondition) fail('Instruction non reconnue', line);
        const elseNode = createNode('SINON', '9#sinon');
        closedCondition.children.push(elseNode);
        pushBlock(elseNode, 'else', 'DEBUT_SINON', '10#debutsinon', 'FIN_SINON', '11#finsinon');
      } else {
        fail('Instruction non reconnue', line);
      }
    });
    if (stack.length > 1) {
      const frame = top();
      const lastLine = lines.length ? lines[lines.length - 1] : { number: 1 };
      fail('Bloc non terminé : ' + (frame.endKeyword || 'FIN_FONCTION') + ' manquant', lastLine);
    }
  }

  function normalizeColor(color) {
    if (!color) return 'Bleu';
    const found = COLORS.find((candidate) => candidate.toLowerCase() === color.toLowerCase());
    return found || 'Bleu';
  }

  /* ------------------------------------------------------------------ */
  /* Filtres d'expression (FiltreCalcul / FiltreCondition)               */
  /* ------------------------------------------------------------------ */

  const MATH_FUNCTION_PATTERN = /(acos|asin|atan|sqrt|pow|random|floor|exp|log|round|max|min|abs|cos|sin|tan)\s*\(/iy;

  // Applique `transform` à chaque portion de texte située hors des chaînes "..." ou '...'.
  function transformOutsideStrings(expression, transform) {
    let output = '';
    let segment = '';
    let quote = null;
    for (const character of String(expression)) {
      if (quote) {
        output += character;
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        output += transform(segment) + character;
        segment = '';
        quote = character;
      } else {
        segment += character;
      }
    }
    return output + transform(segment);
  }

  function filterCalculation(expression) {
    return transformOutsideStrings(expression, (segment) => {
      let output = '';
      let index = 0;
      while (index < segment.length) {
        const previous = index > 0 ? segment[index - 1] : '';
        MATH_FUNCTION_PATTERN.lastIndex = index;
        const match = !/[\w.$]/.test(previous) ? MATH_FUNCTION_PATTERN.exec(segment) : null;
        if (match) {
          output += 'Math.' + match[1].toLowerCase() + '(';
          index += match[0].length;
        } else {
          output += segment[index];
          index++;
        }
      }
      return output;
    });
  }

  function filterCondition(expression) {
    return transformOutsideStrings(expression, (segment) => segment.replace(/ OU /gi, ' || ').replace(/ ET /gi, ' && '));
  }

  /* ------------------------------------------------------------------ */
  /* Numérotation et listing                                             */
  /* ------------------------------------------------------------------ */

  function numberLines(algorithm) {
    const numberedLines = [];
    const visit = (node, depth) => {
      numberedLines.push({ number: numberedLines.length + 1, node: node, depth: depth, text: node.text });
      node.children.forEach((child) => visit(child, depth + 1));
    };
    algorithm.tree.forEach((node) => visit(node, 0));
    return numberedLines;
  }

  // Code affiché dans la fenêtre de test (AlgoNoeud + compléments F1/F2).
  function buildListing(algorithm) {
    const listing = numberLines(algorithm).map((line) => ({ number: line.number, depth: line.depth, text: line.text, isAlgorithmLine: true }));
    const addLine = (text) => listing.push({ number: listing.length + 1, depth: 0, text: text, isAlgorithmLine: false });
    const expression = algorithm.numericFunction.expression;
    if (algorithm.numericFunction.isEnabled && expression && !/F1\(/i.test(expression)) {
      addLine('');
      addLine('Fonction numérique utilisée :');
      addLine('F1(x)=' + expression);
    }
    const advanced = algorithm.advancedFunction;
    if (advanced.isEnabled) {
      addLine('');
      addLine('fonction F2(' + advanced.parameters + '):');
      advanced.rules
        .filter((rule) => rule.condition && rule.returnValue)
        .forEach((rule) => addLine('SI (' + rule.condition + ') RENVOYER ' + rule.returnValue));
      if (advanced.defaultValue) addLine('Dans les autres cas, RENVOYER ' + advanced.defaultValue);
    }
    return listing;
  }

  /* ------------------------------------------------------------------ */
  /* Fonctions d'exécution (équivalent du modèle de page web d'AlgoBox) */
  /* ------------------------------------------------------------------ */

  const ERROR_VALUE = 'Erreur';
  const isInvalidNumber = (value) => !isFinite(value) || isNaN(value);

  function sortedSlice(list, start, end) {
    const values = [];
    for (let index = start; index <= end; index++) {
      if (isInvalidNumber(list[index])) return null;
      values.push(list[index]);
    }
    return values.sort((first, second) => first - second);
  }

  function hasInvalidBounds(start, end) {
    return isInvalidNumber(start) || isInvalidNumber(end) || (start < 0 && start > end);
  }

  function computeSum(list, start, end) {
    if (hasInvalidBounds(start, end)) return ERROR_VALUE;
    let sum = 0;
    for (let index = start; index <= end; index++) {
      if (isInvalidNumber(list[index])) return ERROR_VALUE;
      sum += list[index];
    }
    return sum;
  }

  function computeMean(list, start, end) {
    if (hasInvalidBounds(start, end)) return ERROR_VALUE;
    const sum = computeSum(list, start, end);
    return sum === ERROR_VALUE ? ERROR_VALUE : sum / (end - start + 1);
  }

  function computeVariance(list, start, end) {
    if (hasInvalidBounds(start, end)) return ERROR_VALUE;
    const mean = computeMean(list, start, end);
    if (mean === ERROR_VALUE) return ERROR_VALUE;
    const squares = [];
    for (let index = start; index <= end; index++) {
      if (isInvalidNumber(list[index])) return ERROR_VALUE;
      squares[index] = Math.pow(list[index] - mean, 2);
    }
    const sum = computeSum(squares, start, end);
    return sum === ERROR_VALUE ? ERROR_VALUE : sum / (end - start + 1);
  }

  function computeStandardDeviation(list, start, end) {
    if (hasInvalidBounds(start, end)) return ERROR_VALUE;
    const variance = computeVariance(list, start, end);
    if (variance === ERROR_VALUE || variance < 0) return ERROR_VALUE;
    return Math.sqrt(variance);
  }

  function computeMedian(list, start, end) {
    if (hasInvalidBounds(start, end)) return ERROR_VALUE;
    const sorted = sortedSlice(list, start, end);
    if (!sorted) return ERROR_VALUE;
    const count = end - start + 1;
    const middle = Math.floor(count / 2);
    return count % 2 === 0 ? (sorted[middle] + sorted[middle - 1]) / 2 : sorted[middle];
  }

  function computeQuartile(list, start, end, isThirdQuartile) {
    if (hasInvalidBounds(start, end)) return ERROR_VALUE;
    const count = end - start + 1;
    if (count < 4) return ERROR_VALUE;
    const sorted = sortedSlice(list, start, end);
    if (!sorted) return ERROR_VALUE;
    const remainder = count % 4;
    const quotient = Math.floor(count / 4);
    if (!isThirdQuartile) {
      return remainder <= 1 ? (sorted[quotient - 1] + sorted[quotient]) / 2 : sorted[quotient];
    }
    if (remainder === 0) return (sorted[3 * quotient - 1] + sorted[3 * quotient]) / 2;
    if (remainder === 1) return (sorted[3 * quotient] + sorted[3 * quotient + 1]) / 2;
    return remainder === 2 ? sorted[3 * quotient + 1] : sorted[3 * quotient + 2];
  }

  function computeQuartileAlternative(list, start, end, isThirdQuartile) {
    if (hasInvalidBounds(start, end)) return ERROR_VALUE;
    const count = end - start + 1;
    if (count < 4) return ERROR_VALUE;
    const sorted = sortedSlice(list, start, end);
    if (!sorted) return ERROR_VALUE;
    const position = ((isThirdQuartile ? 3 : 1) * count) / 4;
    const quotient = Math.floor(position);
    return position - quotient === 0 ? sorted[quotient - 1] : sorted[quotient];
  }

  function findExtremum(list, start, end, isMaximum, isPositionWanted) {
    if (hasInvalidBounds(start, end)) return ERROR_VALUE;
    if (isInvalidNumber(list[start])) return ERROR_VALUE;
    let bestIndex = start;
    for (let index = start + 1; index <= end; index++) {
      if (isInvalidNumber(list[index])) return ERROR_VALUE;
      if (isMaximum ? list[index] > list[bestIndex] : list[index] < list[bestIndex]) bestIndex = index;
    }
    return isPositionWanted ? bestIndex : list[bestIndex];
  }

  function isInvalidInteger(value) {
    return isInvalidNumber(value) || parseInt(value, 10) != value; // eslint-disable-line eqeqeq
  }

  function computeFactorial(value) {
    if (isInvalidNumber(value) || value < 0 || value > 69 || isInvalidInteger(value)) return ERROR_VALUE;
    return value <= 1 ? 1 : value * computeFactorial(value - 1);
  }

  function computeCombinations(total, chosen) {
    if (isInvalidNumber(total) || total < 0 || total > 100 || isInvalidInteger(total)) return ERROR_VALUE;
    if (isInvalidNumber(chosen) || chosen < 0 || chosen > 100 || isInvalidInteger(chosen)) return ERROR_VALUE;
    let larger = total;
    let smaller = chosen;
    if (smaller > larger) [larger, smaller] = [smaller, larger];
    if (larger === smaller || smaller === 0) return 1;
    if (smaller === 1) return larger;
    let combinations = larger / smaller;
    for (let index = 1; index <= smaller - 1; index++) combinations = (combinations * (larger - index)) / (smaller - index);
    return combinations;
  }

  function computeBinomialProbability(trials, probability, successes) {
    if (isInvalidNumber(trials) || trials < 0 || trials > 100 || isInvalidInteger(trials)) return ERROR_VALUE;
    if (isInvalidNumber(successes) || successes < 0 || successes > 100 || isInvalidInteger(successes)) return ERROR_VALUE;
    if (successes > trials) return ERROR_VALUE;
    if (isInvalidNumber(probability) || probability < 0 || probability > 1) return ERROR_VALUE;
    const combinations = computeCombinations(trials, successes);
    if (combinations === ERROR_VALUE) return ERROR_VALUE;
    return combinations * Math.pow(probability, successes) * Math.pow(1 - probability, trials - successes);
  }

  // Fonction de répartition de la loi normale centrée réduite (série de Taylor de Marsaglia).
  function computeNormalDistributionHalf(absoluteValue) {
    let sum = absoluteValue;
    let previous = 0;
    let term = absoluteValue;
    const square = absoluteValue * absoluteValue;
    let index = 1;
    while (sum > previous) {
      previous = sum;
      index += 2;
      term *= square / index;
      sum = previous + term;
    }
    return sum * Math.exp(-0.5 * square - 0.9189385332046728);
  }

  function computeStandardNormal(value) {
    if (isInvalidNumber(value)) return ERROR_VALUE;
    const absoluteValue = Math.abs(value);
    let probability = 1;
    if (absoluteValue < 5) {
      probability = 0.5 + computeNormalDistributionHalf(absoluteValue);
      probability = Math.floor(probability * 100000000 + 0.5) / 100000000;
    }
    return value < 0 ? 1 - probability : probability;
  }

  function computeNormal(mean, deviation, value) {
    if (isInvalidNumber(mean) || isInvalidNumber(deviation) || deviation <= 0 || isInvalidNumber(value)) return ERROR_VALUE;
    return computeStandardNormal((value - mean) / deviation);
  }

  // Inverse de la loi normale centrée réduite (approximation rationnelle d'Acklam + une correction).
  function computeInverseStandardNormal(probability) {
    if (isInvalidNumber(probability) || probability <= 0 || probability >= 1) return ERROR_VALUE;
    const coefficientsA = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const coefficientsB = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572, 1];
    const coefficientsC = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const coefficientsD = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416, 1];
    const evaluatePolynomial = (coefficients, variable) =>
      coefficients.reduce((accumulator, coefficient, index) => (index === 0 ? coefficient : accumulator * variable + coefficient), 0);
    const cumulative = (value) => {
      const half = computeNormalDistributionHalf(Math.abs(value));
      return value < 0 ? 0.5 - half : 0.5 + half;
    };
    let estimate;
    if (probability < 0.02425) {
      const variable = Math.sqrt(-2 * Math.log(probability));
      estimate = evaluatePolynomial(coefficientsC, variable) / evaluatePolynomial(coefficientsD, variable);
    } else if (probability > 0.97575) {
      const variable = Math.sqrt(-2 * Math.log(1 - probability));
      estimate = -evaluatePolynomial(coefficientsC, variable) / evaluatePolynomial(coefficientsD, variable);
    } else {
      const centered = probability - 0.5;
      const square = centered * centered;
      estimate = (centered * evaluatePolynomial(coefficientsA, square)) / evaluatePolynomial(coefficientsB, square);
    }
    const error = cumulative(estimate) - probability;
    const correction = error * Math.sqrt(2 * Math.PI) * Math.exp((estimate * estimate) / 2);
    return Math.floor((estimate - correction) * 100000000 + 0.5) / 100000000;
  }

  function computeInverseNormal(mean, deviation, probability) {
    if (isInvalidNumber(mean) || isInvalidNumber(deviation) || deviation <= 0) return ERROR_VALUE;
    if (isInvalidNumber(probability) || probability <= 0 || probability >= 1) return ERROR_VALUE;
    return computeInverseStandardNormal(probability) * deviation + mean;
  }

  function drawRandomInteger(lower, upper) {
    if (isInvalidNumber(upper) || upper < 0 || isInvalidInteger(upper)) return ERROR_VALUE;
    if (isInvalidNumber(lower) || lower < 0 || isInvalidInteger(lower)) return ERROR_VALUE;
    if (upper == lower) return ERROR_VALUE; // eslint-disable-line eqeqeq
    const minimum = Math.min(lower, upper);
    const maximum = Math.max(lower, upper);
    return Math.floor((maximum - minimum + 1) * Math.random() + minimum);
  }

  function truncateToInteger(value) {
    return Math.abs(value) < 1 ? 0 : parseInt(value, 10);
  }

  function roundToDecimals(value, decimals) {
    if (isInvalidNumber(value)) return ERROR_VALUE;
    return parseFloat(value.toFixed(truncateToInteger(decimals)));
  }

  function createNumberFormatting(settings) {
    const roundValue = (value) => {
      if (isInvalidNumber(value)) return ERROR_VALUE;
      return settings.isAutoRoundingEnabled ? parseFloat(value.toPrecision(12)) : value;
    };
    const formatNumber = (value) => {
      if (isNaN(value)) return ERROR_VALUE;
      const isNegative = value < 0;
      const precise = String(Math.abs(value).toPrecision(settings.displayedDigits));
      const trimZeros = (text) => {
        let trimmed = text;
        while (trimmed.length > 1 && trimmed.indexOf('.') >= 0 && trimmed.lastIndexOf('0') === trimmed.length - 1) trimmed = trimmed.slice(0, -1);
        if (trimmed.length > 1 && trimmed.lastIndexOf('.') === trimmed.length - 1) trimmed = trimmed.slice(0, -1);
        return trimmed;
      };
      let formatted;
      if (precise.lastIndexOf('e') > 0) {
        const exponentIndex = precise.lastIndexOf('e');
        formatted = trimZeros(precise.slice(0, exponentIndex)) + precise.slice(exponentIndex);
      } else {
        formatted = trimZeros(precise);
      }
      if (formatted[0] === '.') formatted = '0' + formatted;
      return isNegative ? '-' + formatted : formatted;
    };
    return { roundValue, formatNumber };
  }

  // Noms exposés au code généré (ceux de la page web d'AlgoBox).
  function createRuntimeLibrary(settings) {
    const formatting = createNumberFormatting(settings);
    return {
      ALGOBOX_SOMME: computeSum,
      ALGOBOX_MOYENNE: computeMean,
      ALGOBOX_VARIANCE: computeVariance,
      ALGOBOX_ECART_TYPE: computeStandardDeviation,
      ALGOBOX_MEDIANE: computeMedian,
      ALGOBOX_QUARTILE1: (list, start, end) => computeQuartile(list, start, end, false),
      ALGOBOX_QUARTILE3: (list, start, end) => computeQuartile(list, start, end, true),
      ALGOBOX_QUARTILE1_BIS: (list, start, end) => computeQuartileAlternative(list, start, end, false),
      ALGOBOX_QUARTILE3_BIS: (list, start, end) => computeQuartileAlternative(list, start, end, true),
      ALGOBOX_MINIMUM: (list, start, end) => findExtremum(list, start, end, false, false),
      ALGOBOX_MAXIMUM: (list, start, end) => findExtremum(list, start, end, true, false),
      ALGOBOX_POS_MINIMUM: (list, start, end) => findExtremum(list, start, end, false, true),
      ALGOBOX_POS_MAXIMUM: (list, start, end) => findExtremum(list, start, end, true, true),
      ALGOBOX_FACTORIELLE: computeFactorial,
      ALGOBOX_NB_COMBINAISONS: computeCombinations,
      ALGOBOX_COEFF_BINOMIAL: computeCombinations,
      ALGOBOX_LOI_BINOMIALE: computeBinomialProbability,
      ALGOBOX_LOI_NORMALE_CR: computeStandardNormal,
      ALGOBOX_LOI_NORMALE: computeNormal,
      ALGOBOX_INVERSE_LOI_NORMALE_CR: computeInverseStandardNormal,
      ALGOBOX_INVERSE_LOI_NORMALE: computeInverseNormal,
      ALGOBOX_ALEA_ENT: drawRandomInteger,
      ALGOBOX_ENTIER: truncateToInteger,
      ALGOBOX_ARRONDIR: roundToDecimals,
      ALGOBOX_ARRONDI: formatting.roundValue,
      ALGOBOX_FORMAT_TEXTE: formatting.formatNumber,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Repère graphique                                                    */
  /* ------------------------------------------------------------------ */

  const GRAPH_SIZE = 450;
  const COLOR_CODES = { Bleu: 2, Rouge: 3, Vert: 4, Blanc: 9 };
  const STROKE_COLORS = { 0: '#ccc', 1: 'black', 2: '#4040FF', 3: '#FF420E', 4: '#00CC00', 5: 'black' };

  // Dessine comme ALGOBOX_REPERE / ALGOBOX_POINT / ALGOBOX_TRAIT sur deux calques
  // (repère et tracés) de 454 × 454 pixels logiques.
  class GraphRenderer {
    constructor(frameContext, drawingContext, settings) {
      this.frameContext = frameContext;
      this.drawingContext = drawingContext;
      this.settings = settings || DEFAULT_SETTINGS;
      this.bounds = { xMin: -10, xMax: 10, yMin: -10, yMax: 10, xStep: 1, yStep: 1 };
    }

    reset() {
      this.clearContext(this.frameContext);
      this.clearContext(this.drawingContext);
    }

    clearContext(context) {
      if (context) context.clearRect(0, 0, GRAPH_SIZE + 4, GRAPH_SIZE + 4);
    }

    clearDrawing() {
      this.clearContext(this.drawingContext);
    }

    toPixelX(x) {
      return (GRAPH_SIZE / (this.bounds.xMax - this.bounds.xMin)) * (x - this.bounds.xMin);
    }

    toPixelY(y) {
      return (-GRAPH_SIZE / (this.bounds.yMax - this.bounds.yMin)) * (y - this.bounds.yMax);
    }

    defineFrame(xMin, xMax, yMin, yMax, xStep, yStep) {
      const bounds = { xMin, xMax, yMin, yMax, xStep, yStep };
      if (bounds.xMin >= bounds.xMax || bounds.yMin >= bounds.yMax) Object.assign(bounds, { xMin: -10, xMax: 10, yMin: -10, yMax: 10 });
      if (bounds.xStep <= 0) bounds.xStep = 1;
      if (bounds.yStep <= 0) bounds.yStep = 1;
      if ((bounds.xMax - bounds.xMin) / bounds.xStep > 45) bounds.xStep = Math.round((bounds.xMax - bounds.xMin) / 45);
      if ((bounds.yMax - bounds.yMin) / bounds.yStep > 45) bounds.yStep = Math.round((bounds.yMax - bounds.yMin) / 45);
      this.bounds = bounds;
      const originX = bounds.xMin * bounds.xMax <= 0 ? 0 : bounds.xMin;
      const originY = bounds.yMin * bounds.yMax <= 0 ? 0 : bounds.yMin;
      const firstX = originX - Math.trunc((originX - bounds.xMin) / bounds.xStep) * bounds.xStep;
      const firstY = originY - Math.trunc((originY - bounds.yMin) / bounds.yStep) * bounds.yStep;
      for (let x = firstX, guard = 0; x <= bounds.xMax && guard < 1000; x += bounds.xStep, guard++) this.drawFrameLine(x, bounds.yMin, x, bounds.yMax, 0);
      for (let y = firstY, guard = 0; y <= bounds.yMax && guard < 1000; y += bounds.yStep, guard++) this.drawFrameLine(bounds.xMin, y, bounds.xMax, y, 0);
      if (this.frameContext) {
        this.frameContext.strokeStyle = 'black';
        this.frameContext.lineWidth = 1;
        this.frameContext.strokeRect(2, 2, GRAPH_SIZE, GRAPH_SIZE);
      }
      if (bounds.xMin * bounds.xMax <= 0) this.drawFrameLine(0, bounds.yMin, 0, bounds.yMax, 5);
      if (bounds.yMin * bounds.yMax <= 0) this.drawFrameLine(bounds.xMin, 0, bounds.xMax, 0, 5);
      return bounds;
    }

    drawFrameLine(xStart, yStart, xEnd, yEnd, colorCode) {
      const context = this.frameContext;
      if (!context) return;
      context.beginPath();
      context.strokeStyle = STROKE_COLORS[colorCode];
      context.lineWidth = 1;
      context.moveTo(Math.round(this.toPixelX(xStart)) + 2.5, Math.round(this.toPixelY(yStart)) + 2.5);
      context.lineTo(Math.round(this.toPixelX(xEnd)) + 2.5, Math.round(this.toPixelY(yEnd)) + 2.5);
      context.stroke();
    }

    isInside(x, y) {
      const bounds = this.bounds;
      return !(x < bounds.xMin || x > bounds.xMax || y < bounds.yMin || y > bounds.yMax);
    }

    drawPoint(x, y, colorCode) {
      const context = this.drawingContext;
      if (!context || !this.isInside(x, y)) return;
      const isEraser = colorCode === 9;
      context.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
      context.beginPath();
      context.fillStyle = isEraser ? 'rgba(0,0,0,1)' : STROKE_COLORS[colorCode];
      context.arc(this.toPixelX(x) + 2, this.toPixelY(y) + 2, this.settings.pointWidth, 0, Math.PI * 2, true);
      context.closePath();
      context.fill();
      context.globalCompositeOperation = 'source-over';
    }

    regionCode(x, y) {
      const bounds = this.bounds;
      return [x < bounds.xMin ? 1 : 0, x > bounds.xMax ? 1 : 0, y < bounds.yMin ? 1 : 0, y > bounds.yMax ? 1 : 0];
    }

    // Découpage du segment par la fenêtre (même méthode qu'ALGOBOX_TRAIT).
    clipSegment(xStart, yStart, xEnd, yEnd) {
      let startCode = this.regionCode(xStart, yStart);
      let endCode = this.regionCode(xEnd, yEnd);
      const isInsideCode = (code) => code.every((flag) => flag === 0);
      if (isInsideCode(startCode) && isInsideCode(endCode)) return [xStart, yStart, xEnd, yEnd];
      if (startCode.some((flag, index) => flag && endCode[index])) return null;
      const bounds = this.bounds;
      const moveToEdge = (x, y, code, otherX, otherY) => {
        const deltaX = otherX - x;
        const deltaY = otherY - y;
        if (code[0]) return [bounds.xMin, y + ((bounds.xMin - x) * deltaY) / deltaX];
        if (code[1]) return [bounds.xMax, y + ((bounds.xMax - x) * deltaY) / deltaX];
        if (code[2]) return [x + ((bounds.yMin - y) * deltaX) / deltaY, bounds.yMin];
        return [x + ((bounds.yMax - y) * deltaX) / deltaY, bounds.yMax];
      };
      for (let guard = 0; !isInsideCode(startCode); guard++) {
        if (guard > 8) return null;
        [xStart, yStart] = moveToEdge(xStart, yStart, startCode, xEnd, yEnd);
        startCode = this.regionCode(xStart, yStart);
      }
      for (let guard = 0; !isInsideCode(endCode); guard++) {
        if (guard > 8) return null;
        [xEnd, yEnd] = moveToEdge(xEnd, yEnd, endCode, xStart, yStart);
        endCode = this.regionCode(xEnd, yEnd);
      }
      return [xStart, yStart, xEnd, yEnd];
    }

    drawSegment(xStart, yStart, xEnd, yEnd, colorCode) {
      const context = this.drawingContext;
      const clipped = this.clipSegment(xStart, yStart, xEnd, yEnd);
      if (!context || !clipped) return;
      const isEraser = colorCode === 9;
      context.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
      context.beginPath();
      context.lineWidth = (isEraser ? 2 : 1) * this.settings.lineWidth;
      context.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : STROKE_COLORS[colorCode];
      context.moveTo(Math.round(this.toPixelX(clipped[0])) + 2, Math.round(this.toPixelY(clipped[1])) + 2);
      context.lineTo(Math.round(this.toPixelX(clipped[2])) + 2, Math.round(this.toPixelY(clipped[3])) + 2);
      context.stroke();
      context.globalCompositeOperation = 'source-over';
    }
  }

  /* ------------------------------------------------------------------ */
  /* Traduction en JavaScript                                            */
  /* ------------------------------------------------------------------ */

  class CompilationError extends Error {
    constructor(message, line) {
      super(message);
      this.line = line;
    }
  }

  const STOP_CHECK = 'if (ALGOBOX_RT.isStopRequested) {throw "erreur_emergency";}';

  function compileAlgorithm(algorithm) {
    const variables = listVariables(algorithm);
    const variableTypes = new Map();
    variables.forEach((variable) => {
      if (!variableTypes.has(variable.name)) variableTypes.set(variable.name, variable.type);
    });
    const uniqueNames = Array.from(variableTypes.keys());
    const settings = algorithm.settings;
    const frame = algorithm.frame;
    const expressionChecks = [];
    let lineNumber = 0;
    let maxDepth = 0;

    const literal = (text) => JSON.stringify(String(text));
    const checkExpression = (expression, line) => {
      expressionChecks.push({ expression: expression, line: line });
      return expression;
    };
    const setLine = (line) => 'ALGOBOX_LIGNE_COURANTE=' + line + ';\n' + STOP_CHECK + '\n';
    const stepInfo = (line, message, context) =>
      context.isInFunction ? '' : 'if (ALGOBOX_PAS_A_PAS) {if (!(yield {type:"info",ligne:' + line + ',message:' + message + '})) {throw "erreur_pause";}}\n';
    const stepPause = (line, context) =>
      context.isInFunction ? '' : 'if (ALGOBOX_PAS_A_PAS) {if (!(yield {type:"pas",ligne:' + line + '})) {throw "erreur_pause";}}\n';
    const display = (expression, hasNewline, context) =>
      (context.isInFunction ? 'ALGOBOX_AFFICHER_SYNC(' : 'yield* ALGOBOX_AFFICHER(') + expression + ',' + (hasNewline ? 'true' : 'false') + ');';
    const askInput = (message, context) =>
      context.isInFunction ? 'ALGOBOX_RT.requestSyncInput(' + literal(message) + ')' : '(yield {type:"lecture",message:' + literal(message) + '})';
    const frameExpression = (value) => {
      const expression = filterCalculation(value || '');
      return expression.trim() ? '(' + expression + ')' : 'undefined';
    };
    const defineFrameIfNeeded = (line) => {
      const values = [frame.xMin, frame.xMax, frame.yMin, frame.yMax, frame.xStep, frame.yStep].map((value) => checkExpression(frameExpression(value), line));
      return (
        'if (!ALGOBOX_RT.isFrameDefined) {\n' +
        values.map((value) => 'if (ALGOBOX_ARRONDI(' + value + ')=="Erreur") {throw "erreur_repere";}\n').join('') +
        'ALGOBOX_RT.defineFrame(' +
        values.join(',') +
        ');\n}\n'
      );
    };

    const generateNode = (node, depth, context) => {
      lineNumber++;
      const line = lineNumber;
      maxDepth = Math.max(maxDepth, depth);
      const params = getNodeParams(node);
      const type = getNodeType(node);
      let code = '';
      switch (type) {
        case 201: {
          context = { isInFunction: true };
          const parameters = (params[2] || '').trim();
          code = 'function ' + params[1] + '(' + parameters + ')\n{\n';
          checkExpression('function ' + params[1] + '(' + parameters + '){}', line);
          break;
        }
        case 202:
        case 203:
          break;
        case 204:
          code = '}\n';
          break;
        case 205: {
          const expression = checkExpression(filterCalculation(params.slice(1).join('#')), line);
          code = setLine(line) + 'return ALGOBOX_ARRONDI(' + expression + ');\n';
          break;
        }
        case 206:
          code = setLine(line) + checkExpression(params.slice(1).join('#'), line) + ';\n';
          break;
        case 1: {
          if (context.isInFunction) {
            const initialValue = { NOMBRE: 'new Number()', CHAINE: 'new String()', LISTE: 'new Array()' }[params[1]] || '0';
            code = 'var ' + params[2] + '=' + initialValue + ';\n';
          }
          break;
        }
        case 2: {
          const name = params[1];
          const rank = params[2];
          const type = variableTypes.get(name);
          code = setLine(line);
          if (type === 'CHAINE') {
            code += 'ALGOBOX_SAISIE=' + askInput('Entrer ' + name + ' :', context) + ';\n';
            code += name + '=ALGOBOX_SAISIE.replace(/"/g,"");\n';
          } else if (type === 'NOMBRE') {
            code += 'ALGOBOX_SAISIE=' + askInput('Entrer ' + name + ' :' + NUMBER_INPUT_HINT, context) + ';\n';
            code += 'if (!ALGOBOX_SAISIE) {throw "erreur_input";}\n';
            code += 'ALGOBOX_VALEUR=ALGOBOX_CALCULER_EXPRESSION(ALGOBOX_SAISIE);\n';
            code += 'if (ALGOBOX_VALEUR=="Erreur") {throw "erreur_calcul";}\n';
            code += name + '=ALGOBOX_VALEUR;\n';
          } else if (type === 'LISTE') {
            const rankExpression = checkExpression(rank === 'pasliste' ? 'pasliste' : rank, line);
            code += 'ALGOBOX_SAISIE=' + askInput('Entrer le terme de rang ' + rank + ' de la liste ' + name + ' :' + NUMBER_INPUT_HINT, context) + ';\n';
            code += 'if (ALGOBOX_SAISIE===null) {throw "erreur_input";}\n';
            code += 'ALGOBOX_TERMES=String(ALGOBOX_SAISIE).split(/[:]+/g);\n';
            code += 'for (ALGOBOX_INDEX=0;ALGOBOX_INDEX<ALGOBOX_TERMES.length;ALGOBOX_INDEX++)\n{\n';
            code += 'if (!ALGOBOX_TERMES[ALGOBOX_INDEX]) {throw "erreur_input";}\n';
            code += 'ALGOBOX_VALEUR=ALGOBOX_CALCULER_EXPRESSION(ALGOBOX_TERMES[ALGOBOX_INDEX]);\n';
            code += 'if (ALGOBOX_VALEUR=="Erreur") {throw "erreur_calcul";}\n';
            code += name + '[' + rankExpression + '+ALGOBOX_INDEX]=ALGOBOX_VALEUR;\n}\n';
          } else {
            code = '';
            break;
          }
          code += stepPause(line, context);
          break;
        }
        case 3: {
          const name = params[1];
          const type = variableTypes.get(name);
          if (!type) break;
          const hasNewline = params[2] === '1';
          code = setLine(line);
          if (type === 'LISTE') code += display('ALGOBOX_FORMAT_TEXTE(' + name + '[' + checkExpression(params[3], line) + '])', hasNewline, context);
          else if (type === 'NOMBRE') code += display('ALGOBOX_FORMAT_TEXTE(' + name + ')', hasNewline, context);
          else code += display(name, hasNewline, context);
          code += '\n';
          break;
        }
        case 4:
          code = setLine(line) + display(literal(params[1]), params[2] === '1', context) + '\n';
          break;
        case 5: {
          const name = params[1];
          const type = variableTypes.get(name);
          if (!type) break;
          const content = filterCalculation(params[2]);
          const rank = params[3];
          code = setLine(line);
          if (type === 'LISTE') {
            const rankExpression = checkExpression(rank, line);
            content.split(/[:]+/g).forEach((term, index) => {
              code += name + '[' + rankExpression + '+' + index + ']=ALGOBOX_ARRONDI(' + checkExpression(term.trim() || 'undefined', line) + ');\n';
            });
          } else if (type === 'NOMBRE') {
            code += name + '=ALGOBOX_ARRONDI(' + checkExpression(content, line) + ');\n';
          } else {
            code += name + '=' + checkExpression(content, line) + ';\n';
          }
          code += stepPause(line, context);
          break;
        }
        case 20: {
          const expression = checkExpression(filterCalculation(params[1]), line);
          code = setLine(line);
          code += 'algobox_temp_affichcalcul=ALGOBOX_ARRONDI(' + expression + ');\n';
          code += 'if (algobox_temp_affichcalcul=="Erreur") {throw "erreur_calcul";}\n';
          code += stepPause(line, context);
          code += display('ALGOBOX_FORMAT_TEXTE(algobox_temp_affichcalcul)', params[2] === '1', context) + '\n';
          break;
        }
        case 6: {
          const condition = checkExpression(filterCalculation(filterCondition(params.slice(1).join('#'))), line);
          code = setLine(line);
          if (!context.isInFunction) {
            code += 'if (ALGOBOX_PAS_A_PAS)\n{\n';
            code += 'if (' + condition + ') {if (!(yield {type:"info",ligne:' + line + ',message:"La condition est vérifiée"})) {throw "erreur_pause";}}\n';
            code += 'else {if (!(yield {type:"info",ligne:' + line + ',message:"La condition n\'est pas vérifiée"})) {throw "erreur_pause";}}\n}\n';
          }
          code += 'if (' + condition + ')';
          break;
        }
        case 7:
          code = '{\n' + setLine(line) + stepInfo(line, '"Entrée dans le bloc DEBUT_SI/FIN_SI"', context);
          break;
        case 8:
          code = setLine(line) + stepInfo(line, '"Sortie du bloc DEBUT_SI/FIN_SI"', context) + '}';
          break;
        case 9:
          code = 'else';
          break;
        case 10:
          code = '{\n' + setLine(line) + stepInfo(line, '"Entrée dans le bloc DEBUT_SINON/FIN_SINON"', context);
          break;
        case 11:
          code = setLine(line) + stepInfo(line, '"Sortie du bloc DEBUT_SINON/FIN_SINON"', context) + '}';
          break;
        case 12: {
          const name = params[1];
          const start = checkExpression(filterCalculation(params[2]), line);
          const end = checkExpression(filterCalculation(params[3]), line);
          code = 'ALGOBOX_SECURITE_BOUCLE' + depth + '=0;\n' + setLine(line);
          code += 'for (' + name + '=' + start + ';' + name + '<=' + end + ';' + name + '++)';
          break;
        }
        case 13:
        case 16: {
          const counter = 'ALGOBOX_SECURITE_BOUCLE' + (depth - 1);
          code = '{\n' + counter + '++;\nALGOBOX_COMPTEUR_BOUCLE_GLOBAL++;\n' + setLine(line);
          if (!context.isInFunction) {
            if (type === 13) {
              code +=
                'if (ALGOBOX_PAS_A_PAS) {ALGOBOX_RT.trace(' +
                literal('Entrée dans le bloc DEBUT_POUR/FIN_POUR (ligne ' + line + ')') +
                ',true); if (!(yield {type:"pas",ligne:' +
                line +
                '})) {throw "erreur_pause";}}\n';
            } else {
              code += stepInfo(line, '"Entrée dans le bloc DEBUT_TANT_QUE/FIN_TANT_QUE : condition vérifiée"', context);
            }
          }
          break;
        }
        case 14:
        case 17: {
          const counter = 'ALGOBOX_SECURITE_BOUCLE' + (depth - 1);
          const blockName = type === 14 ? 'DEBUT_POUR/FIN_POUR' : 'DEBUT_TANT_QUE/FIN_TANT_QUE';
          code = setLine(line) + stepInfo(line, literal('Sortie du bloc ' + blockName), context);
          code += 'if (ALGOBOX_DEPASSEMENT_AFFICHAGE) {throw "erreur_affiche";}\n';
          code += 'if (' + counter + '>' + settings.maxLoopIterations + ') {throw "erreur_boucle";}\n';
          if (!context.isInFunction) code += 'if (ALGOBOX_COMPTEUR_BOUCLE_GLOBAL%10000==0) {yield {type:"ping"};}\n';
          code += 'if (ALGOBOX_COMPTEUR_BOUCLE_GLOBAL>' + settings.maxTotalIterations + ') {throw "erreur_boucle";}\n}';
          break;
        }
        case 15: {
          const condition = checkExpression(filterCalculation(filterCondition(params.slice(1).join('#'))), line);
          code = 'ALGOBOX_SECURITE_BOUCLE' + depth + '=0;\n' + setLine(line) + 'while (' + condition + ')';
          break;
        }
        case 18:
          code = setLine(line);
          if (context.isInFunction) {
            code += 'ALGOBOX_AFFICHER_SYNC(" ",true);ALGOBOX_AFFICHER_SYNC("***Pause***",true);\n';
            code += 'if (!ALGOBOX_RT.requestSyncConfirm("Pause : continuer l\'algorithme ?")) {throw "erreur_pause";}\n';
          } else {
            code += 'yield* ALGOBOX_AFFICHER(" ",true);yield* ALGOBOX_AFFICHER("***Pause***",true);\n';
            code += 'if (!(yield {type:"pause",ligne:' + line + '})) {throw "erreur_pause";}\n';
          }
          break;
        case 50:
        case 51: {
          if (!frame.isEnabled) break;
          const coordinateCount = type === 50 ? 2 : 4;
          if (params.length !== coordinateCount + 2) break;
          const coordinates = params.slice(1, coordinateCount + 1).map((value) => checkExpression(filterCalculation(value), line));
          const colorCode = COLOR_CODES[params[coordinateCount + 1]] || 2;
          code = setLine(line) + defineFrameIfNeeded(line);
          coordinates.forEach((coordinate) => {
            code += 'if (ALGOBOX_ARRONDI(' + coordinate + ')=="Erreur") {throw "erreur_calcul";}\n';
          });
          if (!context.isInFunction) {
            const description =
              (type === 50 ? '"Tracé du point ("' : '"Tracé du segment ("') +
              coordinates.map((coordinate) => '+ALGOBOX_ARRONDI(' + coordinate + ')').join('+","') +
              '+")"';
            code += stepInfo(line, description, context);
          }
          code += (type === 50 ? 'ALGOBOX_RT.drawPoint(' : 'ALGOBOX_RT.drawSegment(') + coordinates.join(',') + ',' + colorCode + ');';
          break;
        }
        case 52:
          code = 'ALGOBOX_LIGNE_COURANTE=' + line + ';\nALGOBOX_RT.clearDrawing();\n';
          break;
        default:
          code = node.text === '' || type === 19 || type === 103 || type === 0 ? setLine(line) : '';
      }
      let childrenCode = '';
      node.children.forEach((child) => {
        childrenCode += generateNode(child, depth + 1, context);
      });
      return code + '\n' + childrenCode;
    };

    const sectionCode = { functions: '', main: '' };
    let startLine = 0;
    let endLine = 0;
    algorithm.tree.forEach((topNode) => {
      const type = getNodeType(topNode);
      if (type === 200) {
        lineNumber++;
        topNode.children.forEach((child) => {
          if (getNodeType(child) === 201) {
            sectionCode.functions += generateNode(child, 1, { isInFunction: true });
          } else {
            lineNumber += countNodes(child);
          }
        });
      } else if (type === 101) {
        lineNumber++;
        startLine = lineNumber;
        topNode.children.forEach((child) => {
          sectionCode.main += generateNode(child, 1, { isInFunction: false });
        });
      } else if (type === 102) {
        lineNumber++;
        endLine = lineNumber;
      } else {
        lineNumber += countNodes(topNode);
      }
    });

    const numericFunction = algorithm.numericFunction;
    let firstFunction = 'function F1(x)\n{\nreturn x;\n}\n';
    if (numericFunction.isEnabled && numericFunction.expression && !/F1\(/i.test(numericFunction.expression)) {
      firstFunction = 'function F1(x)\n{\nreturn ' + checkExpression(filterCalculation(numericFunction.expression), 0) + ';\n}\n';
    }
    let secondFunction = '';
    const advanced = algorithm.advancedFunction;
    if (advanced.isEnabled) {
      secondFunction = 'function F2(' + advanced.parameters + ')\n{\nALGOBOX_COMPTEUR_RECURSION++;\n';
      secondFunction += 'if (ALGOBOX_COMPTEUR_RECURSION>100000) return "Erreur";\n';
      advanced.rules.forEach((rule) => {
        if (rule.condition && rule.returnValue) {
          secondFunction +=
            'if (' +
            checkExpression(filterCalculation(filterCondition(rule.condition)), 0) +
            ') return ' +
            checkExpression(filterCalculation(rule.returnValue), 0) +
            ';\n';
        }
      });
      secondFunction += 'return ' + (advanced.defaultValue ? checkExpression(filterCalculation(advanced.defaultValue), 0) : '1') + ';\n}\n';
    }

    const loopCounters = [];
    for (let depth = 0; depth <= maxDepth + 1; depth++) loopCounters.push('ALGOBOX_SECURITE_BOUCLE' + depth + '=0');
    const initialValues = uniqueNames.map((name) => name + '=' + ({ NOMBRE: '0', CHAINE: '""', LISTE: '[]' }[variableTypes.get(name)] || '0') + ';').join('\n');

    const source = [
      'var ALGOBOX_LIGNE_COURANTE=0,ALGOBOX_COMPTEUR_BOUCLE_GLOBAL=0,ALGOBOX_COMPTEUR_RECURSION=0,ALGOBOX_COMPTEUR_AFFICHAGE=0,ALGOBOX_DEPASSEMENT_AFFICHAGE=false,ALGOBOX_SAISIE,ALGOBOX_VALEUR,ALGOBOX_TERMES,ALGOBOX_INDEX,algobox_temp_affichcalcul;',
      'var ' + loopCounters.join(',') + ';',
      uniqueNames.length ? 'var ' + uniqueNames.join(',') + ';' : '',
      'function ALGOBOX_EVAL_SAISIE(ALGOBOX_EXPRESSION){with(Math){return eval(ALGOBOX_EXPRESSION);}}',
      'function ALGOBOX_CALCULER_EXPRESSION(ALGOBOX_CALCUL){',
      'ALGOBOX_CALCUL=String(ALGOBOX_CALCUL);',
      'while (ALGOBOX_CALCUL.charAt(0)=="0" && ALGOBOX_CALCUL.length>1 && ALGOBOX_CALCUL.charAt(1)!=".") {ALGOBOX_CALCUL=ALGOBOX_CALCUL.substr(1);}',
      'var ALGOBOX_R=ALGOBOX_EVAL_SAISIE(ALGOBOX_CALCUL);',
      'if (!isFinite(ALGOBOX_R) || isNaN(ALGOBOX_R)) return "Erreur";',
      'return ALGOBOX_ARRONDI(ALGOBOX_R);}',
      'function* ALGOBOX_AFFICHER(ALGOBOX_TEXTE,ALGOBOX_RETOUR){',
      'ALGOBOX_COMPTEUR_AFFICHAGE++;',
      'if (ALGOBOX_COMPTEUR_AFFICHAGE>=' +
        settings.maxDisplays +
        ') {ALGOBOX_COMPTEUR_AFFICHAGE=0;if (yield {type:"confirmation",message:' +
        literal(TOO_MANY_DISPLAYS_MESSAGE) +
        '}) {ALGOBOX_DEPASSEMENT_AFFICHAGE=true;} else {ALGOBOX_RT.output(ALGOBOX_TEXTE,ALGOBOX_RETOUR);}}',
      'else {ALGOBOX_RT.output(ALGOBOX_TEXTE,ALGOBOX_RETOUR);}}',
      'function ALGOBOX_AFFICHER_SYNC(ALGOBOX_TEXTE,ALGOBOX_RETOUR){',
      'ALGOBOX_COMPTEUR_AFFICHAGE++;',
      'if (ALGOBOX_COMPTEUR_AFFICHAGE>=' +
        settings.maxDisplays +
        ') {ALGOBOX_COMPTEUR_AFFICHAGE=0;if (ALGOBOX_RT.requestSyncConfirm(' +
        literal(TOO_MANY_DISPLAYS_MESSAGE) +
        ')) {ALGOBOX_DEPASSEMENT_AFFICHAGE=true;} else {ALGOBOX_RT.output(ALGOBOX_TEXTE,ALGOBOX_RETOUR);}}',
      'else {ALGOBOX_RT.output(ALGOBOX_TEXTE,ALGOBOX_RETOUR);}}',
      firstFunction,
      secondFunction,
      sectionCode.functions,
      'function* ALGOBOX_ALGO(ALGOBOX_PAS_A_PAS)\n{',
      'ALGOBOX_LIGNE_COURANTE=' + startLine + ';',
      'ALGOBOX_COMPTEUR_BOUCLE_GLOBAL=0;ALGOBOX_COMPTEUR_RECURSION=0;ALGOBOX_COMPTEUR_AFFICHAGE=0;ALGOBOX_DEPASSEMENT_AFFICHAGE=false;',
      initialValues,
      'ALGOBOX_RT.start();',
      'if (ALGOBOX_PAS_A_PAS) {yield* ALGOBOX_AFFICHER("***Algorithme lancé en mode pas à pas***",true);}',
      'else {yield* ALGOBOX_AFFICHER("***Algorithme lancé***",true);}',
      sectionCode.main,
      'ALGOBOX_LIGNE_COURANTE=' + endLine + ';',
      'yield* ALGOBOX_AFFICHER(" ",true);',
      'yield* ALGOBOX_AFFICHER("***Algorithme terminé***",false);',
      '}',
      'return {run:ALGOBOX_ALGO,getCurrentLine:function(){return ALGOBOX_LIGNE_COURANTE;},getValues:function(){return [' + uniqueNames.join(',') + '];}};',
    ].join('\n');

    return {
      source: source,
      variables: uniqueNames.map((name) => ({ name: name, type: variableTypes.get(name) })),
      declarationOrder: variables.map((variable) => ({ name: variable.name, type: variable.type })),
      expressionChecks: expressionChecks,
    };
  }

  function countNodes(node) {
    return 1 + node.children.reduce((total, child) => total + countNodes(child), 0);
  }

  // Cherche la première expression invalide pour indiquer la ligne fautive.
  function locateSyntaxError(compilation) {
    for (const check of compilation.expressionChecks) {
      try {
        // Vérification syntaxique seulement : la fonction créée n'est jamais appelée.
        new Function('return (' + check.expression + ');'); // eslint-disable-line no-new-func
      } catch {
        if (!/^function /.test(check.expression)) return check.line;
        try {
          new Function(check.expression); // eslint-disable-line no-new-func
        } catch {
          return check.line;
        }
      }
    }
    return null;
  }

  const RUNTIME_NAMES = Object.keys(createRuntimeLibrary(DEFAULT_SETTINGS));

  // Construit le programme exécutable. Le code JavaScript produit vient uniquement de
  // l'algorithme écrit par l'utilisateur et s'exécute dans son propre navigateur, comme
  // dans AlgoBox (décision documentée dans docs/decisions.md).
  function buildProgram(algorithm, runtime) {
    const compilation = compileAlgorithm(algorithm);
    const library = createRuntimeLibrary(algorithm.settings);
    let factory;
    try {
      factory = new Function('ALGOBOX_RT', ...RUNTIME_NAMES, compilation.source); // eslint-disable-line no-new-func
    } catch (error) {
      throw new CompilationError(error.message, locateSyntaxError(compilation));
    }
    const program = factory(runtime, ...RUNTIME_NAMES.map((name) => library[name]));
    return { program: program, compilation: compilation, library: library };
  }

  /* ------------------------------------------------------------------ */
  /* Exécution                                                           */
  /* ------------------------------------------------------------------ */

  const ERROR_MESSAGES = {
    erreur_input: (line) => '***Algorithme interrompu ligne ' + line + " : erreur dans la lecture d'une variable ***",
    erreur_calcul: (line) => '***Algorithme interrompu ligne ' + line + ' : erreur de calcul***',
    erreur_boucle: (line) => '***Algorithme interrompu ligne ' + line + ' : dépassement de la capacité autorisée pour les boucles***',
    erreur_affiche: (line) => '***Algorithme interrompu ligne ' + line + ' : affichage trop important de données***',
    erreur_repere: () => '***Algorithme interrompu : erreur dans la définition du repère graphique***',
    erreur_pause: (line) => '***Algorithme interrompu ligne ' + line + '***',
    erreur_emergency: () => '***Algorithme interrompu sur demande***',
  };

  const EXECUTION_STATES = Object.freeze({
    IDLE: 'idle',
    RUNNING: 'running',
    WAITING_INPUT: 'waitingInput',
    PAUSED: 'paused',
    STEPPING: 'stepping',
    CONFIRMING: 'confirming',
    FINISHED: 'finished',
  });

  const TIME_SLICE_MILLISECONDS = 30;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // Pilote l'exécution d'un algorithme. Les gestionnaires reçus en paramètre affichent
  // la console, le suivi pas à pas, le graphique et l'état des boutons.
  class Execution {
    constructor(algorithm, handlers) {
      this.algorithm = algorithm;
      this.handlers = Object.assign(
        {
          onOutput() {},
          onClear() {},
          onTrace() {},
          onStateChange() {},
          onFrameDefined() {},
          requestSyncInput: () => null,
          requestSyncConfirm: () => false,
          schedule: (callback) => setTimeout(callback, 0),
        },
        handlers,
      );
      this.state = EXECUTION_STATES.IDLE;
      this.currentLine = null;
      this.errorLine = null;
      this.lastError = null;
      this.pendingRequest = null;
      this.stepCounter = 0;
      this.isStepMode = false;
      this.generator = null;
    }

    createRuntime() {
      const execution = this;
      const graph = this.handlers.graph || null;
      return {
        isStopRequested: false,
        isFrameDefined: false,
        start() {
          this.isFrameDefined = false;
          execution.handlers.onClear();
          if (graph) graph.reset();
        },
        output(text, hasNewline) {
          const value = text === undefined || text === null ? '' : String(text);
          if (value === '') return;
          execution.handlers.onOutput(value, hasNewline);
        },
        trace(text, hasNewline) {
          const value = String(text);
          if (value === '') return;
          execution.handlers.onTrace(value, hasNewline);
        },
        defineFrame(xMin, xMax, yMin, yMax, xStep, yStep) {
          const bounds = graph ? graph.defineFrame(xMin, xMax, yMin, yMax, xStep, yStep) : { xMin, xMax, yMin, yMax, xStep, yStep };
          const format = execution.library.ALGOBOX_FORMAT_TEXTE;
          execution.handlers.onFrameDefined([
            'Xmin: ' + format(bounds.xMin) + ' ; Xmax: ' + format(bounds.xMax),
            'Ymin: ' + format(bounds.yMin) + ' ; Ymax: ' + format(bounds.yMax),
            'GradX: ' + format(bounds.xStep) + ' ; GradY: ' + format(bounds.yStep),
          ]);
          this.isFrameDefined = true;
        },
        drawPoint(x, y, colorCode) {
          if (graph) graph.drawPoint(x, y, colorCode);
        },
        drawSegment(xStart, yStart, xEnd, yEnd, colorCode) {
          if (graph) graph.drawSegment(xStart, yStart, xEnd, yEnd, colorCode);
        },
        clearDrawing() {
          if (graph) graph.clearDrawing();
        },
        requestSyncInput(message) {
          return execution.handlers.requestSyncInput(message);
        },
        requestSyncConfirm(message) {
          return execution.handlers.requestSyncConfirm(message);
        },
      };
    }

    setState(state, details) {
      this.state = state;
      this.handlers.onStateChange(Object.assign({ state: state, line: this.currentLine }, details || {}));
    }

    start(isStepMode) {
      this.isStepMode = Boolean(isStepMode);
      this.stepCounter = 0;
      this.errorLine = null;
      this.lastError = null;
      this.currentLine = null;
      this.runtime = this.createRuntime();
      let built;
      try {
        built = buildProgram(this.algorithm, this.runtime);
      } catch (error) {
        this.handlers.onClear();
        this.handlers.onOutput("***L'algorithme contient une erreur : impossible de le lancer***", true);
        const location = error.line ? ' (ligne ' + error.line + ')' : '';
        this.handlers.onOutput('***Vérifiez la syntaxe des affectations et des conditions' + location + '***', false);
        this.errorLine = error.line || null;
        this.lastError = error;
        this.currentLine = this.errorLine;
        this.setState(EXECUTION_STATES.FINISHED, { errorLine: this.errorLine });
        return;
      }
      this.program = built.program;
      this.library = built.library;
      this.compilation = built.compilation;
      this.generator = this.program.run(this.isStepMode);
      this.resume(undefined);
    }

    resume(value) {
      this.setState(EXECUTION_STATES.RUNNING);
      let nextValue = value;
      const sliceStart = now();
      for (;;) {
        let step;
        try {
          step = this.generator.next(nextValue);
        } catch (error) {
          this.finishWithError(error);
          return;
        }
        nextValue = undefined;
        if (step.done) {
          this.currentLine = null;
          this.setState(EXECUTION_STATES.FINISHED, { errorLine: null });
          return;
        }
        const request = step.value;
        if (request.type === 'ping') {
          if (now() - sliceStart > TIME_SLICE_MILLISECONDS) {
            this.handlers.schedule(() => {
              if (this.state === EXECUTION_STATES.RUNNING) this.resume(undefined);
            });
            return;
          }
          continue;
        }
        this.pendingRequest = request;
        if (request.type === 'lecture') {
          this.currentLine = this.program.getCurrentLine();
          this.setState(EXECUTION_STATES.WAITING_INPUT, { message: request.message, prompt: request.message.split('\n')[0] });
          return;
        }
        if (request.type === 'pas') {
          this.currentLine = request.ligne;
          this.traceVariableState(request.ligne);
          this.setState(EXECUTION_STATES.STEPPING);
          return;
        }
        if (request.type === 'info') {
          this.currentLine = request.ligne;
          this.runtime.trace(request.message + ' (ligne ' + request.ligne + ')', true);
          this.setState(EXECUTION_STATES.STEPPING);
          return;
        }
        if (request.type === 'pause') {
          this.currentLine = request.ligne;
          this.setState(EXECUTION_STATES.PAUSED);
          return;
        }
        if (request.type === 'confirmation') {
          this.currentLine = this.program.getCurrentLine();
          this.setState(EXECUTION_STATES.CONFIRMING, { message: request.message });
          return;
        }
      }
    }

    // ALGOBOX_AFFICHE_ETAT_VARIABLES : état des variables en mode pas à pas.
    traceVariableState(line) {
      this.stepCounter++;
      const values = this.program.getValues();
      const valueByName = new Map(this.compilation.variables.map((variable, index) => [variable.name, values[index]]));
      const format = this.library.ALGOBOX_FORMAT_TEXTE;
      const declarations = this.compilation.declarationOrder;
      this.runtime.trace('#' + this.stepCounter + ' Nombres/chaines (ligne ' + line + ') -> ', false);
      declarations.forEach((variable, index) => {
        const value = valueByName.get(variable.name);
        if (variable.type === 'NOMBRE' || variable.type === 'CHAINE') {
          this.runtime.trace(variable.name + ':', false);
          this.runtime.trace(variable.type === 'NOMBRE' ? format(value) : value, false);
          if (index < declarations.length - 1) this.runtime.trace(' | ', false);
        }
      });
      declarations.forEach((variable) => {
        if (variable.type !== 'LISTE') return;
        const list = valueByName.get(variable.name) || [];
        this.runtime.trace(' ', true);
        this.runtime.trace('#' + this.stepCounter + ' Liste ' + variable.name + ' (ligne ' + line + ') -> ', false);
        for (let index = 0; index < list.length; index++) {
          const formatted = format(list[index]);
          this.runtime.trace(formatted !== ERROR_VALUE ? formatted : '?', false);
          if (index < list.length - 1) this.runtime.trace(' | ', false);
        }
      });
      this.runtime.trace(' ', true);
    }

    finishWithError(error) {
      const line = this.program ? this.program.getCurrentLine() : null;
      const describe = typeof error === 'string' && ERROR_MESSAGES[error] ? ERROR_MESSAGES[error] : null;
      this.handlers.onOutput(' ', true);
      if (describe) {
        this.handlers.onOutput(describe(line), false);
      } else {
        this.handlers.onOutput('***Algorithme interrompu ligne ' + line + ' suite à une erreur dans son exécution***', false);
      }
      this.lastError = error;
      this.errorLine = line;
      this.currentLine = line;
      this.setState(EXECUTION_STATES.FINISHED, { errorLine: line, error: error });
    }

    submitInput(text) {
      if (this.state !== EXECUTION_STATES.WAITING_INPUT) return false;
      this.pendingRequest = null;
      this.resume(String(text));
      return true;
    }

    continueExecution() {
      if (this.state !== EXECUTION_STATES.STEPPING && this.state !== EXECUTION_STATES.PAUSED) return false;
      this.pendingRequest = null;
      this.resume(true);
      return true;
    }

    answerConfirmation(isStopRequested) {
      if (this.state !== EXECUTION_STATES.CONFIRMING) return false;
      this.pendingRequest = null;
      this.resume(Boolean(isStopRequested));
      return true;
    }

    // Bouton « Arrêter » : refuse la pause en cours, ou demande l'arrêt d'urgence.
    stop() {
      if (this.state === EXECUTION_STATES.STEPPING || this.state === EXECUTION_STATES.PAUSED) {
        this.pendingRequest = null;
        this.resume(false);
      } else if (this.state === EXECUTION_STATES.WAITING_INPUT || this.state === EXECUTION_STATES.CONFIRMING) {
        this.pendingRequest = null;
        this.runtime.isStopRequested = true;
        try {
          this.generator.throw('erreur_emergency');
        } catch (error) {
          this.finishWithError(error);
        }
      } else if (this.state === EXECUTION_STATES.RUNNING) {
        this.runtime.isStopRequested = true;
      }
    }

    isRunning() {
      return this.state !== EXECUTION_STATES.IDLE && this.state !== EXECUTION_STATES.FINISHED;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Exports                                                             */
  /* ------------------------------------------------------------------ */

  // ExporterVersTexte() d'AlgoBox.
  function exportAsText(algorithm, fileName, dateText) {
    let text = (fileName || 'sanstitre') + '  -  ' + dateText + '\n\n';
    text += '******************************************\n' + (algorithm.description || '') + '\n******************************************\n\n';
    const lines = [];
    const writeNode = (node, depth) => {
      lines.push('  '.repeat(depth) + node.text);
      node.children.forEach((child) => writeNode(child, depth + 1));
    };
    algorithm.tree.forEach((node) => writeNode(node, 0));
    lines.forEach((line, index) => {
      const number = String(index + 1);
      text += number + '    '.slice(number.length) + line + '\n';
    });
    const expression = algorithm.numericFunction.expression;
    if (algorithm.numericFunction.isEnabled && expression && !/F1\(/i.test(expression)) {
      text += '\nFonction numérique utilisée :\nF1(x)=' + expression + '\n';
    }
    const advanced = algorithm.advancedFunction;
    if (advanced.isEnabled) {
      if (algorithm.numericFunction.isEnabled) text += '\n';
      text += '\nfonction F2(' + advanced.parameters + '):\n';
      advanced.rules
        .filter((rule) => rule.condition && rule.returnValue)
        .forEach((rule) => {
          text += 'SI (' + rule.condition + ') RENVOYER ' + rule.returnValue + '\n';
        });
      if (advanced.defaultValue) text += 'Dans les autres cas, RENVOYER ' + advanced.defaultValue + '\n';
    }
    return text;
  }

  return {
    ENGINE_VERSION,
    DEFAULT_SETTINGS,
    VARIABLE_TYPES,
    COLORS,
    EXECUTION_STATES,
    GRAPH_SIZE,
    instructions,
    createNode,
    cloneNode,
    getNodeType,
    getNodeParams,
    describeNode,
    updateNode,
    createAlgorithm,
    cloneAlgorithm,
    getSections,
    listVariables,
    listFunctions,
    sanitizeVariableName,
    isForbiddenName,
    findParent,
    isTopLevel,
    getLineCapabilities,
    insertNewLine,
    removeNode,
    replaceNode,
    parseAlgFile,
    serializeAlgFile,
    getNodeCodeLine,
    treeToText,
    textToTree,
    TextSyntaxError,
    filterCalculation,
    filterCondition,
    numberLines,
    buildListing,
    compileAlgorithm,
    CompilationError,
    createRuntimeLibrary,
    GraphRenderer,
    Execution,
    exportAsText,
  };
});
