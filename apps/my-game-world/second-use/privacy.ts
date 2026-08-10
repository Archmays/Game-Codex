import {
  STEP06_ALLOWED_METADATA_KEYS,
  type Step06SafeMetadata,
  type Step06TechnicalEvent,
} from "./event-types";

const FORBIDDEN_TEXT = /(name|age|school|user.?agent|screen|pointer|coordinate|keyboard|audio|video|image|photo|voice|localstorage|email|phone)/i;
const FORBIDDEN_OBSERVER_NOTES = /(?:https?:\/\/|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:姓名|学校|年龄|电话|手机号|住址|邮箱)\s*[:：]|(?:名叫|姓名是|孩子叫|小朋友叫|我是)\s*[\p{Script=Han}·]{2,8}|(?:住在|家住)\s*[\p{Script=Han}\d]|[\p{Script=Han}]{2,16}(?:小学|中学|幼儿园|学校|学院)|(?:\d{1,2}|[一二三四五六七八九十]{1,3})\s*岁|\b(?:name|school|age|phone|address|email)\s*:|\bmy\s+name\s+is\b|\b\+?\d[\d\s()-]{7,}\d\b)/iu;

export function sanitizeStep06Metadata(input: Step06SafeMetadata = {}): Step06SafeMetadata {
  const safe: Record<string, unknown> = {};
  for (const key of STEP06_ALLOWED_METADATA_KEYS) {
    const value = input[key];
    if (value !== undefined) safe[key] = value;
  }
  return safe as Step06SafeMetadata;
}

export function containsStep06ForbiddenEvidence(value: unknown): boolean {
  if (typeof value === "string") return FORBIDDEN_TEXT.test(value);
  if (Array.isArray(value)) return value.some(containsStep06ForbiddenEvidence);
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, nested]) => FORBIDDEN_TEXT.test(key) || containsStep06ForbiddenEvidence(nested),
    );
  }
  return false;
}

export function validateStep06Privacy(events: readonly Step06TechnicalEvent[]): boolean {
  return events.every((event) => !containsStep06ForbiddenEvidence(event.safeMetadata));
}

export function containsStep06ForbiddenObserverNotes(notes: string): boolean {
  return FORBIDDEN_OBSERVER_NOTES.test(notes);
}
