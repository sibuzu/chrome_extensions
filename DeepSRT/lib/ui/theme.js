import { Config } from '../config.js';

// Initialize theme
export async function initializeTheme(elements) {
  const { themeToggle } = elements;
  if (!themeToggle) {
    console.error('[Sidebar] Theme toggle not found');
    return;
  }

  // Load saved theme and apply immediately
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const config = await Config.get();
  const savedTheme = config.preferences?.theme?.value || (prefersDark ? 'dark' : 'light');

  // Save initial theme if not set
  if (!config.preferences?.theme?.value) {
    config.preferences.theme = {
      value: savedTheme,
      lastUpdated: Date.now()
    };
    await Config.save(config);
  }

  // Apply theme immediately
  document.documentElement.setAttribute('data-theme', savedTheme);
  await updateThemeIcons(elements, savedTheme === 'dark');

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async (e) => {
    const config = await Config.get();
    // Only update if no user preference is saved
    if (!config.preferences?.theme?.value) {
      const newTheme = e.matches ? 'dark' : 'light';
      config.preferences.theme = {
        value: newTheme,
        lastUpdated: Date.now()
      };
      await Config.save(config);
      document.documentElement.setAttribute('data-theme', newTheme);
      await updateThemeIcons(elements, newTheme === 'dark');
    }
  });
}

// Update theme icons
export async function updateThemeIcons(elements, isDark) {
  const { themeToggle } = elements;
  if (!themeToggle) {
    console.error('[Sidebar] Theme toggle not found');
    return;
  }

  const sunIcon = themeToggle.querySelector('.sun-icon');
  const moonIcon = themeToggle.querySelector('.moon-icon');
  if (!sunIcon || !moonIcon) {
    console.error('[Sidebar] Theme icons not found:', { sunIcon: !!sunIcon, moonIcon: !!moonIcon });
    return;
  }

  sunIcon.style.display = isDark ? 'none' : 'block';
  moonIcon.style.display = isDark ? 'block' : 'none';
}

// Handle theme toggle click
export async function handleThemeToggle(elements) {
  const config = await Config.get();
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  // Update config with new theme
  config.preferences.theme = {
    value: newTheme,
    lastUpdated: Date.now()
  };
  await Config.save(config);

  document.documentElement.setAttribute('data-theme', newTheme);
  await updateThemeIcons(elements, newTheme === 'dark');
}
