import type { GoldenSliceStorageLike } from "../../../games/hanzi-radical-battle/v2/golden-slice/save/store";
import {
  isStep06TechnicalEvent,
  STEP06_EVENT_SCHEMA_VERSION,
  STEP06_STOP_CODES,
  type Step06SafeMetadata,
  type Step06StopCode,
  type Step06TechnicalEvent,
  type Step06EventType,
} from "./event-types";
import { sanitizeStep06Metadata } from "./privacy";

const MAX_EVENTS = 160;

interface SecondUseEventGrant {
  readonly sessionId: string;
  readonly startedAtMs: number;
}

function namespace(sessionId: string): "hanzi-v2-step06" | "hanzi-v2-step07" {
  return sessionId.startsWith("s07-") ? "hanzi-v2-step07" : "hanzi-v2-step06";
}

function logKey(sessionId: string): string {
  return `${namespace(sessionId)}:events:${sessionId}`;
}
function signalKey(sessionId: string): string {
  return `${namespace(sessionId)}:signal:${sessionId}`;
}
function stopKey(sessionId: string): string {
  return `${namespace(sessionId)}:stop:${sessionId}`;
}

export function readStep06EventLog(storage: GoldenSliceStorageLike, sessionId: string): Step06TechnicalEvent[] {
  try {
    const raw = storage.getItem(logKey(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStep06TechnicalEvent).filter((event) => event.sessionId === sessionId).slice(-MAX_EVENTS);
  } catch {
    return [];
  }
}

export interface Step06EventBridge {
  readonly events: () => readonly Step06TechnicalEvent[];
  emit(eventType: Step06EventType, safeMetadata?: Step06SafeMetadata): Step06TechnicalEvent | null;
  requestStop(stopCode: Step06StopCode): void;
  close(): void;
}

export function createStep06EventBridge(options: {
  readonly grant: SecondUseEventGrant;
  readonly storage: GoldenSliceStorageLike;
  readonly onEvent?: (event: Step06TechnicalEvent) => void;
  readonly onStop?: (stopCode: Step06StopCode) => void;
  readonly broadcastChannelFactory?: (name: string) => BroadcastChannel;
  readonly now?: () => number;
}): Step06EventBridge {
  const { grant, storage } = options;
  const now = options.now ?? Date.now;
  const channelName = `${namespace(grant.sessionId)}:${grant.sessionId}`;
  let closed = false;
  let channel: BroadcastChannel | null = null;
  const seen = new Set(readStep06EventLog(storage, grant.sessionId).map((event) => event.sequence));

  const accept = (event: Step06TechnicalEvent): void => {
    if (closed || !isStep06TechnicalEvent(event) || event.sessionId !== grant.sessionId || seen.has(event.sequence)) return;
    seen.add(event.sequence);
    options.onEvent?.(event);
  };
  const acceptStop = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    const message = value as { kind?: unknown; stopCode?: unknown };
    if (message.kind !== "stop" || typeof message.stopCode !== "string" || !STEP06_STOP_CODES.includes(message.stopCode as Step06StopCode)) return;
    options.onStop?.(message.stopCode as Step06StopCode);
  };

  try {
    const factory = options.broadcastChannelFactory ?? ((name: string) => new BroadcastChannel(name));
    channel = factory(channelName);
    channel.addEventListener("message", (event) => {
      const data = event.data as { kind?: unknown; event?: unknown };
      if (data?.kind === "event") accept(data.event as Step06TechnicalEvent);
      else acceptStop(data);
    });
  } catch {
    channel = null;
  }

  const onStorage = (event: StorageEvent): void => {
    if (event.key === signalKey(grant.sessionId) && event.newValue) {
      try { accept(JSON.parse(event.newValue) as Step06TechnicalEvent); } catch { /* invalid fallback signal */ }
    }
    if (event.key === stopKey(grant.sessionId) && event.newValue) {
      try { acceptStop(JSON.parse(event.newValue)); } catch { /* invalid fallback stop */ }
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

  const emit = (eventType: Step06EventType, safeMetadata: Step06SafeMetadata = {}): Step06TechnicalEvent | null => {
    if (closed) return null;
    const existing = readStep06EventLog(storage, grant.sessionId);
    const sequence = (existing.at(-1)?.sequence ?? 0) + 1;
    const event: Step06TechnicalEvent = {
      schemaVersion: STEP06_EVENT_SCHEMA_VERSION,
      sessionId: grant.sessionId,
      sequence,
      relativeMs: Math.max(0, Math.min(30 * 60 * 1000, Math.round(now() - grant.startedAtMs))),
      eventType,
      safeMetadata: sanitizeStep06Metadata(safeMetadata),
    };
    if (!isStep06TechnicalEvent(event)) throw new Error("Refusing unsafe second-use event");
    const bounded = [...existing, event].slice(-MAX_EVENTS);
    storage.setItem(logKey(grant.sessionId), JSON.stringify(bounded));
    storage.setItem(signalKey(grant.sessionId), JSON.stringify(event));
    seen.add(sequence);
    options.onEvent?.(event);
    channel?.postMessage({ kind: "event", event });
    return event;
  };

  const pendingStop = storage.getItem(stopKey(grant.sessionId));
  if (pendingStop) {
    queueMicrotask(() => {
      if (closed) return;
      try { acceptStop(JSON.parse(pendingStop)); } catch { /* invalid pending stop */ }
    });
  }

  return {
    events: () => readStep06EventLog(storage, grant.sessionId),
    emit,
    requestStop(stopCode): void {
      const message = { kind: "stop", stopCode };
      storage.setItem(stopKey(grant.sessionId), JSON.stringify(message));
      channel?.postMessage(message);
      options.onStop?.(stopCode);
    },
    close(): void {
      if (closed) return;
      closed = true;
      channel?.close();
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    },
  };
}

export function clearStep06EphemeralEvidence(storage: GoldenSliceStorageLike, sessionId: string): void {
  storage.removeItem(signalKey(sessionId));
  storage.removeItem(stopKey(sessionId));
}
