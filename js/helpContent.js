// Textes d'aide. Les portions entre accents graves `...` sont affichées comme du code.

import { createElement } from './domHelpers.js';

function renderInline(text) {
  return text.split(/(`[^`]*`)/).map((part) => (part.startsWith('`') ? createElement('code', { text: part.slice(1, -1) }) : part));
}

function renderSections(sections) {
  const container = createElement('div', { className: 'help-text' });
  sections.forEach((section) => {
    if (section.title) container.append(createElement('h3', { text: section.title }));
    if (section.paragraphs) section.paragraphs.forEach((paragraph) => container.append(createElement('p', {}, renderInline(paragraph))));
    if (section.items)
      container.append(
        createElement(
          'ul',
          {},
          section.items.map((item) => createElement('li', {}, renderInline(item))),
        ),
      );
  });
  return container;
}

const NUMBER_SECTION = {
  title: 'Calculs avec les nombres',
  paragraphs: ['En plus de `+`, `-`, `*` et `/`, on peut utiliser (le séparateur décimal est le point) :'],
  items: [
    'racine carrée : `sqrt(x)` ; puissance : `pow(x,n)` ; reste de la division : `x%y`',
    'nombre aléatoire entre 0 et 1 : `random()` ; le nombre π : `Math.PI`',
    "partie entière : `floor(x)` ; arrondi à l'entier : `round(x)` ; valeur absolue : `abs(x)`",
    'trigonométrie (radians) : `cos(x)`, `sin(x)`, `tan(x)`, `acos(x)`, `asin(x)`, `atan(x)`',
    'exponentielle et logarithme népérien : `exp(x)`, `log(x)`',
    'entier aléatoire entre p et n : `ALGOBOX_ALEA_ENT(p,n)` ; arrondi à n décimales : `ALGOBOX_ARRONDIR(x,n)`',
    'probabilités : `ALGOBOX_COEFF_BINOMIAL(n,p)`, `ALGOBOX_LOI_BINOMIALE(n,p,k)`, `ALGOBOX_LOI_NORMALE_CR(x)`, `ALGOBOX_LOI_NORMALE(esp,ecart,x)`, `ALGOBOX_INVERSE_LOI_NORMALE_CR(p)`, `ALGOBOX_INVERSE_LOI_NORMALE(esp,ecart,p)`, `ALGOBOX_FACTORIELLE(n)`',
  ],
};

const LIST_SECTION = {
  title: 'Listes',
  items: [
    'Une variable du type `LISTE` est une liste numérotée de nombres : on écrit `L[1]`, `L[2]`, `L[i]`…',
    "Pour remplir plusieurs termes d'un coup, indiquer le rang du premier terme et séparer les valeurs par `:` (exemple : `L[1] PREND_LA_VALEUR 3:8:5`).",
    'Statistiques des termes de rang p à n : `ALGOBOX_SOMME(L,p,n)`, `ALGOBOX_MOYENNE`, `ALGOBOX_VARIANCE`, `ALGOBOX_ECART_TYPE`, `ALGOBOX_MEDIANE`, `ALGOBOX_QUARTILE1`, `ALGOBOX_QUARTILE3`, `ALGOBOX_QUARTILE1_BIS`, `ALGOBOX_QUARTILE3_BIS`, `ALGOBOX_MINIMUM`, `ALGOBOX_MAXIMUM`, `ALGOBOX_POS_MINIMUM`, `ALGOBOX_POS_MAXIMUM`.',
  ],
};

const STRING_SECTION = {
  title: 'Chaînes',
  items: [
    'Une chaîne s\'écrit entre guillemets : `mot PREND_LA_VALEUR "bonjour"`.',
    'Concaténation : `phrase PREND_LA_VALEUR mot+" à tous"`.',
    'Extraction : `mot.substr(p,n)` donne n caractères à partir de la position p (le premier caractère a la position 0).',
    "Longueur : `mot.length` ; conversion d'un nombre : `nombre.toString()`.",
    'Codes des caractères : `mot.charCodeAt(p)` et `String.fromCharCode(n)`.',
  ],
};

export function renderAssignmentHelp() {
  return renderSections([NUMBER_SECTION, LIST_SECTION, STRING_SECTION]);
}

export function renderConditionHelp() {
  return renderSections([
    {
      title: 'Écrire une condition',
      items: [
        'égal : `==` ; différent : `!=` ; inférieur : `<` ; supérieur : `>` ; inférieur ou égal : `<=` ; supérieur ou égal : `>=`',
        "Combiner deux conditions : `x>0 ET x<10`, `x<0 OU x>10` (mots-clés entourés d'espaces).",
        "Attention : le test d'égalité s'écrit `==` et non `=`.",
      ],
    },
    NUMBER_SECTION,
  ]);
}

export function renderLoopHelp() {
  return renderSections([
    {
      title: 'Boucle POUR',
      items: [
        'La variable compteur doit être du type `NOMBRE` et ne doit pas être modifiée dans la boucle.',
        "Le compteur augmente de 1 à chaque passage, de la valeur de départ jusqu'à la valeur de fin incluse.",
      ],
    },
  ]);
}

export function renderGeneralHelp() {
  return renderSections([
    {
      title: 'Construire un algorithme',
      items: [
        'Déclarer les variables avec « Déclarer nouvelle variable » (types `NOMBRE`, `CHAINE` ou `LISTE`).',
        "Sélectionner une ligne puis « Nouvelle ligne » pour créer une ligne vide, puis choisir une instruction dans les onglets du bas. Choisir une instruction sur une ligne non vide crée d'abord une nouvelle ligne en dessous.",
        'Toucher deux fois une ligne (ou « Modifier ligne ») pour la modifier. « Supprimer ligne/bloc » retire la ligne et tout le bloc qui en dépend.',
        "« Tester » ouvre la fenêtre de test : « Lancer Algorithme » exécute l'algorithme, le mode pas à pas montre l'état des variables à chaque étape.",
      ],
    },
    {
      title: 'Instructions',
      items: [
        '`LIRE x` : la valeur est demandée dans la console des résultats. Une saisie numérique peut être un calcul (`4/3`, `1+sqrt(3)`).',
        '`AFFICHER x`, `AFFICHER "message"`, `AFFICHERCALCUL x+1` : l\'option « retour à la ligne » ajoute un saut de ligne après l\'affichage (en mode texte : `AFFICHER*`).',
        '`x PREND_LA_VALEUR expression` : affectation.',
        '`SI (condition) ALORS` … `SINON` …, `POUR i ALLANT_DE 1 A n`, `TANT_QUE (condition) FAIRE` : blocs délimités par `DEBUT_…` et `FIN_…`.',
        "`PAUSE` suspend l'algorithme jusqu'à « Continuer ».",
        "`TRACER_POINT (x,y)`, `TRACER_SEGMENT (x1,y1)->(x2,y2)`, `EFFACER_GRAPHIQUE` : dessin dans le repère défini dans l'onglet « Dessiner dans un repère ».",
        "`F1(x)` : fonction numérique définie dans l'onglet « Utiliser une fonction numérique ».",
        'Fonctions locales : `FONCTION nom(paramètres)`, variables locales, `RENVOYER valeur`, `APPELER_FONCTION nom(…)`.',
      ],
    },
    {
      title: 'Mode éditeur de texte',
      items: [
        "Menu > Mode éditeur texte : l'algorithme s'écrit directement. « Vérifier code » contrôle la syntaxe et signale la ligne fautive.",
        'Les champs `•` des modèles insérés sont à compléter : « Champ • suivant » sélectionne le prochain.',
      ],
    },
    NUMBER_SECTION,
    LIST_SECTION,
    STRING_SECTION,
    {
      title: 'Fichiers',
      items: [
        "Les algorithmes s'enregistrent sur l'appareil (« Sauver ») et se téléchargent au format `.alg`, lisible par AlgoBox sur ordinateur.",
        "« Ouvrir » accepte les fichiers `.alg` d'AlgoBox et les codes texte.",
      ],
    },
  ]);
}
