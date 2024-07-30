export class KeyValueStore {
  #db;
  #storeName;

  constructor(name = 'keyval-store') {
    this.#storeName = name;
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => request.result.createObjectStore(name);

    this.#db = new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  #promisifyTransaction(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = transaction.onsuccess = () => resolve(transaction.result);
      transaction.onabort = transaction.onerror = () => reject(transaction.error);
    });
  }

  #getStore(mode) {
    return this.#db.then((db) =>
      db.transaction(this.#storeName, mode).objectStore(this.#storeName)
    );
  }

  get(key) {
    return this.#getStore('readonly').then((store) => this.#promisifyTransaction(store.get(key)));
  }

  set(key, value) {
    return this.#getStore('readwrite').then((store) => {
      store.put(value, key);
      return this.#promisifyTransaction(store.transaction);
    });
  }

  clear() {
    return this.#getStore('readwrite').then((store) => {
      store.clear();
      return this.#promisifyTransaction(store.transaction);
    });
  }
}

export class FileSaver {
  #store = new KeyValueStore('file-saver');

  // Feature detection. The API needs to be supported and the app not run in an iframe.
  supportsFileSystemAccess =
    'showSaveFilePicker' in window &&
    (() => {
      try {
        return window.self === window.top;
      } catch {
        return false;
      }
    })();

  #fileHandler;

  get #file() {
    if (this.#fileHandler === undefined) {
      this.#fileHandler = this.#getFile();
    }
    return this.#fileHandler;
  }

  set #file(file) {
    this.#fileHandler = file;
  }

  async #getFile() {
    const file = await this.#store.get('file');

    // We need to request permission since the file handler was persisted.
    // Calling `queryPermission` seems unnecessary atm since the browser prompts permission for each session
    if (
      (await file?.queryPermission({ mode: 'readwrite' })) !== 'granted' ||
      (await file?.requestPermission({ mode: 'readwrite' })) !== 'granted'
    ) {
      throw new Error('File write permission not granted.');
    }

    return file;
  }

  async save(content, promptNewFile = false) {
    // TODO: progressively enhance using anchor downloads?
    if (!this.supportsFileSystemAccess) {
      throw new Error('File System Access API is not supported.');
    }

    let file = await this.#file;

    if (file === undefined || promptNewFile) {
      let suggestedName = 'index.html';
      // If the web page is a local file, use that name. Otherwise use the name of the
      if (location.protocol === 'file:' && location.pathname.endsWith('.html')) {
        const path = location.pathname;
        suggestedName = path.substring(path.lastIndexOf('/') + 1);
      } else if (file.name.endsWith('.html')) {
        suggestedName = file.name;
      }

      this.#file = showSaveFilePicker({
        id: 'self-modifying_html_file',
        suggestedName,
        types: [{ description: 'HTML document', accept: { 'text/html': ['.html'] } }],
      });

      file = await this.#file;

      await this.#store.set('file', file);
    }

    const writer = await file.createWritable();
    await writer.write(content);
    await writer.close();
  }
}

export class SaveFile extends HTMLElement {
  static tagName = 'save-file';

  static register() {
    customElements.define(this.tagName, this);
  }

  #fileSaver = new FileSaver();

  constructor() {
    super();

    this.addEventListener('click', this);
  }

  handleEvent(event) {
    switch (event.type) {
      case 'click': {
        this.#fileSaver.save(document.textContent, this.hasAttribute('save-as'));
        break;
      }
    }
  }
}
