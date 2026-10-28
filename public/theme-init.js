/* Runs before the stylesheet to avoid a flash of the wrong appearance. */
(() => {
  let savedTheme = null;
  let savedLanguage = null;
  try {
    savedTheme = localStorage.getItem('pramaan.theme');
    savedLanguage = localStorage.getItem('pramaan.language') || localStorage.getItem('pramaan.auth-language');
  } catch { /* Use system appearance and English when storage is unavailable. */ }

  const preference = window.matchMedia?.('(prefers-color-scheme: dark)');
  const applyTheme = (theme) => {
    const selected = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = selected;
    document.documentElement.style.colorScheme = selected;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = selected === 'dark' ? '#0b1727' : '#142b4f';
    return selected;
  };
  const initialTheme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : preference?.matches ? 'dark' : 'light';
  applyTheme(initialTheme);
  document.documentElement.lang = savedLanguage === 'hi' ? 'hi' : 'en';

  window.PramaanTheme = {
    get value() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; },
    set(theme, persist = true) {
      const selected = applyTheme(theme);
      if (persist) { try { localStorage.setItem('pramaan.theme', selected); } catch { /* Theme still changes for this visit. */ } }
      return selected;
    },
  };

  preference?.addEventListener?.('change', (event) => {
    let followsSystem = false;
    try { followsSystem = !localStorage.getItem('pramaan.theme'); }
    catch { followsSystem = true; }
    if (followsSystem) {
      const theme = applyTheme(event.matches ? 'dark' : 'light');
      window.dispatchEvent(new CustomEvent('pramaan-theme-change', { detail: { theme } }));
    }
  });
})();
