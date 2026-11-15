# AlgoBox Mobile

Éditeur et testeur d'algorithmes compatible avec [AlgoBox](https://www.xm1math.net/algobox/), pensé pour le téléphone. L'application s'installe depuis le navigateur (PWA) et fonctionne hors ligne.

Le comportement de référence est celui d'AlgoBox 1.2 : mêmes instructions, mêmes messages, mêmes résultats d'exécution et même format de fichier `.alg`. Un algorithme écrit sur ordinateur avec AlgoBox s'ouvre dans l'application, et inversement.

## Fonctionnalités

**Édition**

- Arbre de l'algorithme : `FONCTIONS_UTILISEES`, `VARIABLES`, `DEBUT_ALGORITHME`, `FIN_ALGORITHME`.
- « Nouvelle ligne », « Modifier ligne » (ou double appui), « Supprimer ligne/bloc », copier, couper, coller, avec les règles d'AlgoBox.
- Onglet « Opérations standards » : variables `NOMBRE`, `CHAINE`, `LISTE` ; `LIRE` ; affectation ; `AFFICHER` variable, message ou calcul ; `SI…ALORS…SINON` ; `POUR…DE…A` ; `TANT_QUE` ; `PAUSE` ; commentaire.
- Onglet « Utiliser une fonction numérique » : fonction `F1(x)`.
- Onglet « Dessiner dans un repère » : `TRACER_POINT`, `TRACER_SEGMENT` (rouge, vert, bleu, blanc), `EFFACER_GRAPHIQUE`.
- Onglet « Fonctions locales » : `FONCTION`, variables locales, `RENVOYER`, `APPELER_FONCTION`.
- Fonction avancée `F2`, pour les anciens fichiers qui l'utilisent.
- Mode éditeur de texte, avec vérification du code et modèles d'instructions à compléter.
- Cadre « Présentation » : description et paramètres d'exécution de l'algorithme.

**Test**

- Lancement normal ou pas à pas (Continuer, Arrêter), avec l'état des variables à chaque étape.
- Console des résultats avec saisie des valeurs, ligne en cours surlignée, graphique.
- Limites et messages d'erreur d'AlgoBox (boucles, nombre d'affichages, erreurs de calcul).
- Options : arrondi automatique, nombre maximal d'itérations et d'affichages, épaisseurs, décimales.

**Fichiers**

- Ouvrir un fichier `.alg` ou un code texte, enregistrer sur l'appareil (« Mes algorithmes »), télécharger ou partager le fichier `.alg`.
- Exemples prêts à l'emploi.
- Exports : page web autonome, fichier texte, document LaTeX, image de l'algorithme, impression.

## Installer l'application sur un téléphone

L'application doit être servie en HTTPS (par exemple avec GitHub Pages, voir plus bas).

- **Android (Chrome)** : ouvrir l'adresse, puis menu ⋮ > « Installer l'application ».
- **iPhone et iPad (Safari)** : ouvrir l'adresse, puis bouton Partager > « Sur l'écran d'accueil ».

Après la première ouverture, elle fonctionne sans connexion. Les algorithmes restent enregistrés sur l'appareil.

## Développement

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
```

```bash
npm run check
```

`npm run check` lance le linter (ESLint), le contrôle de formatage (Prettier) et les tests unitaires du moteur. Les tests de bout en bout demandent Playwright et Chromium :

```bash
npm run test:e2e
```

Pour essayer l'application en local, servir le dossier avec n'importe quel serveur statique, par exemple :

```bash
python3 -m http.server 8000
```

puis ouvrir `http://localhost:8000`.

### Organisation

| Fichier                                                                 | Rôle                                                                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `js/algoEngine.js`                                                      | Moteur : modèle de l'arbre, format `.alg`, mode texte, traduction et exécution (sans dépendance au DOM, testé sous Node) |
| `js/exampleLibrary.js`                                                  | Exemples d'algorithmes                                                                                                   |
| `js/app.js`                                                             | Contrôleur de l'interface                                                                                                |
| `js/treeView.js`, `js/textEditor.js`, `js/testWindow.js`                | Arbre, mode texte, fenêtre de test                                                                                       |
| `js/instructionDialogs.js`, `js/commandPalette.js`, `js/helpContent.js` | Boîtes de saisie des instructions et aide                                                                                |
| `js/fileStorage.js`, `js/exporters.js`                                  | Enregistrement local, fichiers et exports                                                                                |
| `serviceWorker.js`, `manifest.webmanifest`, `icons/`                    | Application installable et hors ligne                                                                                    |
| `tests/unit/`, `tests/e2e/`                                             | Tests du moteur et des parcours critiques                                                                                |
| `docs/decisions.md`                                                     | Décisions et écarts documentés                                                                                           |

### Publier une nouvelle version

Modifier `CACHE_VERSION` dans `serviceWorker.js` pour que les appareils déjà installés récupèrent la nouvelle version.

### Mise en ligne avec GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` publie l'application à chaque fusion sur `main`. Il faut l'activer une fois dans les réglages du dépôt : Settings > Pages > Source : « GitHub Actions ».

## Crédits

AlgoBox est un logiciel libre (licence GNU GPL) créé par Pascal Brachet. AlgoBox Mobile est une application indépendante qui reprend son langage et son format de fichier ; le moteur et l'interface ont été réécrits.
