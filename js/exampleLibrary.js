/*
 * Exemples d'algorithmes proposés par « Ouvrir un exemple ».
 * Chaque exemple est écrit dans la syntaxe du mode éditeur de texte d'AlgoBox.
 */
(function registerExamples(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AlgoExamples = factory();
  }
})(typeof self !== 'undefined' ? self : this, function createExamples() {
  'use strict';

  const EXAMPLES = [
    {
      fileName: 'somme_entiers',
      title: 'Somme des entiers de 1 à N',
      description: 'Calcule 1+2+...+N pour un entier N saisi.\n(initiation à la boucle POUR)',
      sampleInputs: ['10'],
      code: `VARIABLES
  N EST_DU_TYPE NOMBRE
  somme EST_DU_TYPE NOMBRE
  i EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  LIRE N
  somme PREND_LA_VALEUR 0
  POUR i ALLANT_DE 1 A N
    DEBUT_POUR
    somme PREND_LA_VALEUR somme+i
    FIN_POUR
  AFFICHER "La somme des entiers de 1 à "
  AFFICHER N
  AFFICHER " vaut "
  AFFICHER somme
FIN_ALGORITHME`,
    },
    {
      fileName: 'pair_impair',
      title: 'Nombre pair ou impair',
      description: "Indique si un entier est pair ou impair à l'aide du reste de la division par 2.\n(initiation à SI...ALORS...SINON)",
      sampleInputs: ['7'],
      code: `VARIABLES
  n EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  LIRE n
  SI (n%2==0) ALORS
    DEBUT_SI
    AFFICHER* "Ce nombre est pair"
    FIN_SI
    SINON
      DEBUT_SINON
      AFFICHER* "Ce nombre est impair"
      FIN_SINON
FIN_ALGORITHME`,
    },
    {
      fileName: 'second_degre',
      title: 'Équation du second degré',
      description: 'Résout ax²+bx+c=0 (a non nul) selon le signe du discriminant.',
      sampleInputs: ['1', '-3', '2'],
      code: `VARIABLES
  a EST_DU_TYPE NOMBRE
  b EST_DU_TYPE NOMBRE
  c EST_DU_TYPE NOMBRE
  delta EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  LIRE a
  LIRE b
  LIRE c
  delta PREND_LA_VALEUR b*b-4*a*c
  SI (delta<0) ALORS
    DEBUT_SI
    AFFICHER* "Pas de solution réelle"
    FIN_SI
    SINON
      DEBUT_SINON
      SI (delta==0) ALORS
        DEBUT_SI
        AFFICHER "Une seule solution : "
        AFFICHERCALCUL* -b/(2*a)
        FIN_SI
        SINON
          DEBUT_SINON
          AFFICHER "Deux solutions : "
          AFFICHERCALCUL (-b-sqrt(delta))/(2*a)
          AFFICHER " et "
          AFFICHERCALCUL* (-b+sqrt(delta))/(2*a)
          FIN_SINON
      FIN_SINON
FIN_ALGORITHME`,
    },
    {
      fileName: 'pgcd_euclide',
      title: "PGCD par l'algorithme d'Euclide",
      description: 'Calcule le PGCD de deux entiers positifs par divisions successives.\n(initiation à TANT_QUE)',
      sampleInputs: ['84', '36'],
      code: `VARIABLES
  a EST_DU_TYPE NOMBRE
  b EST_DU_TYPE NOMBRE
  reste EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  LIRE a
  LIRE b
  TANT_QUE (b!=0) FAIRE
    DEBUT_TANT_QUE
    reste PREND_LA_VALEUR a%b
    a PREND_LA_VALEUR b
    b PREND_LA_VALEUR reste
    FIN_TANT_QUE
  AFFICHER "Le PGCD est "
  AFFICHER a
FIN_ALGORITHME`,
    },
    {
      fileName: 'syracuse',
      title: 'Suite de Syracuse',
      description: "Affiche les termes de la suite de Syracuse jusqu'à atteindre 1, puis le temps de vol.",
      sampleInputs: ['7'],
      code: `VARIABLES
  u EST_DU_TYPE NOMBRE
  vol EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  LIRE u
  vol PREND_LA_VALEUR 0
  TANT_QUE (u!=1) FAIRE
    DEBUT_TANT_QUE
    SI (u%2==0) ALORS
      DEBUT_SI
      u PREND_LA_VALEUR u/2
      FIN_SI
      SINON
        DEBUT_SINON
        u PREND_LA_VALEUR 3*u+1
        FIN_SINON
    vol PREND_LA_VALEUR vol+1
    AFFICHER* u
    FIN_TANT_QUE
  AFFICHER "Temps de vol : "
  AFFICHER vol
FIN_ALGORITHME`,
    },
    {
      fileName: 'table_multiplication',
      title: 'Table de multiplication avec pause',
      description: 'Affiche une table de multiplication et marque une pause après la 5e ligne.\n(essayer aussi le mode pas à pas)',
      sampleInputs: ['7'],
      code: `VARIABLES
  n EST_DU_TYPE NOMBRE
  i EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  LIRE n
  POUR i ALLANT_DE 1 A 10
    DEBUT_POUR
    AFFICHER i
    AFFICHER " x "
    AFFICHER n
    AFFICHER " = "
    AFFICHERCALCUL* i*n
    SI (i==5) ALORS
      DEBUT_SI
      PAUSE
      FIN_SI
    FIN_POUR
FIN_ALGORITHME`,
    },
    {
      fileName: 'dichotomie',
      title: 'Résolution de F1(x)=0 par dichotomie',
      description:
        "Encadre la solution de F1(x)=0 sur [1;2] avec la précision demandée.\nF1 est définie dans l'onglet « Utiliser une fonction numérique » (ici x²-2 : la solution est racine de 2).",
      numericFunction: 'x*x-2',
      sampleInputs: ['0.001'],
      code: `VARIABLES
  a EST_DU_TYPE NOMBRE
  b EST_DU_TYPE NOMBRE
  m EST_DU_TYPE NOMBRE
  precision EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  a PREND_LA_VALEUR 1
  b PREND_LA_VALEUR 2
  LIRE precision
  TANT_QUE (b-a>precision) FAIRE
    DEBUT_TANT_QUE
    m PREND_LA_VALEUR (a+b)/2
    SI (F1(a)*F1(m)<=0) ALORS
      DEBUT_SI
      b PREND_LA_VALEUR m
      FIN_SI
      SINON
        DEBUT_SINON
        a PREND_LA_VALEUR m
        FIN_SINON
    FIN_TANT_QUE
  AFFICHER a
  AFFICHER " < solution < "
  AFFICHER b
FIN_ALGORITHME`,
    },
    {
      fileName: 'courbe_fonction',
      title: 'Courbe représentative de F1',
      description:
        'Trace la courbe de F1 par petits segments.\nLa fonction et le repère sont définis dans les onglets « Utiliser une fonction numérique » et « Dessiner dans un repère ».',
      numericFunction: 'x*x*x-3*x',
      frame: { xMin: '-3', xMax: '3', yMin: '-4', yMax: '4', xStep: '1', yStep: '1' },
      code: `VARIABLES
  x EST_DU_TYPE NOMBRE
  pas EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  pas PREND_LA_VALEUR 0.05
  x PREND_LA_VALEUR -3
  TANT_QUE (x<3) FAIRE
    DEBUT_TANT_QUE
    TRACER_SEGMENT_Rouge (x,F1(x))->(x+pas,F1(x+pas))
    x PREND_LA_VALEUR x+pas
    FIN_TANT_QUE
FIN_ALGORITHME`,
    },
    {
      fileName: 'monte_carlo',
      title: 'Approximation de π (Monte-Carlo)',
      description: 'Place des points au hasard dans un carré de côté 1 et compte ceux situés dans le quart de disque.',
      frame: { xMin: '0', xMax: '1', yMin: '0', yMax: '1', xStep: '0.1', yStep: '0.1' },
      sampleInputs: ['2000'],
      code: `VARIABLES
  n EST_DU_TYPE NOMBRE
  i EST_DU_TYPE NOMBRE
  x EST_DU_TYPE NOMBRE
  y EST_DU_TYPE NOMBRE
  dedans EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  LIRE n
  dedans PREND_LA_VALEUR 0
  POUR i ALLANT_DE 1 A n
    DEBUT_POUR
    x PREND_LA_VALEUR random()
    y PREND_LA_VALEUR random()
    SI (x*x+y*y<=1) ALORS
      DEBUT_SI
      dedans PREND_LA_VALEUR dedans+1
      TRACER_POINT_Vert (x,y)
      FIN_SI
      SINON
        DEBUT_SINON
        TRACER_POINT_Rouge (x,y)
        FIN_SINON
    FIN_POUR
  AFFICHER "Valeur approchée de PI : "
  AFFICHERCALCUL 4*dedans/n
FIN_ALGORITHME`,
    },
    {
      fileName: 'lancers_de',
      title: "Lancers d'un dé et fréquences",
      description: "Simule n lancers d'un dé, affiche la fréquence de chaque face et trace le diagramme en bâtons.",
      frame: { xMin: '0', xMax: '7', yMin: '0', yMax: '0.4', xStep: '1', yStep: '0.05' },
      sampleInputs: ['600'],
      code: `VARIABLES
  effectifs EST_DU_TYPE LISTE
  n EST_DU_TYPE NOMBRE
  i EST_DU_TYPE NOMBRE
  face EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  LIRE n
  effectifs[1] PREND_LA_VALEUR 0:0:0:0:0:0
  POUR i ALLANT_DE 1 A n
    DEBUT_POUR
    face PREND_LA_VALEUR ALGOBOX_ALEA_ENT(1,6)
    effectifs[face] PREND_LA_VALEUR effectifs[face]+1
    FIN_POUR
  POUR i ALLANT_DE 1 A 6
    DEBUT_POUR
    AFFICHER "Face "
    AFFICHER i
    AFFICHER " : fréquence "
    AFFICHERCALCUL* effectifs[i]/n
    TRACER_SEGMENT_Bleu (i,0)->(i,effectifs[i]/n)
    FIN_POUR
FIN_ALGORITHME`,
    },
    {
      fileName: 'tri_bulles',
      title: "Tri à bulles d'une liste",
      description: 'Remplit une liste de 10 entiers aléatoires puis la trie par ordre croissant.',
      code: `VARIABLES
  L EST_DU_TYPE LISTE
  n EST_DU_TYPE NOMBRE
  i EST_DU_TYPE NOMBRE
  j EST_DU_TYPE NOMBRE
  echange EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  n PREND_LA_VALEUR 10
  AFFICHER* "Avant le tri :"
  POUR i ALLANT_DE 1 A n
    DEBUT_POUR
    L[i] PREND_LA_VALEUR ALGOBOX_ALEA_ENT(1,50)
    AFFICHER L[i]
    AFFICHER " "
    FIN_POUR
  AFFICHER* " "
  POUR i ALLANT_DE 1 A n-1
    DEBUT_POUR
    POUR j ALLANT_DE 1 A n-i
      DEBUT_POUR
      SI (L[j]>L[j+1]) ALORS
        DEBUT_SI
        echange PREND_LA_VALEUR L[j]
        L[j] PREND_LA_VALEUR L[j+1]
        L[j+1] PREND_LA_VALEUR echange
        FIN_SI
      FIN_POUR
    FIN_POUR
  AFFICHER* "Après le tri :"
  POUR i ALLANT_DE 1 A n
    DEBUT_POUR
    AFFICHER L[i]
    AFFICHER " "
    FIN_POUR
FIN_ALGORITHME`,
    },
    {
      fileName: 'statistiques',
      title: "Statistiques d'une série de notes",
      description: 'Utilise les fonctions de listes : moyenne, médiane, quartiles et écart-type.',
      code: `VARIABLES
  notes EST_DU_TYPE LISTE
  n EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  notes[1] PREND_LA_VALEUR 12:8:15:10:17:9:13:11
  n PREND_LA_VALEUR 8
  AFFICHER "Moyenne : "
  AFFICHERCALCUL* ALGOBOX_MOYENNE(notes,1,n)
  AFFICHER "Médiane : "
  AFFICHERCALCUL* ALGOBOX_MEDIANE(notes,1,n)
  AFFICHER "Premier quartile : "
  AFFICHERCALCUL* ALGOBOX_QUARTILE1(notes,1,n)
  AFFICHER "Troisième quartile : "
  AFFICHERCALCUL* ALGOBOX_QUARTILE3(notes,1,n)
  AFFICHER "Écart-type : "
  AFFICHERCALCUL* ALGOBOX_ECART_TYPE(notes,1,n)
FIN_ALGORITHME`,
    },
    {
      fileName: 'mot_envers',
      title: "Écrire un mot à l'envers",
      description: 'Utilise les chaînes : longueur (length) et extraction (substr).',
      sampleInputs: ['algorithme'],
      code: `VARIABLES
  mot EST_DU_TYPE CHAINE
  envers EST_DU_TYPE CHAINE
  i EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  LIRE mot
  envers PREND_LA_VALEUR ""
  POUR i ALLANT_DE 1 A mot.length
    DEBUT_POUR
    envers PREND_LA_VALEUR mot.substr(i-1,1)+envers
    FIN_POUR
  AFFICHER envers
FIN_ALGORITHME`,
    },
    {
      fileName: 'factorielle_recursive',
      title: 'Factorielle (fonction récursive)',
      description: "Déclare une fonction locale qui s'appelle elle-même.\n(initiation aux fonctions locales)",
      sampleInputs: ['6'],
      code: `FONCTIONS_UTILISEES
  FONCTION factorielle(k)
    VARIABLES_FONCTION
    DEBUT_FONCTION
    SI (k<=1) ALORS
      DEBUT_SI
      RENVOYER 1
      FIN_SI
    RENVOYER k*factorielle(k-1)
    FIN_FONCTION
VARIABLES
  entier EST_DU_TYPE NOMBRE
DEBUT_ALGORITHME
  LIRE entier
  AFFICHER entier
  AFFICHER "! = "
  AFFICHERCALCUL factorielle(entier)
FIN_ALGORITHME`,
    },
  ];

  // Construit l'algorithme complet d'un exemple à partir de son code texte.
  function createExampleAlgorithm(engine, example) {
    const algorithm = engine.textToTree(example.code);
    algorithm.description = example.description || '';
    if (example.numericFunction) algorithm.numericFunction = { isEnabled: true, expression: example.numericFunction };
    if (example.frame) algorithm.frame = Object.assign({ isEnabled: true }, example.frame);
    return algorithm;
  }

  return { EXAMPLES, createExampleAlgorithm };
});
