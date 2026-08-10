import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as ts from "typescript";
import { ADULT_TOOL_ROUTE_REGISTRY, APP_ROUTE_QUERY_REGISTRY, type AppRouteKind } from "../../src/app-route";

export const MACHINE_REVIEW_VIEWPORTS = [
  { id: "mobile", width: 390, height: 844, hasTouch: true },
  { id: "tablet", width: 768, height: 1024, hasTouch: true },
  { id: "desktop", width: 1440, height: 900, hasTouch: false },
] as const;

export const MACHINE_AGENT_PROFILE_IDS = [
  "NOVICE_POINTER",
  "HESITANT_WITH_HINTS",
  "KEYBOARD_ONLY",
  "MOBILE_TOUCH",
  "MUTED_REDUCED_MOTION",
  "RETURNING_USER",
] as const;

export const MACHINE_AGENT_PROFILE_PROJECTS = {
  NOVICE_POINTER: "desktop-chromium",
  HESITANT_WITH_HINTS: "desktop-chromium",
  KEYBOARD_ONLY: "desktop-chromium",
  MOBILE_TOUCH: "mobile-touch-chromium",
  MUTED_REDUCED_MOTION: "desktop-chromium",
  RETURNING_USER: "desktop-chromium",
} as const satisfies Record<(typeof MACHINE_AGENT_PROFILE_IDS)[number], string>;

export const MACHINE_ADULT_SCROLL_VIEWPORTS = [
  { project: "desktop-chromium", viewport: "320x568", requiredInputs: ["mouse-wheel", "PageDown", "End", "Home"] },
  { project: "desktop-chromium", viewport: "390x844", requiredInputs: ["mouse-wheel", "PageDown", "End", "Home"] },
  { project: "desktop-chromium", viewport: "768x1024", requiredInputs: ["mouse-wheel", "PageDown", "End", "Home"] },
  { project: "desktop-chromium", viewport: "1440x900", requiredInputs: ["mouse-wheel", "PageDown", "End", "Home"] },
  { project: "mobile-touch-chromium", viewport: "390x844-touch", requiredInputs: ["touch-swipe", "Home"] },
] as const;

export const WORLD_DEEP_STATES = ["fresh", "repaired", "spellbook", "treasure", "settings", "reduced-motion"] as const;
export const GOLDEN_SLICE_DEEP_STATES = [
  "camp",
  "ming-placing",
  "ming-formed",
  "hua",
  "ability-choice",
  "boss-lin",
  "boss-xing",
  "camp-repair",
  "spellbook",
  "run-complete",
  "return-world",
  "mute",
  "reduced-motion",
  "corrupt-save-recovery",
] as const;

export interface MachineReviewDeepRoute {
  readonly id: string;
  readonly routeKind: AppRouteKind;
  readonly route: string;
  readonly states: readonly string[];
  readonly viewportIds: readonly (typeof MACHINE_REVIEW_VIEWPORTS)[number]["id"][];
}

export interface MachineReviewAdultRoute {
  readonly id: string;
  readonly routeKind: (typeof ADULT_TOOL_ROUTE_REGISTRY)[number]["kind"];
  readonly route: string;
  readonly fixtureRequired: boolean;
}

export interface MachineReviewCatalogSmokeRoute {
  readonly id: string;
  readonly catalogGameId: string;
  readonly catalogIndex: number;
  readonly title: string;
  readonly playLabel: string;
  readonly route: string;
}

export interface MachineReviewManifest {
  readonly schemaVersion: 1;
  readonly generatedFrom: readonly ["src/app-route.ts", "packages/data/gameCatalog.ts"];
  readonly viewports: typeof MACHINE_REVIEW_VIEWPORTS;
  readonly deepRoutes: readonly MachineReviewDeepRoute[];
  readonly adultToolRoutes: readonly MachineReviewAdultRoute[];
  readonly catalogSmokeRoutes: readonly MachineReviewCatalogSmokeRoute[];
  readonly agentProfileIds: typeof MACHINE_AGENT_PROFILE_IDS;
  readonly adultScrollViewports: typeof MACHINE_ADULT_SCROLL_VIEWPORTS;
}

interface CatalogGameMetadata {
  readonly id: string;
  readonly title: string;
  readonly playLabel?: string;
}

function sourceFile(path: string): ts.SourceFile {
  return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function literalProperty(object: ts.ObjectLiteralExpression, name: string): string | undefined {
  const property = object.properties.find((candidate): candidate is ts.PropertyAssignment =>
    ts.isPropertyAssignment(candidate)
    && ((ts.isIdentifier(candidate.name) && candidate.name.text === name)
      || (ts.isStringLiteral(candidate.name) && candidate.name.text === name)),
  );
  if (!property) return undefined;
  if (ts.isStringLiteral(property.initializer) || ts.isNoSubstitutionTemplateLiteral(property.initializer)) {
    return property.initializer.text;
  }
  throw new Error(`Catalog game ${name} must be a static string literal for machine review`);
}

/**
 * Reads the canonical catalog declaration without evaluating browser-only game modules.
 * Catalog order and metadata still come from gameCatalog and each referenced GameDefinition.
 */
export function readGameCatalogMetadata(workspaceRoot = process.cwd()): readonly CatalogGameMetadata[] {
  const catalogPath = resolve(workspaceRoot, "packages/data/gameCatalog.ts");
  const catalogSource = sourceFile(catalogPath);
  const imports = new Map<string, string>();
  for (const statement of catalogSource.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      imports.set(element.name.text, resolve(dirname(catalogPath), statement.moduleSpecifier.text, "index.ts"));
    }
  }
  const declaration = catalogSource.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === "gameCatalog");
  if (!declaration?.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) {
    throw new Error("Canonical gameCatalog must be a static array declaration");
  }
  return declaration.initializer.elements.map((element, catalogIndex) => {
    if (!ts.isIdentifier(element)) throw new Error(`gameCatalog[${catalogIndex}] must reference an imported GameDefinition`);
    const gamePath = imports.get(element.text);
    if (!gamePath) throw new Error(`gameCatalog entry ${element.text} must be a named import`);
    const gameSource = sourceFile(gamePath);
    const gameDeclaration = gameSource.statements
      .filter(ts.isVariableStatement)
      .flatMap((statement) => [...statement.declarationList.declarations])
      .find((candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === element.text);
    if (!gameDeclaration?.initializer || !ts.isObjectLiteralExpression(gameDeclaration.initializer)) {
      throw new Error(`Catalog game ${element.text} must be a static GameDefinition object`);
    }
    const id = literalProperty(gameDeclaration.initializer, "id");
    const title = literalProperty(gameDeclaration.initializer, "title");
    if (!id || !title) throw new Error(`Catalog game ${element.text} must declare static id and title values`);
    return { id, title, playLabel: literalProperty(gameDeclaration.initializer, "playLabel") };
  });
}

function registration(kind: AppRouteKind) {
  const route = APP_ROUTE_QUERY_REGISTRY.find((entry) => entry.kind === kind);
  if (!route) throw new Error(`Missing canonical route registration for ${kind}`);
  return route;
}

export function createMachineReviewManifest(workspaceRoot = process.cwd()): MachineReviewManifest {
  const catalog = readGameCatalogMetadata(workspaceRoot);
  const viewportIds = MACHINE_REVIEW_VIEWPORTS.map((viewport) => viewport.id);
  const world = registration("world");
  const play = registration("play");
  const classic = registration("classic-hub");
  return {
    schemaVersion: 1,
    generatedFrom: ["src/app-route.ts", "packages/data/gameCatalog.ts"],
    viewports: MACHINE_REVIEW_VIEWPORTS,
    deepRoutes: [
      { id: "my-game-world", routeKind: world.kind, route: world.query, states: WORLD_DEEP_STATES, viewportIds },
      { id: "hanzi-golden-slice", routeKind: play.kind, route: `${play.query}&mode=play&from=world`, states: GOLDEN_SLICE_DEEP_STATES, viewportIds },
      { id: "classic-hub", routeKind: classic.kind, route: classic.query, states: ["catalog"], viewportIds: ["mobile", "desktop"] },
    ],
    adultToolRoutes: ADULT_TOOL_ROUTE_REGISTRY.map((route) => ({
      id: route.kind,
      routeKind: route.kind,
      route: route.query,
      fixtureRequired: route.kind.startsWith("observe-"),
    })),
    catalogSmokeRoutes: catalog.map((game, catalogIndex) => ({
      id: `catalog-${game.id}`,
      catalogGameId: game.id,
      catalogIndex,
      title: game.title,
      playLabel: game.playLabel ?? "开始游戏",
      route: classic.query,
    })),
    agentProfileIds: MACHINE_AGENT_PROFILE_IDS,
    adultScrollViewports: MACHINE_ADULT_SCROLL_VIEWPORTS,
  };
}

export function assertMachineReviewManifest(manifest: MachineReviewManifest, workspaceRoot = process.cwd()): void {
  if (manifest.schemaVersion !== 1) throw new Error("Machine review manifest schemaVersion must be 1");
  const catalogIds = readGameCatalogMetadata(workspaceRoot).map((game) => game.id);
  const smokeIds = manifest.catalogSmokeRoutes.map((route) => route.catalogGameId);
  if (JSON.stringify(smokeIds) !== JSON.stringify(catalogIds)) throw new Error("Catalog smoke inventory drifted from gameCatalog");
  const adultRouteKinds = ADULT_TOOL_ROUTE_REGISTRY.map((route) => route.kind);
  const manifestAdultKinds = manifest.adultToolRoutes.map((route) => route.routeKind);
  if (JSON.stringify(manifestAdultKinds) !== JSON.stringify(adultRouteKinds)) throw new Error("Adult tool inventory drifted from the app route registry");
  if (JSON.stringify(manifest.agentProfileIds) !== JSON.stringify(MACHINE_AGENT_PROFILE_IDS)) throw new Error("Agent profile inventory drifted from the machine contract");
  if (JSON.stringify(manifest.adultScrollViewports) !== JSON.stringify(MACHINE_ADULT_SCROLL_VIEWPORTS)) throw new Error("Adult scroll viewport inventory drifted from the machine contract");
  const allIds = [
    ...manifest.deepRoutes.map((route) => route.id),
    ...manifest.adultToolRoutes.map((route) => route.id),
    ...manifest.catalogSmokeRoutes.map((route) => route.id),
  ];
  if (new Set(allIds).size !== allIds.length) throw new Error("Machine review manifest ids must be globally unique");
}

export const MACHINE_REVIEW_MANIFEST = createMachineReviewManifest();
assertMachineReviewManifest(MACHINE_REVIEW_MANIFEST);
