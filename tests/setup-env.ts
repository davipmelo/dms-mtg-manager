// Minimal browser/DOM shim so service modules execute deterministically under Node test runner.

class MemoryStorage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

class MiniXmlElement {
  tagName: string;
  attributes: Record<string, string>;
  children: MiniXmlElement[] = [];
  rawText = '';

  constructor(tagName: string, attributes: Record<string, string> = {}) {
    this.tagName = tagName;
    this.attributes = attributes;
  }

  get textContent(): string {
    if (this.children.length === 0) return this.rawText;
    return this.children.map((c) => c.textContent).join('');
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  querySelector(selector: string): MiniXmlElement | null {
    if (selector === 'parsererror') return null;
    const parts = selector.split('>').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      let current: MiniXmlElement[] = [this];
      for (const part of parts) {
        current = current.flatMap((el) =>
          el.children.filter((ch) => ch.tagName.toLowerCase() === part.toLowerCase())
        );
      }
      return current[0] ?? null;
    }
    return this.findAllByTag(parts[0] || selector)[0] ?? null;
  }

  querySelectorAll(selector: string): MiniXmlElement[] {
    const parts = selector.split('>').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      let current: MiniXmlElement[] = [this];
      for (const part of parts) {
        current = current.flatMap((el) =>
          el.children.filter((ch) => ch.tagName.toLowerCase() === part.toLowerCase())
        );
      }
      return current;
    }
    return this.findAllByTag(parts[0] || selector);
  }

  getElementsByTagName(name: string): MiniXmlElement[] {
    return this.findAllByTag(name);
  }

  private findAllByTag(tag: string): MiniXmlElement[] {
    const lower = tag.toLowerCase();
    const out: MiniXmlElement[] = [];
    for (const child of this.children) {
      if (child.tagName.toLowerCase() === lower) out.push(child);
      out.push(...child.findAllByTag(lower));
    }
    return out;
  }
}

function parseXmlString(xml: string): {
  documentElement: MiniXmlElement | null;
  querySelector: (sel: string) => MiniXmlElement | null;
  querySelectorAll: (sel: string) => MiniXmlElement[];
  getElementsByTagName: (tag: string) => MiniXmlElement[];
} {
  const root = new MiniXmlElement('__root__');
  const stack: MiniXmlElement[] = [root];
  const tokenRegex = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/([A-Za-z0-9_:-]+)\s*>|<([A-Za-z0-9_:-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(xml)) !== null) {
    const [, closeTag, openTag, attrStr, selfClose, text] = match;
    if (closeTag) {
      if (stack.length > 1) stack.pop();
    } else if (openTag) {
      const attrs: Record<string, string> = {};
      if (attrStr) {
        const attrRe = /([A-Za-z0-9_:-]+)\s*=\s*["']([^"']*)["']/g;
        let am: RegExpExecArray | null;
        while ((am = attrRe.exec(attrStr)) !== null) {
          attrs[am[1]] = am[2];
        }
      }
      const el = new MiniXmlElement(openTag, attrs);
      stack[stack.length - 1].children.push(el);
      if (!selfClose) stack.push(el);
    } else if (text) {
      const parent = stack[stack.length - 1];
      parent.rawText += text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }
  }

  const docEl = root.children[0] ?? null;
  return {
    documentElement: docEl,
    querySelector: (sel: string) => root.querySelector(sel),
    querySelectorAll: (sel: string) => root.querySelectorAll(sel),
    getElementsByTagName: (tag: string) => root.getElementsByTagName(tag),
  };
}

class MiniDOMParser {
  parseFromString(str: string, _mimeType: string) {
    return parseXmlString(str);
  }
}

const memoryStorage = new MemoryStorage();
const windowTarget = new EventTarget();

const windowShim: any = {
  localStorage: memoryStorage,
  location: { hostname: 'localhost', href: 'http://localhost/' },
  addEventListener: windowTarget.addEventListener.bind(windowTarget),
  removeEventListener: windowTarget.removeEventListener.bind(windowTarget),
  dispatchEvent: (event: Event) => {
    const res = windowTarget.dispatchEvent(event);
    if (event.type === 'storage' && typeof windowShim.onstorage === 'function') {
      windowShim.onstorage(event);
    }
    return res;
  },
  navigator: { onLine: true },
};

(globalThis as any).localStorage = memoryStorage;
(globalThis as any).window = windowShim;
(globalThis as any).DOMParser = MiniDOMParser;

if (typeof (globalThis as any).CustomEvent === 'undefined') {
  (globalThis as any).CustomEvent = class CustomEvent<T = unknown> extends Event {
    detail: T;
    constructor(type: string, params?: { detail?: T }) {
      super(type);
      this.detail = params?.detail as T;
    }
  };
}

try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
    writable: true,
  });
} catch {
  // Node may expose a read-only navigator getter on some platforms
}

export { memoryStorage };

