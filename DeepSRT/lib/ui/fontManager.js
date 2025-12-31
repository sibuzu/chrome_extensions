import { Config } from '../config.js';

// Initialize font size menu
export function initializeFontSizeMenu(elements, currentSize) {
  if (!elements?.fontSizeMenu) return;

  // Clear existing options
  elements.fontSizeMenu.innerHTML = '';

  // Create options for specific sizes
  const sizes = [12, 14, 16, 18, 20];
  sizes.forEach((size) => {
    const option = document.createElement('div');
    option.className = `font-size-option${size === currentSize ? ' selected' : ''}`;
    option.textContent = `${size}px`;
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      handleFontSizeChange(elements, size);
      toggleFontSizeMenu(elements, false);
    });
    elements.fontSizeMenu.appendChild(option);
  });
}

// Handle font size change
export async function handleFontSizeChange(elements, newSize) {
  if (!elements?.summary) return;
  
  // Update font size through Config
  const validSize = await Config.setFontSize(newSize);
  elements.summary.style.fontSize = `${validSize}px`;
  
  // Update selected state in menu
  const options = elements.fontSizeMenu?.querySelectorAll('.font-size-option');
  options?.forEach((option) => {
    option.classList.toggle('selected', option.textContent === `${validSize}px`);
  });
}

// Toggle font size menu
export function toggleFontSizeMenu(elements, show) {
  if (!elements?.fontSizeMenu) return;
  elements.fontSizeMenu.classList.toggle('visible', show);
  // If showing menu, add click outside listener
  if (show) {
    setTimeout(() => {
      document.addEventListener('click', (e) => handleClickOutside(e, elements));
    }, 0);
  } else {
    document.removeEventListener('click', (e) => handleClickOutside(e, elements));
  }
}

// Handle click outside font size menu
function handleClickOutside(e, elements) {
  if (!elements?.fontSizeBtn?.contains(e.target)) {
    toggleFontSizeMenu(elements, false);
  }
}

// Initialize font size from config
export async function initializeFontSize(elements) {
  if (!elements.summary || !elements.fontSizeMenu) return;
  
  try {
    const savedFontSize = await Config.getFontSize();
    elements.summary.style.fontSize = `${savedFontSize}px`;
    initializeFontSizeMenu(elements, savedFontSize);
  } catch (error) {
    console.error('[Sidebar] Error loading font size preference:', error);
    const defaultSize = 14;
    elements.summary.style.fontSize = `${defaultSize}px`;
    initializeFontSizeMenu(elements, defaultSize);
  }
}
