var EMOJI_REGEX = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{200D}\u{2640}\u{2642}\u{2764}\u{2122}\u{2139}\u{2194}-\u{21AA}\u{231A}\u{231B}\u{24C2}\u{25AA}-\u{25FE}\u{2934}\u{2935}\u{3030}\u{303D}\u{3297}\u{3299}]/gu;

function cleanResponseText(text) {
  if (!text) {
    return '';
  }

  var lines = text.split('\n').filter(function (line) {
    return !/^\s*#/.test(line);
  });

  return lines.join('\n')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/`+/g, '')
    .replace(/_{1,3}/g, '')
    .replace(/~~/g, '')
    .replace(/^\s*>+\s?/gm, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(EMOJI_REGEX, '')
    .trim();
}
