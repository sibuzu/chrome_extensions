/**
 * Converts text between traditional and simplified Chinese.
 * @param {string} text - The text to convert.
 * @param {string} type - Convert to 'cn' (simplified) or 'twp' (traditional).
 * @returns {string} The converted text.
 */
const convertText = (text, type) => {
  if (!text) return '';
  const converter = window.OpenCC.Converter({
    from: type === 'cn' ? 'twp' : 'cn',
    to: type === 'cn' ? 'cn' : 'twp',
  });
  return converter(text);
};

export default convertText;
