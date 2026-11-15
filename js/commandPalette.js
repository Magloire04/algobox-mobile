// Commandes proposées dans les boîtes de saisie (affectation, condition, calcul, tracé).
// `insert` est le texte inséré, `cursor` la position du curseur après insertion.

const command = (label, insert, cursor, description) => ({ label, insert, cursor: cursor ?? insert.length, description });

export const OPERATORS = ['+', '-', '*', '/', '%', '(', ')'].map((symbol) => command(symbol, symbol));

export const COMPARISONS = ['==', '!=', '<', '>', '<=', '>=', ' ET ', ' OU '].map((symbol) => command(symbol.trim(), symbol));

export const NUMBER_COMMANDS = [
  command('sqrt(x)', 'sqrt()', 5, 'racine carrée'),
  command('pow(x,n)', 'pow(,)', 4, 'x puissance n'),
  command('random()', 'random()', 8, 'nombre aléatoire entre 0 et 1'),
  command('Math.PI', 'Math.PI', 7, 'le nombre π'),
  command('floor(x)', 'floor()', 6, 'partie entière'),
  command('round(x)', 'round()', 6, 'entier le plus proche'),
  command('abs(x)', 'abs()', 4, 'valeur absolue'),
  command('cos(x)', 'cos()', 4, 'cosinus (radians)'),
  command('sin(x)', 'sin()', 4, 'sinus (radians)'),
  command('tan(x)', 'tan()', 4, 'tangente (radians)'),
  command('acos(x)', 'acos()', 5, 'arc cosinus'),
  command('asin(x)', 'asin()', 5, 'arc sinus'),
  command('atan(x)', 'atan()', 5, 'arc tangente'),
  command('exp(x)', 'exp()', 4, 'exponentielle'),
  command('log(x)', 'log()', 4, 'logarithme népérien'),
  command('x%y', '%', 1, 'reste de la division de x par y'),
  command('ALGOBOX_ALEA_ENT(p,n)', 'ALGOBOX_ALEA_ENT(,)', 17, 'entier aléatoire entre p et n'),
  command('ALGOBOX_ARRONDIR(x,n)', 'ALGOBOX_ARRONDIR(,)', 17, 'x arrondi à n décimales'),
  command('ALGOBOX_COEFF_BINOMIAL(n,p)', 'ALGOBOX_COEFF_BINOMIAL(,)', 23, 'coefficient binomial « p parmi n »'),
  command('ALGOBOX_LOI_BINOMIALE(n,p,k)', 'ALGOBOX_LOI_BINOMIALE(,,)', 22, 'P(X=k) pour la loi binomiale B(n,p)'),
  command('ALGOBOX_LOI_NORMALE_CR(x)', 'ALGOBOX_LOI_NORMALE_CR()', 23, 'P(X<x) pour la loi normale centrée réduite'),
  command('ALGOBOX_LOI_NORMALE(esp,ecart,x)', 'ALGOBOX_LOI_NORMALE(,,)', 20, 'P(X<x) pour la loi normale N(esp,ecart²)'),
  command('ALGOBOX_INVERSE_LOI_NORMALE_CR(p)', 'ALGOBOX_INVERSE_LOI_NORMALE_CR()', 31, 'x tel que P(X<x)=p (centrée réduite)'),
  command('ALGOBOX_INVERSE_LOI_NORMALE(esp,ecart,p)', 'ALGOBOX_INVERSE_LOI_NORMALE(,,)', 28, 'x tel que P(X<x)=p'),
  command('ALGOBOX_FACTORIELLE(n)', 'ALGOBOX_FACTORIELLE()', 20, 'factorielle de n (n<70)'),
];

export const LIST_COMMANDS = [
  ['ALGOBOX_SOMME', 'somme'],
  ['ALGOBOX_MOYENNE', 'moyenne'],
  ['ALGOBOX_VARIANCE', 'variance'],
  ['ALGOBOX_ECART_TYPE', 'écart-type'],
  ['ALGOBOX_MEDIANE', 'médiane'],
  ['ALGOBOX_QUARTILE1', 'Q1 (calculatrice)'],
  ['ALGOBOX_QUARTILE3', 'Q3 (calculatrice)'],
  ['ALGOBOX_QUARTILE1_BIS', 'Q1 (au moins 25 %)'],
  ['ALGOBOX_QUARTILE3_BIS', 'Q3 (au moins 75 %)'],
  ['ALGOBOX_MINIMUM', 'minimum'],
  ['ALGOBOX_MAXIMUM', 'maximum'],
  ['ALGOBOX_POS_MINIMUM', 'rang du minimum'],
  ['ALGOBOX_POS_MAXIMUM', 'rang du maximum'],
].map(([name, description]) => command(name + '(liste,p,n)', name + '(,,)', name.length + 1, description + ' des termes de liste[p] à liste[n]'));

export const STRING_COMMANDS = [
  command('chaine.length', '.length', 7, 'longueur de la chaîne'),
  command('chaine.substr(p,n)', '.substr(,)', 8, 'n caractères à partir de la position p (la 1re position est 0)'),
  command('chaine.charCodeAt(p)', '.charCodeAt()', 12, 'code du caractère en position p'),
  command('String.fromCharCode(n)', 'String.fromCharCode()', 20, 'caractère dont le code est n'),
  command('nombre.toString()', '.toString()', 11, 'nombre transformé en chaîne'),
];

// Commandes qui dépendent de l'algorithme en cours (F1, F2, fonctions locales).
export function getAlgorithmCommands(algorithm, functions) {
  const commands = [];
  if (algorithm.numericFunction.isEnabled) commands.push(command('F1(x)', 'F1()', 3, 'fonction numérique F1'));
  if (algorithm.advancedFunction.isEnabled) commands.push(command('F2(' + algorithm.advancedFunction.parameters + ')', 'F2()', 3, 'fonction avancée F2'));
  functions.forEach((declaredFunction) => {
    const parameters = declaredFunction.parameters;
    commands.push(command(declaredFunction.name + '(' + parameters + ')', declaredFunction.name + '()', declaredFunction.name.length + 1, 'fonction locale'));
  });
  return commands;
}

// Fragments proposés en mode éditeur de texte (liste de complétion d'AlgoBox).
export const TEXT_SNIPPETS = [
  'VARIABLES',
  '• EST_DU_TYPE NOMBRE',
  '• EST_DU_TYPE CHAINE',
  '• EST_DU_TYPE LISTE',
  'DEBUT_ALGORITHME',
  'FIN_ALGORITHME',
  'LIRE •',
  '• PREND_LA_VALEUR •',
  'AFFICHER •',
  'AFFICHER* •',
  'AFFICHER "•"',
  'AFFICHER* "•"',
  'AFFICHERCALCUL •',
  'AFFICHERCALCUL* •',
  'SI (•) ALORS\nDEBUT_SI\n\nFIN_SI',
  'SI (•) ALORS\nDEBUT_SI\n\nFIN_SI\nSINON\nDEBUT_SINON\n\nFIN_SINON',
  'POUR • ALLANT_DE • A •\nDEBUT_POUR\n\nFIN_POUR',
  'TANT_QUE (•) FAIRE\nDEBUT_TANT_QUE\n\nFIN_TANT_QUE',
  'PAUSE',
  '//•',
  'TRACER_POINT (•,•)',
  'TRACER_POINT_Rouge (•,•)',
  'TRACER_POINT_Vert (•,•)',
  'TRACER_POINT_Blanc (•,•)',
  'TRACER_SEGMENT (•,•)->(•,•)',
  'TRACER_SEGMENT_Rouge (•,•)->(•,•)',
  'TRACER_SEGMENT_Vert (•,•)->(•,•)',
  'TRACER_SEGMENT_Blanc (•,•)->(•,•)',
  'EFFACER_GRAPHIQUE',
  'FONCTIONS_UTILISEES',
  'FONCTION •(•)\nVARIABLES_FONCTION\nDEBUT_FONCTION\n\nFIN_FONCTION',
  'RENVOYER •',
  'APPELER_FONCTION •',
];
