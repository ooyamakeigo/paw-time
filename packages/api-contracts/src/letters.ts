/**
 * Letters an employer sends to a worker after a shift. Kept free of zod so the
 * employer's browser bundle can import the presets directly.
 */
export const LETTER_TEMPLATE_CODES = ["come_again", "thank_you", "be_on_time"] as const;

export type LetterTemplateCode = (typeof LETTER_TEMPLATE_CODES)[number];

/** `ja` is the text stored and delivered; `en` is for English screens. */
export const LETTER_TEMPLATES: ReadonlyArray<{ code: LetterTemplateCode; ja: string; en: string }> = [
  { code: "come_again", ja: "またきてにゃん", en: "Come again, nyan!" },
  { code: "thank_you", ja: "きてくれてありがとうにゃん", en: "Thanks for coming, nyan!" },
  { code: "be_on_time", ja: "遅刻は厳禁だにゃん", en: "No being late, nyan!" },
];

export const LETTER_BODY_MAX_LENGTH = 300;

export function letterTemplateBody(code: LetterTemplateCode): string {
  const template = LETTER_TEMPLATES.find((candidate) => candidate.code === code);
  if (!template) throw new Error(`Unknown letter template: ${code}`);
  return template.ja;
}
