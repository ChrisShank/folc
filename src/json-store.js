export class JSONStore extends HTMLElement {
  static tagName = 'json-store';

  static register() {
    customElements.define(this.tagName, this);
  }

  #commentNode;
  #data;

  // Lazily parse comment containing JSON
  #parseComment() {
    if (this.#commentNode !== undefined || this.#data !== undefined) return;

    let node = this.firstChild;

    while (node != null && node.nodeType !== 8) {
      node = node.nextSibling;
    }

    if (node == null) {
      node = document.createComment('');
      this.appendChild(node);
    }

    if (node.nodeValue === '') {
      node.nodeValue = '{}';
    }

    this.#commentNode = node;
    this.#data = JSON.parse(this.#commentNode.nodeValue || '{}');
  }

  get(key) {
    this.#parseComment();
    return this.#data[key];
  }

  set(key, value) {
    this.#parseComment();
    this.#data[key] = value;
    this.#commentNode.nodeValue = JSON.stringify(this.#data);
  }
}
