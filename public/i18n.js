/* Central translation service for the existing server-rendered UI. */
(() => {
  const catalog = window.PramaanLocaleCatalog || {};
  const sourceText = new WeakMap();
  const sourceAttributes = new WeakMap();
  const englishByHindi = new Map();
  const hindiByEnglish = new Map();

  function entriesAtPath(source, target, path = '') {
    if (!source || typeof source !== 'object') return;
    for (const [key, value] of Object.entries(source)) {
      const nextPath = path ? `${path}.${key}` : key;
      const counterpart = target?.[key];
      if (typeof value === 'string' && typeof counterpart === 'string') {
        hindiByEnglish.set(value, counterpart);
        if (!englishByHindi.has(counterpart)) englishByHindi.set(counterpart, value);
      } else if (value && typeof value === 'object') entriesAtPath(value, counterpart, nextPath);
    }
  }
  entriesAtPath(catalog.en, catalog.hi);

  function getPath(language, key) {
    return String(key || '').split('.').reduce((value, part) => value?.[part], catalog[language]);
  }
  function splitSpace(value) {
    const match = String(value).match(/^(\s*)([\s\S]*?)(\s*)$/);
    return { leading: match?.[1] || '', content: match?.[2] || '', trailing: match?.[3] || '' };
  }
  function translateValue(original, language) {
    if (language === 'en') return original;
    const exact = hindiByEnglish.get(original);
    if (exact) return exact;
    const pageRange = original.match(/^Showing ([\d,]+)–([\d,]+) of ([\d,]+)$/);
    if (pageRange) return `दिखाए जा रहे ${pageRange[1]}–${pageRange[2]}, कुल ${pageRange[3]} में से`;
    const queueCount = original.match(/^Showing ([\d,]+) (assigned|institution) applications$/);
    if (queueCount) return queueCount[2] === 'assigned' ? `सौंपे गए आवेदन: ${queueCount[1]}` : `संस्थान के आवेदन: ${queueCount[1]}`;
    const applicationCount = original.match(/^([\d,]+) applications$/);
    if (applicationCount) return `${applicationCount[1]} आवेदन`;
    if (/^\d+ unread notifications?$/i.test(original)) return original.replace(/^(\d+).*$/i, '$1 अपठित सूचनाएँ');
    if (/^\d+ registered institutions?$/i.test(original)) return original.replace(/^(\d+).*$/i, '$1 पंजीकृत संस्थान');
    if (/^\d+ records?$/i.test(original)) return original.replace(/^(\d+).*$/i, '$1 रिकॉर्ड');
    return original;
  }
  function isProtected(element) {
    return Boolean(element?.closest('.auth-page, .assistant-message-copy, .record-title, .record-meta, .copy-cell, .user-mini-name, .top-user-name, [data-no-translate], code, pre'));
  }
  function translateTextNode(node, language) {
    const element = node.parentElement;
    if (!element || isProtected(element)) return;
    const current = node.nodeValue || '';
    const { leading, content, trailing } = splitSpace(current);
    if (!content) return;
    let record = sourceText.get(node);
    if (!record || current !== record.output) record = { source: content, output: current };
    const output = leading + translateValue(record.source, language) + trailing;
    if (output !== current) node.nodeValue = output;
    record.output = output;
    sourceText.set(node, record);
  }
  const translatableAttributes = ['aria-label', 'aria-description', 'title', 'placeholder', 'alt'];
  function translateElement(element, language) {
    if (!(element instanceof Element) || isProtected(element)) return;
    let record = sourceAttributes.get(element);
    if (!record) { record = {}; sourceAttributes.set(element, record); }
    for (const attribute of translatableAttributes) {
      if (!element.hasAttribute(attribute)) continue;
      const current = element.getAttribute(attribute) || '';
      if (!record[attribute] || current !== record[attribute].output) record[attribute] = { source: current, output: current };
      const output = translateValue(record[attribute].source, language);
      if (output !== current) element.setAttribute(attribute, output);
      record[attribute].output = output;
    }
  }
  function translate(root = document.getElementById('app')) {
    if (!root) return;
    const language = api.language;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateTextNode(node, language);
    if (root instanceof Element) translateElement(root, language);
    root.querySelectorAll?.('*').forEach((element) => translateElement(element, language));
  }

  const api = {
    catalog,
    get language() { return document.documentElement.lang === 'hi' ? 'hi' : 'en'; },
    t(key, variables = {}) {
      const template = getPath(api.language, key) ?? getPath('en', key) ?? key;
      return String(template).replace(/\{([\w]+)\}/g, (_, name) => String(variables[name] ?? `{${name}}`));
    },
    translateText(value, language = api.language) { return translateValue(String(value ?? ''), language); },
    setLanguage(language) {
      const selected = language === 'hi' ? 'hi' : 'en';
      document.documentElement.lang = selected;
      try { localStorage.setItem('pramaan.language', selected); localStorage.setItem('pramaan.auth-language', selected); } catch { /* Language still changes for this visit. */ }
      translate();
    },
    translate,
  };
  window.PramaanI18n = api;
  const app = document.getElementById('app');
  if (app) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') translateTextNode(mutation.target, api.language);
        else {
          if (mutation.target instanceof Element) translateElement(mutation.target, api.language);
          mutation.addedNodes.forEach((added) => {
            if (added.nodeType === Node.TEXT_NODE) translateTextNode(added, api.language);
            else if (added instanceof Element) translate(added);
          });
        }
      }
    });
    observer.observe(app, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: translatableAttributes });
    translate(app);
  }
})();
