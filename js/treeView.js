// Affichage de l'arbre de l'algorithme (équivalent du QTreeWidget d'AlgoBox).

import { createElement, renderHighlightedLine } from './domHelpers.js';

const DOUBLE_TAP_DELAY = 350;
const INDENT_WIDTH = 18;

export class TreeView {
  constructor(container, { onSelect, onActivate, onToggle }) {
    this.container = container;
    this.onSelect = onSelect;
    this.onActivate = onActivate;
    this.onToggle = onToggle;
    this.rowNodes = [];
    this.lastTap = { node: null, time: 0 };
    container.addEventListener('click', (event) => this.handleClick(event));
  }

  handleClick(event) {
    const row = event.target.closest('.tree-row');
    if (!row) return;
    const node = this.rowNodes[Number(row.dataset.index)];
    if (event.target.closest('.tree-row__toggle')) {
      this.onToggle(node);
      return;
    }
    const now = Date.now();
    const isDoubleTap = this.lastTap.node === node && now - this.lastTap.time < DOUBLE_TAP_DELAY;
    this.lastTap = { node: isDoubleTap ? null : node, time: now };
    this.onSelect(node);
    if (isDoubleTap) this.onActivate(node);
  }

  render(algorithm, selectedNode, collapsedNodes, isNumbered) {
    const scrollTop = this.container.scrollTop;
    this.rowNodes = [];
    this.container.classList.toggle('tree--without-numbers', !isNumbered);
    const fragment = document.createDocumentFragment();
    let lineNumber = 0;
    const addRow = (node, depth) => {
      lineNumber++;
      const isCollapsed = collapsedNodes.has(node);
      const hasChildren = node.children.length > 0;
      const isSelected = node === selectedNode;
      const index = this.rowNodes.length;
      this.rowNodes.push(node);
      const text =
        node.text === ''
          ? createElement('span', { className: 'tree-row__placeholder', text: isSelected ? 'ligne vide : choisir une instruction ci-dessous' : '…' })
          : renderHighlightedLine(node.text);
      const row = createElement(
        'div',
        {
          className: 'tree-row' + (isSelected ? ' tree-row--selected' : ''),
          role: 'treeitem',
          'aria-selected': isSelected ? 'true' : 'false',
          'aria-level': String(depth + 1),
          'aria-expanded': hasChildren ? String(!isCollapsed) : null,
          dataset: { index: String(index) },
        },
        [
          createElement('span', { className: 'tree-row__number', 'aria-hidden': 'true', text: String(lineNumber) }),
          createElement('span', { style: 'flex: 0 0 ' + depth * INDENT_WIDTH + 'px' }),
          createElement('button', {
            type: 'button',
            className: 'tree-row__toggle' + (hasChildren ? '' : ' tree-row__toggle--empty'),
            'aria-label': hasChildren ? (isCollapsed ? 'Déplier' : 'Replier') : null,
            tabindex: '-1',
            text: isCollapsed ? '▶' : '▼',
          }),
          createElement('span', { className: 'tree-row__text' }, [text]),
        ],
      );
      fragment.append(row);
      if (isCollapsed) {
        lineNumber += countDescendants(node);
        return;
      }
      node.children.forEach((child) => addRow(child, depth + 1));
    };
    algorithm.tree.forEach((node) => addRow(node, 0));
    this.container.replaceChildren(fragment);
    this.container.scrollTop = scrollTop;
  }

  scrollToSelected() {
    const selectedRow = this.container.querySelector('.tree-row--selected');
    if (selectedRow) selectedRow.scrollIntoView({ block: 'nearest' });
  }

  getVisibleNodes() {
    return this.rowNodes.slice();
  }
}

function countDescendants(node) {
  return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
}
