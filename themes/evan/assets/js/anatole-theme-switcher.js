(() => {
  const MANUAL_THEME_KEY = 'evan-theme-preference';
  const LEGACY_THEME_KEY = 'theme';
  const NIGHT_START = 19;
  const DAY_START = 6;

  const isValidTheme = (theme) => theme === 'light' || theme === 'dark';

  const scheduledTheme = (date = new Date()) => {
    const hour = Number(
      new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        hour12: false,
        timeZone: 'Asia/Shanghai',
      }).format(date),
    );
    return hour >= NIGHT_START || hour < DAY_START ? 'dark' : 'light';
  };

  const getManualTheme = () => {
    try {
      const theme = localStorage.getItem(MANUAL_THEME_KEY);
      return isValidTheme(theme) ? theme : null;
    } catch (_) {
      return null;
    }
  };

  const applyTheme = (theme, persist = false) => {
    const html = document.documentElement;
    html.classList.remove('theme--light', 'theme--dark');
    html.classList.add(`theme--${theme}`);
    html.dataset.theme = theme;

    if (document.body) {
      document.body.dataset.theme = theme;
    }

    try {
      // Keep comments and older integrations on the same rendered theme.
      localStorage.setItem(LEGACY_THEME_KEY, theme);
      if (persist) {
        localStorage.setItem(MANUAL_THEME_KEY, theme);
      }
    } catch (_) {}
  };

  const syncScheduledTheme = () => {
    if (!getManualTheme()) {
      applyTheme(scheduledTheme());
    }
  };

  const switchTheme = () => {
    const currentTheme = document.documentElement.classList.contains('theme--dark') ? 'dark' : 'light';
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark', true);
  };

  // Older versions stored the macOS color scheme in `theme`, even when the
  // visitor never clicked the switch. Only the new key represents an explicit
  // manual choice, so stale system-dark values no longer override daytime.
  applyTheme(getManualTheme() || scheduledTheme());

  document.addEventListener('DOMContentLoaded', () => {
    const themeSwitcher = document.querySelector('.themeswitch');
    if (themeSwitcher) {
      themeSwitcher.addEventListener('click', switchTheme, false);
    }
    applyTheme(getManualTheme() || scheduledTheme());
  });

  setInterval(syncScheduledTheme, 60 * 1000);
})();
