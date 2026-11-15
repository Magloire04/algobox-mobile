'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const AlgoEngine = require('../../js/algoEngine.js');

const SUM_PROGRAM = `FONCTIONS_UTILISEES
VARIABLES
  n EST_DU_TYPE NOMBRE
  somme EST_DU_TYPE NOMBRE
  i EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  LIRE n
  somme PREND_LA_VALEUR 0
  POUR i ALLANT_DE 1 A n
    DEBUT_POUR
    somme PREND_LA_VALEUR somme+i
    FIN_POUR
  AFFICHER* "Somme : "
  AFFICHER somme
FIN_ALGORITHME
`;

// Exécute un algorithme en répondant automatiquement aux demandes de l'exécution.
function runAlgorithm(algorithm, options = {}) {
  const inputs = (options.inputs || []).slice();
  const recorded = { output: '', trace: '', states: [], frames: [] };
  return new Promise((resolve) => {
    const execution = new AlgoEngine.Execution(algorithm, {
      onOutput: (text, hasNewline) => {
        recorded.output += text + (hasNewline ? '\n' : '');
      },
      onClear: () => {
        recorded.output = '';
        recorded.trace = '';
      },
      onTrace: (text, hasNewline) => {
        recorded.trace += text + (hasNewline ? '\n' : '');
      },
      onFrameDefined: (legend) => recorded.frames.push(legend),
      graph: options.graph,
      requestSyncInput: () => (inputs.length ? inputs.shift() : null),
      schedule: (callback) => setImmediate(callback),
      onStateChange: (change) => {
        recorded.states.push(change.state);
        if (change.state === 'waitingInput') setImmediate(() => execution.submitInput(inputs.length ? inputs.shift() : ''));
        if (change.state === 'stepping' || change.state === 'paused') {
          setImmediate(() => (options.isStoppedAtFirstPause ? execution.stop() : execution.continueExecution()));
        }
        if (change.state === 'confirming') setImmediate(() => execution.answerConfirmation(true));
        if (change.state === 'finished') resolve(Object.assign(recorded, { errorLine: change.errorLine, execution }));
      },
    });
    execution.start(Boolean(options.isStepMode));
  });
}

function buildFromText(text) {
  return AlgoEngine.textToTree(text);
}

test.describe("modèle de l'algorithme", () => {
  test('un nouvel algorithme contient les quatre sections fixes', () => {
    const algorithm = AlgoEngine.createAlgorithm();
    assert.deepEqual(
      algorithm.tree.map((node) => node.code),
      ['200#declarationfonctions', '100#declarationsvariables', '101#debutalgo', '102#finalgo'],
    );
  });

  test('les instructions produisent le texte et le code enregistrés par AlgoBox', () => {
    const { instructions } = AlgoEngine;
    assert.equal(instructions.read('L', 'i').code, '2#L#i');
    assert.equal(instructions.displayVariable('x', true).code, '3#x#1#pasliste');
    assert.equal(instructions.displayMessage('a#b', false).code, '4#ab#0');
    assert.equal(instructions.assignment('x', 'x+1').text, 'x PREND_LA_VALEUR x+1');
    assert.equal(instructions.segment(0, 1, 2, 3, 'Rouge').text, 'TRACER_SEGMENT (0,1)->(2,3)');
    assert.equal(instructions.declareFunction('f', '').code, '201#f# ');
  });

  test('un nom de variable réservé ou déjà utilisé est refusé', () => {
    const algorithm = buildFromText(SUM_PROGRAM);
    assert.equal(AlgoEngine.isForbiddenName('LIRE'), true);
    assert.equal(AlgoEngine.isForbiddenName('maxi(', algorithm), true);
    assert.equal(AlgoEngine.isForbiddenName('somme', algorithm), true);
    assert.equal(AlgoEngine.isForbiddenName('total', algorithm), false);
  });

  test('le nom saisi est nettoyé comme dans AlgoBox', () => {
    assert.equal(AlgoEngine.sanitizeVariableName(' ma variable* '), 'ma_variable');
  });
});

test.describe("édition de l'arbre", () => {
  test('une nouvelle ligne après FIN_POUR est créée après tout le bloc', () => {
    const algorithm = buildFromText(SUM_PROGRAM);
    const loop = algorithm.tree[2].children[2];
    const endOfLoop = loop.children[loop.children.length - 1];
    const newLine = AlgoEngine.insertNewLine(algorithm, endOfLoop);
    assert.equal(algorithm.tree[2].children[3], newLine);
  });

  test('une nouvelle ligne sur DEBUT_POUR est la première ligne du bloc', () => {
    const algorithm = buildFromText(SUM_PROGRAM);
    const loop = algorithm.tree[2].children[2];
    const newLine = AlgoEngine.insertNewLine(algorithm, loop.children[0]);
    assert.equal(loop.children[1], newLine);
  });

  test("aucune nouvelle ligne n'est possible dans VARIABLES", () => {
    const algorithm = buildFromText(SUM_PROGRAM);
    assert.equal(AlgoEngine.insertNewLine(algorithm, algorithm.tree[1].children[0]), null);
  });

  test("les droits d'une ligne suivent les règles d'AlgoBox", () => {
    const algorithm = buildFromText(SUM_PROGRAM);
    const loop = algorithm.tree[2].children[2];
    const capabilities = AlgoEngine.getLineCapabilities(algorithm, loop, false);
    assert.equal(capabilities.canAddLine, false);
    assert.equal(capabilities.canRemoveLine, true);
    assert.equal(capabilities.canEditLine, true);
    assert.equal(AlgoEngine.getLineCapabilities(algorithm, loop.children[0]).canRemoveLine, false);
  });

  test('une ligne vide accepte une instruction et le collage', () => {
    const algorithm = AlgoEngine.createAlgorithm();
    const newLine = AlgoEngine.insertNewLine(algorithm, algorithm.tree[2]);
    const capabilities = AlgoEngine.getLineCapabilities(algorithm, newLine, true);
    assert.equal(capabilities.canInsertInstruction, true);
    assert.equal(capabilities.canPasteLine, true);
  });

  test('modifier une condition conserve les instructions du bloc', () => {
    const algorithm = AlgoEngine.createAlgorithm();
    const condition = AlgoEngine.instructions.condition('x>0', false);
    condition.children.splice(1, 0, AlgoEngine.instructions.pause());
    AlgoEngine.updateNode(condition, AlgoEngine.instructions.condition('x>1', true));
    assert.equal(condition.text, 'SI (x>1) ALORS');
    assert.deepEqual(
      condition.children.map((node) => node.text),
      ['DEBUT_SI', 'PAUSE', 'FIN_SI', 'SINON'],
    );
    assert.equal(algorithm.tree.length, 4);
  });
});

test.describe('fichier .alg', () => {
  const SAMPLE_FILE = `<?xml version="1.0" encoding="UTF-8"?>
<Algo>
    <description texte="Ligne 1&#xa;Ligne 2" courant="AFFICHER x"/>
    <fonction fctcode="x*x" fctetat="actif"/>
    <repere repetat="inactif" repcode="-5#5#-1#1#1#0.5"/>
    <item algoitem="VARIABLES" code="100#declarationsvariables">
        <item algoitem="x EST_DU_TYPE NOMBRE" code="1#NOMBRE#x"/>
    </item>
    <item algoitem="DEBUT_ALGORITHME" code="101#debutalgo">
        <item algoitem="SI (x>0) ALORS" code="6#x&gt;0">
            <item algoitem="DEBUT_SI" code="7#debutsi"/>
            <item algoitem="FIN_SI" code="8#finsi"/>
        </item>
    </item>
    <item algoitem="FIN_ALGORITHME" code="102#finalgo"/>
</Algo>`;

  test("un ancien fichier sans FONCTIONS_UTILISEES ni paramètres s'ouvre", () => {
    const algorithm = AlgoEngine.parseAlgFile(SAMPLE_FILE);
    assert.equal(algorithm.description, 'Ligne 1\nLigne 2');
    assert.equal(algorithm.numericFunction.expression, 'x*x');
    assert.equal(algorithm.frame.yStep, '0.5');
    assert.equal(algorithm.settings.maxLoopIterations, 500000);
    assert.equal(algorithm.tree[2].children[0].code, '6#x>0');
  });

  test("l'enregistrement puis la relecture redonnent le même algorithme", () => {
    const algorithm = AlgoEngine.parseAlgFile(SAMPLE_FILE);
    const reloaded = AlgoEngine.parseAlgFile(AlgoEngine.serializeAlgFile(algorithm));
    assert.deepEqual(reloaded, algorithm);
  });

  test('les caractères spéciaux sont échappés dans le XML', () => {
    const algorithm = AlgoEngine.createAlgorithm();
    algorithm.tree[2].children.push(AlgoEngine.instructions.displayMessage('a < b & "c"', true));
    assert.match(AlgoEngine.serializeAlgFile(algorithm), /AFFICHER &quot;a &lt; b &amp; &quot;c&quot;&quot;/);
  });

  test("un fichier qui n'est pas un algorithme est refusé", () => {
    assert.throws(() => AlgoEngine.parseAlgFile('<html></html>'), /pas un algorithme/);
  });
});

test.describe('mode éditeur de texte', () => {
  test('le code texte devient un arbre puis redevient le même texte', () => {
    const algorithm = buildFromText(SUM_PROGRAM);
    assert.equal(AlgoEngine.treeToText(algorithm), SUM_PROGRAM);
  });

  test('une variable non déclarée est signalée avec sa ligne', () => {
    const text = SUM_PROGRAM.replace('LIRE n', 'LIRE m');
    assert.throws(
      () => buildFromText(text),
      (error) => error.reason === 'Variable non déclarée.' && error.line === 7,
    );
  });

  test('un champ • non complété est signalé', () => {
    assert.throws(() => buildFromText(SUM_PROGRAM.replace('LIRE n', 'LIRE •')), /champ • non complété \(ligne 7\)/);
  });

  test('un bloc non terminé est signalé', () => {
    assert.throws(() => buildFromText(SUM_PROGRAM.replace('    FIN_POUR\n', '')), /FIN_POUR manquant/);
  });

  test('une instruction inconnue est signalée', () => {
    assert.throws(() => buildFromText(SUM_PROGRAM.replace('LIRE n', 'ECRIRE n')), /Instruction non reconnue \(ligne 7\)/);
  });

  test('les couleurs et le retour à la ligne sont conservés', () => {
    const text = 'VARIABLES\nx EST_DU_TYPE NOMBRE\nDEBUT_ALGORITHME\nTRACER_POINT_Rouge (pow(x,2),x)\nAFFICHERCALCUL* x+1\nFIN_ALGORITHME';
    const statements = buildFromText(text).tree[2].children;
    assert.equal(statements[0].code, '50#pow(x,2)#x#Rouge');
    assert.equal(statements[1].code, '20#x+1#1');
  });
});

test.describe("filtres d'expression", () => {
  test('les fonctions mathématiques reçoivent le préfixe Math.', () => {
    assert.equal(AlgoEngine.filterCalculation('sqrt(x)+COS(y)-acos(z)'), 'Math.sqrt(x)+Math.cos(y)-Math.acos(z)');
  });

  test("Math.sqrt déjà écrit n'est pas modifié", () => {
    assert.equal(AlgoEngine.filterCalculation('Math.sqrt(2)'), 'Math.sqrt(2)');
  });

  test("le texte entre guillemets n'est pas modifié", () => {
    assert.equal(AlgoEngine.filterCalculation('"cos(x)"+cos(x)'), '"cos(x)"+Math.cos(x)');
  });

  test('ET et OU deviennent des opérateurs logiques', () => {
    assert.equal(AlgoEngine.filterCondition('x>0 ET y>0 OU z==1'), 'x>0 && y>0 || z==1');
  });
});

test.describe('fonctions de calcul', () => {
  const library = AlgoEngine.createRuntimeLibrary(AlgoEngine.DEFAULT_SETTINGS);

  test("l'affichage utilise 8 chiffres significatifs", () => {
    assert.equal(library.ALGOBOX_FORMAT_TEXTE(1 / 3), '0.33333333');
    assert.equal(library.ALGOBOX_FORMAT_TEXTE(-2.5), '-2.5');
    assert.equal(library.ALGOBOX_FORMAT_TEXTE(123456789012), '1.2345679e+11');
  });

  test("une valeur non numérique s'affiche Erreur", () => {
    assert.equal(library.ALGOBOX_FORMAT_TEXTE(undefined), 'Erreur');
    assert.equal(library.ALGOBOX_ARRONDI(1 / 0), 'Erreur');
  });

  test("l'arrondi automatique corrige les erreurs de flottants", () => {
    assert.equal(library.ALGOBOX_ARRONDI(0.1 + 0.2), 0.3);
  });

  test('les statistiques sur une liste utilisent les rangs donnés', () => {
    const list = [undefined, 4, 1, 3, 2, 5];
    assert.equal(library.ALGOBOX_SOMME(list, 1, 5), 15);
    assert.equal(library.ALGOBOX_MEDIANE(list, 1, 5), 3);
    assert.equal(library.ALGOBOX_QUARTILE1(list, 1, 5), 1.5);
    assert.equal(library.ALGOBOX_POS_MAXIMUM(list, 1, 5), 5);
    assert.equal(library.ALGOBOX_SOMME(list, 0, 2), 'Erreur');
  });

  test('les probabilités donnent les valeurs attendues', () => {
    assert.equal(library.ALGOBOX_COEFF_BINOMIAL(5, 2), 10);
    assert.equal(library.ALGOBOX_FACTORIELLE(5), 120);
    assert.equal(library.ALGOBOX_FACTORIELLE(70), 'Erreur');
    assert.equal(library.ALGOBOX_LOI_NORMALE_CR(1.96), 0.9750021);
    assert.equal(library.ALGOBOX_INVERSE_LOI_NORMALE_CR(0.975), 1.95996398);
  });

  test('un entier aléatoire reste entre les bornes', () => {
    for (let draw = 0; draw < 200; draw++) {
      const value = library.ALGOBOX_ALEA_ENT(1, 6);
      assert.ok(value >= 1 && value <= 6 && Number.isInteger(value));
    }
    assert.equal(library.ALGOBOX_ALEA_ENT(3, 3), 'Erreur');
  });
});

test.describe('exécution', () => {
  test('un algorithme simple affiche son résultat', async () => {
    const run = await runAlgorithm(buildFromText(SUM_PROGRAM), { inputs: ['10'] });
    assert.equal(run.output, '***Algorithme lancé***\nSomme : \n55 \n***Algorithme terminé***');
  });

  test('la saisie accepte une expression mathématique', async () => {
    const run = await runAlgorithm(buildFromText(SUM_PROGRAM), { inputs: ['sqrt(16)'] });
    assert.match(run.output, /\n10 \n/);
  });

  test("une saisie vide interrompt l'algorithme", async () => {
    const run = await runAlgorithm(buildFromText(SUM_PROGRAM), { inputs: [''] });
    assert.match(run.output, /interrompu ligne 7 : erreur dans la lecture d'une variable/);
    assert.equal(run.errorLine, 7);
  });

  test("un calcul impossible dans AFFICHERCALCUL interrompt l'algorithme", async () => {
    const algorithm = buildFromText('VARIABLES\nDEBUT_ALGORITHME\nAFFICHERCALCUL 1/0\nFIN_ALGORITHME');
    const run = await runAlgorithm(algorithm);
    assert.match(run.output, /interrompu ligne 4 : erreur de calcul/);
  });

  test('une affectation impossible donne la valeur Erreur sans interrompre', async () => {
    const algorithm = buildFromText('VARIABLES\nx EST_DU_TYPE NOMBRE\nDEBUT_ALGORITHME\nx PREND_LA_VALEUR 1/0\nAFFICHER x\nFIN_ALGORITHME');
    const run = await runAlgorithm(algorithm);
    assert.match(run.output, /\nErreur \n\*\*\*Algorithme terminé/);
  });

  test("une boucle infinie est arrêtée par la limite d'itérations", async () => {
    const algorithm = buildFromText(
      'VARIABLES\nx EST_DU_TYPE NOMBRE\nDEBUT_ALGORITHME\nTANT_QUE (x>=0) FAIRE\nDEBUT_TANT_QUE\nx PREND_LA_VALEUR x+1\nFIN_TANT_QUE\nFIN_ALGORITHME',
    );
    algorithm.settings.maxLoopIterations = 1000;
    const run = await runAlgorithm(algorithm);
    assert.match(run.output, /interrompu ligne 8 : dépassement de la capacité autorisée pour les boucles/);
  });

  test('une erreur de syntaxe empêche le lancement et indique la ligne', async () => {
    const algorithm = buildFromText('VARIABLES\nx EST_DU_TYPE NOMBRE\nDEBUT_ALGORITHME\nx PREND_LA_VALEUR (2+\nFIN_ALGORITHME');
    const run = await runAlgorithm(algorithm);
    assert.match(run.output, /impossible de le lancer/);
    assert.equal(run.errorLine, 5);
  });

  test("une variable inconnue dans un calcul provoque une erreur d'exécution", async () => {
    const algorithm = buildFromText('VARIABLES\nx EST_DU_TYPE NOMBRE\nDEBUT_ALGORITHME\nx PREND_LA_VALEUR inconnue_xyz+1\nFIN_ALGORITHME');
    const run = await runAlgorithm(algorithm);
    assert.match(run.output, /interrompu ligne 5 suite à une erreur dans son exécution/);
  });

  test('les listes se remplissent avec le séparateur :', async () => {
    const algorithm = buildFromText(
      'VARIABLES\nL EST_DU_TYPE LISTE\nDEBUT_ALGORITHME\nL[1] PREND_LA_VALEUR 4:7:1\nAFFICHERCALCUL ALGOBOX_SOMME(L,1,3)\nFIN_ALGORITHME',
    );
    const run = await runAlgorithm(algorithm);
    assert.match(run.output, /\n12 \n/);
  });

  test('les chaînes et la condition SINON fonctionnent', async () => {
    const algorithm = buildFromText(`VARIABLES
mot EST_DU_TYPE CHAINE
DEBUT_ALGORITHME
LIRE mot
SI (mot.length>3 ET mot.substr(0,1)=="a") ALORS
DEBUT_SI
AFFICHER* "long"
FIN_SI
SINON
DEBUT_SINON
AFFICHER* "court"
FIN_SINON
FIN_ALGORITHME`);
    assert.match((await runAlgorithm(algorithm, { inputs: ['"avion"'] })).output, /long/);
    assert.match((await runAlgorithm(algorithm, { inputs: ['bus'] })).output, /court/);
  });

  test("une fonction locale récursive est appelée depuis l'algorithme", async () => {
    const algorithm = buildFromText(`FONCTIONS_UTILISEES
FONCTION fact(n)
VARIABLES_FONCTION
DEBUT_FONCTION
SI (n<=1) ALORS
DEBUT_SI
RENVOYER 1
FIN_SI
RENVOYER n*fact(n-1)
FIN_FONCTION
VARIABLES
DEBUT_ALGORITHME
AFFICHERCALCUL fact(6)
FIN_ALGORITHME`);
    assert.match((await runAlgorithm(algorithm)).output, /\n720 \n/);
  });

  test("le mode pas à pas affiche l'état des variables", async () => {
    const algorithm = buildFromText(
      'VARIABLES\nx EST_DU_TYPE NOMBRE\nnom EST_DU_TYPE CHAINE\nDEBUT_ALGORITHME\nx PREND_LA_VALEUR 3\nnom PREND_LA_VALEUR "ok"\nFIN_ALGORITHME',
    );
    const run = await runAlgorithm(algorithm, { isStepMode: true });
    assert.equal(run.trace, '#1 Nombres/chaines (ligne 6) -> x:3 | nom: \n#2 Nombres/chaines (ligne 7) -> x:3 | nom:ok \n');
    assert.match(run.output, /lancé en mode pas à pas/);
  });

  test('arrêter pendant le pas à pas interrompt à la ligne courante', async () => {
    const algorithm = buildFromText('VARIABLES\nx EST_DU_TYPE NOMBRE\nDEBUT_ALGORITHME\nx PREND_LA_VALEUR 3\nFIN_ALGORITHME');
    const run = await runAlgorithm(algorithm, { isStepMode: true, isStoppedAtFirstPause: true });
    assert.match(run.output, /\*\*\*Algorithme interrompu ligne 5\*\*\*$/);
  });

  test('la fonction F1 est utilisable dans les calculs', async () => {
    const algorithm = buildFromText('VARIABLES\nDEBUT_ALGORITHME\nAFFICHERCALCUL F1(3)\nFIN_ALGORITHME');
    algorithm.numericFunction = { isEnabled: true, expression: 'pow(x,2)+1' };
    assert.match((await runAlgorithm(algorithm)).output, /\n10 \n/);
  });

  test("trop d'affichages demande confirmation puis interrompt la boucle", async () => {
    const algorithm = buildFromText(
      'VARIABLES\ni EST_DU_TYPE NOMBRE\nDEBUT_ALGORITHME\nPOUR i ALLANT_DE 1 A 100\nDEBUT_POUR\nAFFICHER i\nFIN_POUR\nFIN_ALGORITHME',
    );
    algorithm.settings.maxDisplays = 10;
    const run = await runAlgorithm(algorithm);
    assert.ok(run.states.includes('confirming'));
    assert.match(run.output, /affichage trop important de données/);
  });

  test('le repère est défini au premier tracé avec sa légende', async () => {
    const algorithm = buildFromText('VARIABLES\nDEBUT_ALGORITHME\nTRACER_POINT (1,1)\nFIN_ALGORITHME');
    algorithm.frame.isEnabled = true;
    const run = await runAlgorithm(algorithm);
    assert.deepEqual(run.frames[0], ['Xmin: -10 ; Xmax: 10', 'Ymin: -10 ; Ymax: 10', 'GradX: 2 ; GradY: 2']);
  });
});

test.describe('repère graphique', () => {
  const renderer = new AlgoEngine.GraphRenderer(null, null, AlgoEngine.DEFAULT_SETTINGS);

  test('un repère invalide revient aux valeurs par défaut', () => {
    assert.deepEqual(renderer.defineFrame(5, 1, 0, 1, 1, 0), { xMin: -10, xMax: 10, yMin: -10, yMax: 10, xStep: 1, yStep: 1 });
  });

  test('un segment qui sort de la fenêtre est découpé', () => {
    renderer.defineFrame(-10, 10, -10, 10, 1, 1);
    assert.deepEqual(renderer.clipSegment(-20, 0, 0, 0), [-10, 0, 0, 0]);
    assert.equal(renderer.clipSegment(-20, -20, -15, 20), null);
  });
});

test.describe('exports', () => {
  test("l'export texte numérote les lignes et ajoute F1", () => {
    const algorithm = buildFromText(SUM_PROGRAM);
    algorithm.numericFunction = { isEnabled: true, expression: 'x+1' };
    const text = AlgoEngine.exportAsText(algorithm, 'somme', '15.11.2026');
    assert.match(text, /^somme {2}- {2}15\.11\.2026\n/);
    assert.match(text, /\n7 {5}LIRE n\n/);
    assert.match(text, /F1\(x\)=x\+1\n$/);
  });
});

test.describe('exemples fournis', () => {
  const { EXAMPLES, createExampleAlgorithm } = require('../../js/exampleLibrary.js');

  EXAMPLES.forEach((example) => {
    test("l'exemple « " + example.title + " » s'exécute jusqu'au bout", async () => {
      const algorithm = createExampleAlgorithm(AlgoEngine, example);
      const reloaded = AlgoEngine.parseAlgFile(AlgoEngine.serializeAlgFile(algorithm));
      const run = await runAlgorithm(reloaded, { inputs: (example.sampleInputs || []).slice() });
      assert.match(run.output, /\*\*\*Algorithme terminé\*\*\*$/, run.output);
    });
  });
});
