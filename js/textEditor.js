// Mode « éditeur de texte » : le code de l'algorithme s'écrit directement.

const FIELD_MARK = '•';

export class TextEditor {
  constructor({ input, gutter, status, onChange }) {
    this.input = input;
    this.gutter = gutter;
    this.status = status;
    this.onChange = onChange;
    input.addEventListener('input', () => {
      this.updateGutter();
      this.hideStatus();
      this.onChange();
    });
    input.addEventListener('scroll', () => (this.gutter.scrollTop = this.input.scrollTop));
    input.addEventListener('keydown', (event) => this.handleKeydown(event));
  }

  setText(text) {
    this.input.value = text;
    this.updateGutter();
    this.hideStatus();
  }

  getText() {
    return this.input.value;
  }

  updateGutter() {
    const count = this.input.value.split('\n').length;
    let numbers = '';
    for (let line = 1; line <= count; line++) numbers += line + '\n';
    this.gutter.textContent = numbers;
    this.gutter.scrollTop = this.input.scrollTop;
  }

  showStatus(message, kind) {
    this.status.textContent = message;
    this.status.className = 'status-message' + (kind ? ' status-message--' + kind : '');
    this.status.hidden = false;
  }

  hideStatus() {
    this.status.hidden = true;
  }

  // Tabulation = champ • suivant ; Entrée conserve l'indentation de la ligne.
  handleKeydown(event) {
    if (event.key === 'Tab') {
      event.preventDefault();
      if (!this.selectNextField()) this.insertText('  ');
    } else if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      const value = this.input.value;
      const lineStart = value.lastIndexOf('\n', this.input.selectionStart - 1) + 1;
      const indentation = /^\s*/.exec(value.slice(lineStart))[0];
      if (indentation) {
        event.preventDefault();
        this.insertText('\n' + indentation);
      }
    }
  }

  insertText(text) {
    const start = this.input.selectionStart;
    const end = this.input.selectionEnd;
    this.input.setRangeText(text, start, end, 'end');
    this.input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Insère un modèle d'instruction sur sa propre ligne, avec l'indentation courante.
  insertSnippet(snippet) {
    const value = this.input.value;
    const cursor = this.input.selectionStart;
    const lineStart = value.lastIndexOf('\n', cursor - 1) + 1;
    const lineEnd = value.indexOf('\n', cursor) === -1 ? value.length : value.indexOf('\n', cursor);
    const currentLine = value.slice(lineStart, lineEnd);
    const indentation = /^\s*/.exec(currentLine)[0];
    const indentedSnippet = snippet
      .split('\n')
      .map((line, index) => (index === 0 ? line : indentation + line))
      .join('\n');
    const isCurrentLineEmpty = currentLine.trim() === '';
    const insertion = isCurrentLineEmpty ? indentation + indentedSnippet : '\n' + indentation + indentedSnippet;
    const insertionStart = isCurrentLineEmpty ? lineStart : lineEnd;
    const insertionEnd = isCurrentLineEmpty ? lineEnd : lineEnd;
    this.input.focus();
    this.input.setRangeText(insertion, insertionStart, insertionEnd, 'end');
    this.input.setSelectionRange(insertionStart, insertionStart);
    if (!this.selectNextField()) this.input.setSelectionRange(insertionStart + insertion.length, insertionStart + insertion.length);
    this.input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  selectNextField() {
    const value = this.input.value;
    let position = value.indexOf(FIELD_MARK, this.input.selectionStart);
    if (position === -1) position = value.indexOf(FIELD_MARK);
    if (position === -1) return false;
    this.input.focus();
    this.input.setSelectionRange(position, position + 1);
    return true;
  }

  selectLine(lineNumber) {
    const lines = this.input.value.split('\n');
    const start = lines.slice(0, lineNumber - 1).reduce((total, line) => total + line.length + 1, 0);
    const end = start + (lines[lineNumber - 1] || '').length;
    this.input.focus();
    this.input.setSelectionRange(start, end);
    const lineHeight = parseFloat(getComputedStyle(this.input).lineHeight) || 21;
    this.input.scrollTop = Math.max(0, (lineNumber - 3) * lineHeight);
  }
}
