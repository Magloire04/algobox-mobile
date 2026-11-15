// Exports de l'algorithme : page web autonome, fichier texte, LaTeX, image et impression.

import { createElement } from './domHelpers.js';

const { exportAsText, numberLines, buildListing } = window.AlgoEngine;

export function formatDate(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return pad(date.getDate()) + '.' + pad(date.getMonth() + 1) + '.' + date.getFullYear();
}

export function buildTextExport(algorithm, fileName) {
  return exportAsText(algorithm, fileName, formatDate());
}

// Échappe un texte pour l'insérer dans un script JSON d'une page HTML.
function toScriptJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// Page web autonome qui exécute l'algorithme (équivalent de « Exporter vers page web »).
export async function buildWebPageExport(algorithm, fileName) {
  const response = await fetch('js/algoEngine.js');
  const engineSource = (await response.text()).replace(/<\/script/gi, '<\\/script');
  const title = 'AlgoBox : ' + fileName;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AlgoBox</title>
<style>
body{font-family:system-ui,Arial,sans-serif;margin:0;padding:16px;background:#fff;color:#111;max-width:820px;margin:0 auto}
h1{font-size:18px;color:#fff;background:#69c;border-radius:8px;padding:6px 16px;display:inline-block}
fieldset{border:1px solid #69c;border-radius:16px;margin:0 0 18px;padding:10px 14px;background:#f9f9f9}
legend{background:#69c;color:#fff;font-weight:bold;border-radius:8px;padding:3px 14px}
.code,.sortie{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px;white-space:pre;overflow:auto}
.sortie{white-space:pre-wrap;min-height:120px;max-height:320px}
.ligne-courante{background:rgba(255,255,0,.6)}
.graphique{position:relative;width:100%;max-width:454px;aspect-ratio:1/1;background:#fff;margin:auto}
.graphique canvas{position:absolute;inset:0;width:100%;height:100%}
button{font:inherit;padding:8px 16px;border-radius:8px;border:1px solid #369;background:#3a6ea5;color:#fff}
#pied{text-align:center;font-size:.8em;color:#479}
</style>
</head>
<body>
<div style="text-align:center"><h1 id="titre"></h1></div>
<p id="description" style="white-space:pre-line"></p>
<fieldset id="cadreGraphique" hidden><legend>Graphique</legend><div class="graphique"><canvas id="repere"></canvas><canvas id="dessin"></canvas></div><p id="legende" class="code" style="text-align:center"></p></fieldset>
<fieldset><legend>Code de l'algorithme</legend><div class="code" id="code"></div></fieldset>
<fieldset><legend>Résultats</legend><p><button type="button" id="lancer">Lancer l'algorithme</button></p><div class="sortie" id="sortie"></div></fieldset>
<div id="pied">Exporté depuis AlgoBox Mobile</div>
<script>
${engineSource}
</script>
<script>
(function () {
  var algorithm = ${toScriptJson(algorithm)};
  var engine = window.AlgoEngine;
  document.getElementById('titre').textContent = ${toScriptJson(title)};
  document.getElementById('description').textContent = algorithm.description || '';
  var code = document.getElementById('code');
  engine.buildListing(algorithm).forEach(function (line) {
    var row = document.createElement('div');
    row.id = 'ligne' + line.number;
    row.textContent = String(line.number).padEnd(5, ' ') + '  '.repeat(line.depth) + line.text;
    code.appendChild(row);
  });
  var sortie = document.getElementById('sortie');
  var ratio = Math.min(window.devicePixelRatio || 1, 3);
  var contextes = ['repere', 'dessin'].map(function (id) {
    var canvas = document.getElementById(id);
    canvas.width = 454 * ratio; canvas.height = 454 * ratio;
    var context = canvas.getContext('2d'); context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return context;
  });
  document.getElementById('lancer').addEventListener('click', function () {
    var surlignee = code.querySelector('.ligne-courante');
    if (surlignee) surlignee.classList.remove('ligne-courante');
    var execution = new engine.Execution(algorithm, {
      graph: new engine.GraphRenderer(contextes[0], contextes[1], algorithm.settings),
      onClear: function () { sortie.textContent = ''; },
      onOutput: function (text, hasNewline) { sortie.textContent += text + (hasNewline ? '\\n' : ''); },
      onFrameDefined: function (legend) {
        document.getElementById('cadreGraphique').hidden = false;
        document.getElementById('legende').textContent = legend.join('\\n');
      },
      requestSyncInput: function (message) { return window.prompt(message); },
      requestSyncConfirm: function (message) { return window.confirm(message); },
      onStateChange: function (change) {
        if (change.state === 'waitingInput') {
          var value = window.prompt(change.message);
          setTimeout(function () { if (value === null) execution.stop(); else { sortie.textContent += change.prompt + ' ' + value + '\\n'; execution.submitInput(value); } }, 0);
        } else if (change.state === 'paused' || change.state === 'stepping') {
          var answer = window.confirm('Pause : continuer l\\'algorithme ?');
          setTimeout(function () { if (answer) execution.continueExecution(); else execution.stop(); }, 0);
        } else if (change.state === 'confirming') {
          var stop = window.confirm(change.message);
          setTimeout(function () { execution.answerConfirmation(stop); }, 0);
        } else if (change.state === 'finished' && change.errorLine) {
          var ligne = document.getElementById('ligne' + change.errorLine);
          if (ligne) { ligne.classList.add('ligne-courante'); ligne.scrollIntoView({ block: 'nearest' }); }
        }
      }
    });
    execution.start(false);
  });
})();
</script>
</body>
</html>
`;
}

const LATEX_REPLACEMENTS = [
  [/\\/g, '\\textbackslash{}'],
  [/([#$%&_{}])/g, '\\$1'],
  [/\^/g, '\\textasciicircum{}'],
  [/~/g, '\\textasciitilde{}'],
];

function escapeLatex(text) {
  return LATEX_REPLACEMENTS.reduce((escaped, [pattern, replacement]) => escaped.replace(pattern, replacement), String(text));
}

// Document LaTeX autonome (package listings) avec les couleurs de l'arbre d'AlgoBox.
export function buildLatexExport(algorithm, fileName) {
  const codeLines = numberLines(algorithm).map((line) => '  '.repeat(line.depth) + line.text);
  const extraLines = buildListing(algorithm)
    .filter((line) => !line.isAlgorithmLine)
    .map((line) => line.text);
  const accents = 'àâäçéèêëîïôöùûüÀÂÇÉÈÊËÎÏÔÙÛœŒ'
    .split('')
    .map((character) => '{' + character + '}{{' + character + '}}1')
    .join(' ');
  return `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[french]{babel}
\\usepackage[margin=2cm]{geometry}
\\usepackage{xcolor}
\\usepackage{listings}
\\definecolor{bloccolor}{RGB}{128,0,0}
\\definecolor{fctcolor}{RGB}{154,77,0}
\\definecolor{sicolor}{RGB}{128,0,128}
\\definecolor{tantquecolor}{RGB}{221,111,6}
\\definecolor{pourcolor}{RGB}{187,136,0}
\\definecolor{commandecolor}{RGB}{0,0,204}
\\lstdefinelanguage{algobox}{
  morekeywords=[1]{VARIABLES,DEBUT_ALGORITHME,FIN_ALGORITHME},
  morekeywords=[2]{FONCTIONS_UTILISEES,FONCTION,VARIABLES_FONCTION,DEBUT_FONCTION,FIN_FONCTION},
  morekeywords=[3]{SI,ALORS,SINON,DEBUT_SI,FIN_SI,DEBUT_SINON,FIN_SINON},
  morekeywords=[4]{TANT_QUE,FAIRE,DEBUT_TANT_QUE,FIN_TANT_QUE},
  morekeywords=[5]{POUR,ALLANT_DE,DEBUT_POUR,FIN_POUR},
  morekeywords=[6]{EST_DU_TYPE,NOMBRE,CHAINE,LISTE,LIRE,AFFICHER,AFFICHERCALCUL,PREND_LA_VALEUR,PAUSE,TRACER_POINT,TRACER_SEGMENT,EFFACER_GRAPHIQUE,RENVOYER,APPELER_FONCTION},
  morecomment=[l]{//},
  morestring=[b]",
  sensitive=true
}
\\lstset{
  language=algobox, basicstyle=\\ttfamily\\small, columns=fullflexible, keepspaces=true,
  numbers=left, numberstyle=\\tiny\\color{gray}, frame=leftline, rulecolor=\\color{gray}, xleftmargin=2em,
  keywordstyle=[1]\\bfseries\\color{bloccolor}, keywordstyle=[2]\\bfseries\\color{fctcolor},
  keywordstyle=[3]\\bfseries\\color{sicolor}, keywordstyle=[4]\\bfseries\\color{tantquecolor},
  keywordstyle=[5]\\bfseries\\color{pourcolor}, keywordstyle=[6]\\color{commandecolor},
  commentstyle=\\itshape\\color{gray}, extendedchars=true,
  literate=${accents}
}
\\begin{document}
\\section*{${escapeLatex(fileName)}}
${algorithm.description ? escapeLatex(algorithm.description).replace(/\n/g, '\\\\\n') + '\n' : ''}
\\begin{lstlisting}
${codeLines.join('\n')}
\\end{lstlisting}
${extraLines.length ? '\\begin{verbatim}\n' + extraLines.join('\n') + '\n\\end{verbatim}\n' : ''}\\end{document}
`;
}

const SYNTAX_COLORS = {
  block: '#800000',
  function: '#9a4d00',
  condition: '#800080',
  whileLoop: '#dd6f06',
  forLoop: '#bb8800',
  command: '#0000cc',
  comment: '#606060',
};

function getLineColor(text) {
  if (text.startsWith('//')) return SYNTAX_COLORS.comment;
  if (/^(VARIABLES|DEBUT_ALGORITHME|FIN_ALGORITHME)$/.test(text)) return SYNTAX_COLORS.block;
  if (/^(FONCTION|FONCTIONS_UTILISEES|VARIABLES_FONCTION|DEBUT_FONCTION|FIN_FONCTION)/.test(text)) return SYNTAX_COLORS.function;
  if (/^(SI |SINON|DEBUT_SI|FIN_SI|DEBUT_SINON|FIN_SINON)/.test(text)) return SYNTAX_COLORS.condition;
  if (/^(TANT_QUE|DEBUT_TANT_QUE|FIN_TANT_QUE)/.test(text)) return SYNTAX_COLORS.whileLoop;
  if (/^(POUR |DEBUT_POUR|FIN_POUR)/.test(text)) return SYNTAX_COLORS.forLoop;
  return '#111111';
}

// « Copie d'écran de l'algorithme » : image PNG de l'arbre.
export function buildTreeImage(algorithm) {
  const lines = numberLines(algorithm);
  const lineHeight = 22;
  const padding = 16;
  const font = '15px ui-monospace, Menlo, Consolas, "Liberation Mono", monospace';
  const measureCanvas = document.createElement('canvas').getContext('2d');
  measureCanvas.font = font;
  const width = Math.max(320, ...lines.map((line) => measureCanvas.measureText('  '.repeat(line.depth) + line.text).width + 18 * line.depth)) + padding * 2;
  const canvas = document.createElement('canvas');
  const ratio = 2;
  canvas.width = Math.ceil(width * ratio);
  canvas.height = Math.ceil((lines.length * lineHeight + padding * 2) * ratio);
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, lines.length * lineHeight + padding * 2);
  context.font = font;
  context.textBaseline = 'middle';
  lines.forEach((line, index) => {
    const y = padding + index * lineHeight + lineHeight / 2;
    const x = padding + line.depth * 18;
    if (line.depth > 0) {
      context.strokeStyle = '#d0d4da';
      context.beginPath();
      context.moveTo(x - 10, y - lineHeight / 2);
      context.lineTo(x - 10, y + lineHeight / 2);
      context.stroke();
    }
    context.fillStyle = getLineColor(line.text);
    context.fillText(line.text, x, y);
  });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// Impression : une page dédiée avec le code numéroté, puis la boîte d'impression du système.
export function printAlgorithm(algorithm, fileName) {
  const listing = buildListing(algorithm);
  const area = createElement('div', { id: 'printArea' }, [
    createElement('h1', { text: 'AlgoBox : ' + fileName }),
    algorithm.description ? createElement('p', { style: 'white-space:pre-line', text: algorithm.description }) : null,
    createElement(
      'pre',
      { style: 'font-size:12px;line-height:1.5' },
      listing.map((line) => String(line.number).padEnd(5, ' ') + '  '.repeat(line.depth) + line.text + '\n').join(''),
    ),
  ]);
  const style = createElement('style', {
    id: 'printStyle',
    text: '@media print { body > *:not(#printArea) { display: none !important; } #printArea { display: block !important; color: #000; } } @media screen { #printArea { display: none; } }',
  });
  document.body.append(style, area);
  const cleanUp = () => {
    area.remove();
    style.remove();
    window.removeEventListener('afterprint', cleanUp);
  };
  window.addEventListener('afterprint', cleanUp);
  window.print();
  setTimeout(cleanUp, 60000);
}
