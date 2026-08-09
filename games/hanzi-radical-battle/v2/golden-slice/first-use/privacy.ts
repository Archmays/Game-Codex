import { isFirstUseSafeMetadata, type FirstUseEventType, type FirstUseSafeMetadata } from "./event-types";

export const FIRST_USE_PRIVACY_DENIED_KEYS = [
  "name",
  "childName",
  "age",
  "school",
  "birthDate",
  "dateOfBirth",
  "ip",
  "ipAddress",
  "userAgent",
  "screenResolution",
  "mouseCoordinates",
  "pointerCoordinates",
  "rawKey",
  "rawInput",
  "voiceName",
  "systemVoice",
  "audio",
  "video",
  "photo",
  "image",
  "media",
  "mediaPath",
  "storageDump",
  "browserStorage",
  "score",
  "childQuote",
  "freeChildText",
] as const;

export interface PrivacyValidationResult {
  readonly ok: boolean;
  readonly issues: readonly string[];
}

const deniedKeySet = new Set<string>(FIRST_USE_PRIVACY_DENIED_KEYS.map((key) => key.toLowerCase()));
const normalizedDeniedFragments = [
  "username",
  "studentname",
  "displayname",
  "schoolname",
  "birth",
  "geolocation",
  "coordinates",
  "devicename",
  "voicename",
  "useragent",
  "resolution",
  "mediapath",
  "recording",
  "screenshot",
  "browserstorage",
  "storagedump",
  "childquote",
];

const valueChecks: readonly { label: string; pattern: RegExp }[] = [
  { label: "email address", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { label: "phone number", pattern: /(?:\+?86[- ]?)?1[3-9]\d{9}/ },
  { label: "IP address", pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/ },
  { label: "remote URL", pattern: /\bhttps?:\/\//i },
  { label: "media path", pattern: /(?:[A-Za-z]:\\|\/)[^\n]{0,240}\.(?:mp3|wav|m4a|ogg|mp4|mov|avi|webm|png|jpe?g|webp)\b/i },
  { label: "labelled identity", pattern: /(?:姓名|名字|学校|年龄|出生日期|住址|地址)\s*[:：]\s*\S+/ },
];

function normalizedKey(key: string): string {
  return key.replace(/[-_\s]/g, "").toLowerCase();
}

export function isDeniedFirstUseField(key: string): boolean {
  const lower = key.toLowerCase();
  const normalized = normalizedKey(key);
  return deniedKeySet.has(lower) || normalizedDeniedFragments.some((fragment) => normalized.includes(fragment));
}

export function validateObserverNotes(notes: unknown): PrivacyValidationResult {
  const issues: string[] = [];
  if (typeof notes !== "string") return { ok: false, issues: ["observerNotes must be a string"] };
  if (notes.length > 1000) issues.push("observerNotes exceeds 1000 characters");
  for (const check of valueChecks) {
    if (check.pattern.test(notes)) issues.push(`observerNotes contains ${check.label}`);
  }
  return { ok: issues.length === 0, issues };
}

export function validateFirstUsePrivacy(value: unknown): PrivacyValidationResult {
  const issues: string[] = [];
  const seen = new WeakSet<object>();

  const visit = (current: unknown, path: string): void => {
    if (typeof current === "string") {
      for (const check of valueChecks) {
        if (check.pattern.test(current)) issues.push(`${path || "value"} contains ${check.label}`);
      }
      return;
    }
    if (!current || typeof current !== "object") return;
    if (seen.has(current)) {
      issues.push(`${path || "value"} contains a cycle`);
      return;
    }
    seen.add(current);
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(current)) {
      const childPath = path ? `${path}.${key}` : key;
      if (isDeniedFirstUseField(key)) issues.push(`${childPath} is a denied privacy field`);
      visit(child, childPath);
    }
  };

  visit(value, "");
  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}

export function assertFirstUsePrivacy(value: unknown): void {
  const result = validateFirstUsePrivacy(value);
  if (!result.ok) throw new Error(`STEP 04 privacy validation failed: ${result.issues.join("; ")}`);
}

export function validateEventMetadataPrivacy(eventType: FirstUseEventType, metadata: unknown): metadata is FirstUseSafeMetadata {
  if (!isFirstUseSafeMetadata(eventType, metadata)) return false;
  return validateFirstUsePrivacy(metadata).ok;
}
