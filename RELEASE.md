# InsDowload v1.0.1

## Changes

- **Fix: Invalid filename errors** — Downloads now work for posts with emoji, decorative Unicode, or special symbols in captions
  - Switched to whitelist-based sanitization: only ASCII, CJK, Korean, Japanese, Cyrillic, and accented Latin characters are kept
  - Emoji (💖🐾✨), surrogate pairs (𐙚𝟐𝟐), and decorative symbols (˙⋆˚) are stripped
  - Fixed consecutive dots and trailing dot/space issues
  - Added `untitled` fallback for captions that become empty after sanitization

## Technical Details

The `sanitize()` function uses a whitelist regex that preserves:
- ASCII word characters and basic punctuation
- CJK Unified Ideographs (U+4E00–9FFF)
- Hangul, Hiragana, Katakana
- Latin Extended and Cyrillic

Everything else is removed, ensuring Chrome downloads API compatibility on Windows.
