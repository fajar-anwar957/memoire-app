// Emoji codepoint ranges. Adapted from franklsf95, 2015, answer to "How do
// I remove emoji from string", Stack Overflow. Licensed CC BY-SA.
// Modified: contiguous ranges consolidated (roughly forty enumerated
// \u{1F...} blocks become \u{1F000}-\u{1FFFF}, which spans only symbol and
// pictograph blocks, so no letters or digits can be stripped); and
// \u{200D} zero-width joiner, \u{FE00}-\u{FE0F} variation selectors,
// \u{2764}, \u{2640} and \u{2642} added so multi-codepoint sequences do not
// leave residue.
// Emoji are stripped before text reaches speech synthesis, because the
// synthesiser announces them aloud as words.
// Known limitation: this misses \u{00A9}, \u{00AE}, \u{203C}, \u{2049} and
// keycap sequences. \p{Extended_Pictographic} is the modern approach.
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
