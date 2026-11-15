# Décisions et écarts documentés

Chaque écart aux conventions du projet ou au comportement d'AlgoBox est noté ici, avec sa date et sa justification. Issue de référence : #1.

## 2026-11-15 — Exécution de l'algorithme par traduction en JavaScript

**Décision.** Le moteur (`js/algoEngine.js`) traduit l'algorithme en JavaScript puis le compile avec `new Function`. Les saisies numériques de `LIRE` sont évaluées avec `eval` dans un bloc `with (Math)`.

**Pourquoi.** C'est le fonctionnement d'AlgoBox : ses expressions sont du JavaScript (`x.length`, `Math.PI`, `chaine.substr(0,2)`, `random()`...) et une saisie peut être un calcul (`4/3`, `1+sqrt(3)`). Réécrire un interpréteur maison donnerait des résultats différents de ceux d'AlgoBox.

**Encadrement.**

- Le code exécuté vient uniquement de l'algorithme écrit par l'utilisateur et s'exécute dans son propre navigateur. Il n'y a ni serveur, ni compte, ni donnée d'un tiers.
- Les règles ESLint `no-eval`, `no-implied-eval` et `no-new-func` restent en erreur pour tout le projet. Elles ne sont désactivées que ligne par ligne, aux trois endroits où l'algorithme est compilé (commentaire `eslint-disable-line` explicite).
- Les boucles sont limitées (nombre d'itérations par boucle et pour tout l'algorithme) et le bouton « Arrêter » interrompt l'exécution.

## 2026-11-15 — Stockage local avec `localStorage`

**Décision.** Les algorithmes enregistrés, la session en cours et les préférences d'affichage sont conservés dans le `localStorage` du navigateur.

**Pourquoi.** L'application doit fonctionner hors ligne, sans compte. Aucune donnée personnelle, aucun jeton ni secret n'y est stocké : seulement le contenu des algorithmes (format `.alg`) et des préférences.

## 2026-11-15 — Noms du code généré

**Décision.** Les identifiants du projet sont en anglais (camelCase, constantes en majuscules), le texte de l'interface est en français. Le code JavaScript généré pour l'exécution garde en revanche les noms d'AlgoBox (`ALGOBOX_SOMME`, `ALGOBOX_ARRONDI`, `ALGOBOX_LIGNE_COURANTE`...).

**Pourquoi.** Ces noms font partie du langage d'AlgoBox : les élèves les écrivent dans leurs calculs (`ALGOBOX_MOYENNE(L,1,n)`). Les changer casserait la compatibilité des fichiers `.alg`.

## 2026-11-15 — Taille de la première livraison

**Décision.** La première livraison (issue #1) dépasse la taille recommandée d'une pull request (400 lignes).

**Pourquoi.** Elle remplace entièrement la page précédente par une nouvelle application. Les commits sont séparés par couche (outillage, moteur et tests, interface, PWA, tests de bout en bout, intégration continue, documentation) pour faciliter la relecture. Si besoin, la pull request peut être découpée en suivant ces commits.

## 2026-11-15 — Écarts volontaires par rapport à AlgoBox 1.2

Ces différences ne changent pas le résultat des algorithmes valides. Elles corrigent des défauts ou adaptent l'interface au téléphone.

| Sujet                                           | AlgoBox 1.2                                                                        | AlgoBox Mobile                                                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Ajout d'une instruction                         | Il faut d'abord créer une ligne vide (« Nouvelle ligne »)                          | Si la ligne sélectionnée n'est pas vide, une nouvelle ligne est créée automatiquement en dessous                          |
| Numéros de ligne                                | Absents de l'arbre                                                                 | Affichés dans l'arbre (désactivables dans le menu Affichage), pour retrouver les lignes citées dans les messages d'erreur |
| Erreur de syntaxe dans un calcul                | L'algorithme ne se lance pas, sans message                                         | Message « L'algorithme contient une erreur : impossible de le lancer » avec le numéro de la ligne fautive                 |
| Ajout de `Math.` devant `sqrt(`, `cos(`...      | Remplacement aussi dans les chaînes et dans `Math.sqrt(` déjà écrit                | Remplacement seulement hors des chaînes et des noms déjà préfixés                                                         |
| Mode éditeur de texte                           | Analyse tolérante, des blocs mal fermés peuvent produire un arbre incohérent       | Les blocs `DEBUT_…`/`FIN_…` sont contrôlés et l'erreur indique la ligne                                                   |
| Listes au lancement                             | Une liste garde sa longueur d'une exécution à l'autre dans la même fenêtre de test | Chaque exécution part de listes vides                                                                                     |
| Segment qui passe hors du repère près d'un coin | Peut bloquer le logiciel (boucle de découpage sans fin)                            | Le découpage s'arrête et le segment n'est pas tracé                                                                       |
| `LIRE` ou `PAUSE` dans une fonction locale      | Saisie dans la console                                                             | Fenêtre de saisie du navigateur (une fonction locale s'exécute d'un seul tenant)                                          |
| Mode pas à pas sur téléphone                    | Le code est visible à côté de la console                                           | La ligne en cours est aussi rappelée au-dessus des boutons                                                                |

## 2026-11-15 — Déploiement sur le serveur par SSH depuis GitHub Actions (issue #4)

**Décision.** Le workflow `deploy-server.yml` copie l'application par rsync sur SSH à chaque fusion sur `main`, après le linter et les tests unitaires.

**Pourquoi.** Le serveur qui héberge `algobox-mobile.bytechnum.com` n'est pas joignable depuis les outils de développement ; GitHub Actions peut s'y connecter et rend le déploiement reproductible.

**Encadrement.**

- Clé, adresse, port, compte et dossier sont des secrets du dépôt, jamais dans le code. La clé est réservée au déploiement : on peut la révoquer sans toucher à la clé personnelle.
- L'empreinte du serveur est fixée (`DEPLOY_KNOWN_HOSTS`, `StrictHostKeyChecking=yes`) : le workflow refuse un serveur qui se ferait passer pour le vrai.
- La suppression de fichiers (`rsync --delete`) est limitée aux dossiers de l'application (`css/`, `js/`, `app-icons/`). Le reste du dossier du sous-domaine n'est pas touché ; le fichier `.htaccess` du dossier est remplacé par celui du dépôt.
- La copie de GitHub Pages est conservée en secours.

## 2026-11-15 — Politique de sécurité du contenu (CSP)

**Décision.** Le `.htaccess` envoie une CSP qui n'autorise que les ressources du site, avec deux assouplissements : `script-src 'unsafe-eval'` et `style-src 'unsafe-inline'`.

**Pourquoi.** `'unsafe-eval'` est indispensable à l'exécution des algorithmes (voir la première décision). `'unsafe-inline'` couvre les styles posés par l'interface (indentation de l'arbre, impression). Aucun script en ligne n'est autorisé, ce qui garde l'essentiel de la protection contre l'injection de scripts.

## 2026-11-15 — Dossier des icônes renommé en `app-icons/`

**Décision.** Les icônes sont dans `app-icons/` et non `icons/`.

**Pourquoi.** Apache définit par défaut un alias global `/icons/` (icônes des listes de dossiers), que beaucoup d'hébergeurs conservent. Les icônes de l'application y étaient introuvables (erreur 404), ce qui empêche l'installation sur téléphone. Le cache du service worker passe en version 2 pour que les appareils déjà installés suivent le changement.

## Hors périmètre de la première livraison

- Export au format ODF.
- Extensions JavaScript d'AlgoBox (menu « Extension »).
