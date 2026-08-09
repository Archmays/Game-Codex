import {
  FIRST_USE_EVENT_SCHEMA_VERSION,
  isFirstUseEventType,
  isFirstUseStopCode,
  isFirstUseTechnicalEvent,
  type FirstUseEventType,
  type FirstUseSafeMetadata,
  type FirstUseStopCode,
  type FirstUseTechnicalEvent,
} from "./event-types";
import { validateEventMetadataPrivacy } from "./privacy";
import { isFirstUseSessionId, type FirstUseStorage } from "./session";

export const FIRST_USE_CHANNEL_PREFIX = "hanzi-v2-step04:";
export const FIRST_USE_EVENT_LOG_STORAGE_PREFIX = "family-games/hanzi-v2-step04/events:";
export const FIRST_USE_SIGNAL_STORAGE_PREFIX = "family-games/hanzi-v2-step04/signal:";
export const FIRST_USE_MAX_LOCAL_EVENTS = 512;

export interface FirstUseBroadcastChannelLike {
  postMessage(message: unknown): void;
  close(): void;
  addEventListener(type: "message", listener: EventListener): void;
  removeEventListener(type: "message", listener: EventListener): void;
}

export type FirstUseBroadcastChannelConstructor = new (name: string) => FirstUseBroadcastChannelLike;

interface FirstUseEventSignal {
  readonly kind: "event";
  readonly event: FirstUseTechnicalEvent;
}

export interface FirstUseStopSignal {
  readonly kind: "stop";
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly stopCode: FirstUseStopCode;
}

type FirstUseSignal = FirstUseEventSignal | FirstUseStopSignal;

export interface ChildFirstUseEventBridgeOptions {
  readonly mode: string | null | undefined;
  readonly sessionId: string;
  readonly storage?: FirstUseStorage;
  readonly eventTarget?: Pick<Window, "addEventListener" | "removeEventListener">;
  readonly broadcastChannel?: FirstUseBroadcastChannelConstructor | null;
  readonly now?: () => number;
  readonly startedAtMs?: number;
  readonly onStop?: (stopCode: FirstUseStopCode) => void;
}

export interface ChildFirstUseEventBridge {
  readonly active: boolean;
  emit(eventType: FirstUseEventType, safeMetadata?: FirstUseSafeMetadata): FirstUseTechnicalEvent | null;
  getLocalLog(): readonly FirstUseTechnicalEvent[];
  close(): void;
}

export interface FirstUseEventReceiverOptions {
  readonly sessionId: string;
  readonly storage?: FirstUseStorage;
  readonly eventTarget?: Pick<Window, "addEventListener" | "removeEventListener">;
  readonly broadcastChannel?: FirstUseBroadcastChannelConstructor | null;
  readonly onEvent?: (event: FirstUseTechnicalEvent) => void;
}

export interface FirstUseEventReceiver {
  getEvents(): readonly FirstUseTechnicalEvent[];
  sendStop(stopCode: FirstUseStopCode): void;
  reconnect(): void;
  close(): void;
}

function defaultStorage(): FirstUseStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function defaultEventTarget(): Pick<Window, "addEventListener" | "removeEventListener"> | null {
  return typeof window === "undefined" ? null : window;
}

function defaultBroadcastChannel(): FirstUseBroadcastChannelConstructor | null {
  return typeof window !== "undefined" && typeof window.BroadcastChannel === "function"
    ? (window.BroadcastChannel as unknown as FirstUseBroadcastChannelConstructor)
    : null;
}

function parseSignal(value: unknown, sessionId: string): FirstUseSignal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const signal = value as Record<string, unknown>;
  if (signal.kind === "event" && isFirstUseTechnicalEvent(signal.event) && signal.event.sessionId === sessionId) {
    return { kind: "event", event: signal.event };
  }
  if (
    signal.kind === "stop" && signal.schemaVersion === FIRST_USE_EVENT_SCHEMA_VERSION &&
    signal.sessionId === sessionId && isFirstUseStopCode(signal.stopCode)
  ) {
    return {
      kind: "stop",
      schemaVersion: FIRST_USE_EVENT_SCHEMA_VERSION,
      sessionId,
      stopCode: signal.stopCode,
    };
  }
  return null;
}

function readSignal(storage: FirstUseStorage | null, sessionId: string): FirstUseSignal | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(signalStorageKey(sessionId));
    return raw ? parseSignal(JSON.parse(raw) as unknown, sessionId) : null;
  } catch {
    return null;
  }
}

function writeSignal(storage: FirstUseStorage | null, sessionId: string, signal: FirstUseSignal): void {
  if (!storage) return;
  try {
    storage.setItem(signalStorageKey(sessionId), JSON.stringify(signal));
  } catch {
    // The bridge is deliberately non-authoritative. Gameplay remains available.
  }
}

export function firstUseChannelName(sessionId: string): string {
  if (!isFirstUseSessionId(sessionId)) throw new Error("Invalid STEP 04 session token");
  return `${FIRST_USE_CHANNEL_PREFIX}${sessionId}`;
}

export function eventLogStorageKey(sessionId: string): string {
  if (!isFirstUseSessionId(sessionId)) throw new Error("Invalid STEP 04 session token");
  return `${FIRST_USE_EVENT_LOG_STORAGE_PREFIX}${sessionId}`;
}

export function signalStorageKey(sessionId: string): string {
  if (!isFirstUseSessionId(sessionId)) throw new Error("Invalid STEP 04 session token");
  return `${FIRST_USE_SIGNAL_STORAGE_PREFIX}${sessionId}`;
}

export function readFirstUseEventLog(
  storage: FirstUseStorage | null,
  sessionId: string,
): readonly FirstUseTechnicalEvent[] {
  if (!storage || !isFirstUseSessionId(sessionId)) return [];
  try {
    const raw = storage.getItem(eventLogStorageKey(sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const bySequence = new Map<number, FirstUseTechnicalEvent>();
    for (const item of parsed) {
      if (isFirstUseTechnicalEvent(item) && item.sessionId === sessionId && !bySequence.has(item.sequence)) {
        bySequence.set(item.sequence, item);
      }
    }
    return [...bySequence.values()].sort((left, right) => left.sequence - right.sequence);
  } catch {
    return [];
  }
}

function writeEventLog(storage: FirstUseStorage | null, sessionId: string, events: readonly FirstUseTechnicalEvent[]): void {
  if (!storage) return;
  try {
    storage.setItem(eventLogStorageKey(sessionId), JSON.stringify(events.slice(-FIRST_USE_MAX_LOCAL_EVENTS)));
  } catch {
    // Local evidence can fail without changing or stopping the game rules.
  }
}

function openChannel(
  constructor: FirstUseBroadcastChannelConstructor | null,
  sessionId: string,
): FirstUseBroadcastChannelLike | null {
  if (!constructor) return null;
  try {
    return new constructor(firstUseChannelName(sessionId));
  } catch {
    return null;
  }
}

export function createChildFirstUseEventBridge(options: ChildFirstUseEventBridgeOptions): ChildFirstUseEventBridge {
  if (options.mode !== "child-first-use") {
    return { active: false, emit: () => null, getLocalLog: () => [], close: () => undefined };
  }
  if (!isFirstUseSessionId(options.sessionId)) throw new Error("Invalid STEP 04 session token");

  const storage = options.storage ?? defaultStorage();
  const eventTarget = options.eventTarget ?? defaultEventTarget();
  const constructor = options.broadcastChannel === undefined ? defaultBroadcastChannel() : options.broadcastChannel;
  const channel = openChannel(constructor, options.sessionId);
  const now = options.now ?? (() => performance.now());
  const startedAtMs = options.startedAtMs ?? now();
  let events = [...readFirstUseEventLog(storage, options.sessionId)];
  let sequence = events.at(-1)?.sequence ?? 0;
  let closed = false;
  let stopped = false;

  const deliverStop = (stopCode: FirstUseStopCode): void => {
    if (closed || stopped) return;
    stopped = true;
    options.onStop?.(stopCode);
  };
  const onMessage = ((event: MessageEvent<unknown>) => {
    const signal = parseSignal(event.data, options.sessionId);
    if (signal?.kind === "stop") deliverStop(signal.stopCode);
  }) as EventListener;
  const onStorage = ((event: StorageEvent) => {
    if (event.key !== signalStorageKey(options.sessionId) || !event.newValue) return;
    try {
      const signal = parseSignal(JSON.parse(event.newValue) as unknown, options.sessionId);
      if (signal?.kind === "stop") deliverStop(signal.stopCode);
    } catch {
      // Ignore malformed same-origin storage noise.
    }
  }) as EventListener;

  channel?.addEventListener("message", onMessage);
  if (!channel) eventTarget?.addEventListener("storage", onStorage);
  const pendingControl = readSignal(storage, options.sessionId);
  if (pendingControl?.kind === "stop") deliverStop(pendingControl.stopCode);

  return {
    active: true,
    emit(eventType, safeMetadata = {}) {
      if (closed) return null;
      if (!isFirstUseEventType(eventType) || !validateEventMetadataPrivacy(eventType, safeMetadata)) {
        throw new Error(`Unsafe or invalid STEP 04 event metadata for ${String(eventType)}`);
      }
      const event: FirstUseTechnicalEvent = {
        schemaVersion: FIRST_USE_EVENT_SCHEMA_VERSION,
        sessionId: options.sessionId,
        sequence: ++sequence,
        relativeMs: Math.max(0, Math.round(now() - startedAtMs)),
        eventType,
        safeMetadata: { ...safeMetadata },
      };
      events = [...events.filter((item) => item.sequence !== event.sequence), event]
        .sort((left, right) => left.sequence - right.sequence)
        .slice(-FIRST_USE_MAX_LOCAL_EVENTS);
      writeEventLog(storage, options.sessionId, events);
      const signal: FirstUseEventSignal = { kind: "event", event };
      if (channel) channel.postMessage(signal);
      else writeSignal(storage, options.sessionId, signal);
      return event;
    },
    getLocalLog: () => [...events],
    close() {
      if (closed) return;
      closed = true;
      channel?.removeEventListener("message", onMessage);
      channel?.close();
      if (!channel) eventTarget?.removeEventListener("storage", onStorage);
    },
  };
}

export function createFirstUseEventReceiver(options: FirstUseEventReceiverOptions): FirstUseEventReceiver {
  if (!isFirstUseSessionId(options.sessionId)) throw new Error("Invalid STEP 04 session token");
  const storage = options.storage ?? defaultStorage();
  const eventTarget = options.eventTarget ?? defaultEventTarget();
  const constructor = options.broadcastChannel === undefined ? defaultBroadcastChannel() : options.broadcastChannel;
  let channel = openChannel(constructor, options.sessionId);
  let closed = false;
  const delivered = new Set<number>();
  const buffer = new Map<number, FirstUseTechnicalEvent>();
  const ordered: FirstUseTechnicalEvent[] = [];
  let nextSequence = 1;

  const flush = (): void => {
    while (buffer.has(nextSequence)) {
      const event = buffer.get(nextSequence) as FirstUseTechnicalEvent;
      buffer.delete(nextSequence);
      if (!delivered.has(event.sequence)) {
        delivered.add(event.sequence);
        ordered.push(event);
        options.onEvent?.(event);
      }
      nextSequence += 1;
    }
  };
  const ingest = (event: FirstUseTechnicalEvent): void => {
    if (closed || event.sessionId !== options.sessionId || delivered.has(event.sequence)) return;
    buffer.set(event.sequence, event);
    flush();
  };
  const replayLocalLog = (): void => {
    for (const event of readFirstUseEventLog(storage, options.sessionId)) ingest(event);
  };
  const onMessage = ((event: MessageEvent<unknown>) => {
    const signal = parseSignal(event.data, options.sessionId);
    if (signal?.kind === "event") {
      replayLocalLog();
      ingest(signal.event);
    }
  }) as EventListener;
  const onStorage = ((event: StorageEvent) => {
    if (event.key !== signalStorageKey(options.sessionId) || !event.newValue) return;
    try {
      const signal = parseSignal(JSON.parse(event.newValue) as unknown, options.sessionId);
      if (signal?.kind === "event") {
        replayLocalLog();
        ingest(signal.event);
      }
    } catch {
      // Ignore malformed same-origin storage noise.
    }
  }) as EventListener;

  const subscribe = (): void => {
    channel?.addEventListener("message", onMessage);
    if (!channel) eventTarget?.addEventListener("storage", onStorage);
  };
  const unsubscribe = (): void => {
    channel?.removeEventListener("message", onMessage);
    if (!channel) eventTarget?.removeEventListener("storage", onStorage);
  };

  subscribe();
  replayLocalLog();

  return {
    getEvents: () => [...ordered],
    sendStop(stopCode) {
      if (closed || !isFirstUseStopCode(stopCode)) throw new Error("Invalid STEP 04 stop code");
      const signal: FirstUseStopSignal = {
        kind: "stop",
        schemaVersion: FIRST_USE_EVENT_SCHEMA_VERSION,
        sessionId: options.sessionId,
        stopCode,
      };
      writeSignal(storage, options.sessionId, signal);
      channel?.postMessage(signal);
    },
    reconnect() {
      if (closed) return;
      unsubscribe();
      channel?.close();
      channel = openChannel(constructor, options.sessionId);
      subscribe();
      replayLocalLog();
    },
    close() {
      if (closed) return;
      unsubscribe();
      channel?.close();
      closed = true;
      buffer.clear();
    },
  };
}
