import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";

export interface GameCatalogMetadata {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly subject: string;
  readonly recommendedAge: string;
  readonly learningGoal: string;
  readonly status: string;
  readonly playLabel?: string;
  readonly route?: string;
}

function sourceFile(path: string): ts.SourceFile {
  return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function stringProperty(object: ts.ObjectLiteralExpression, name: string, required = true): string | undefined {
  const property = object.properties.find((candidate): candidate is ts.PropertyAssignment =>
    ts.isPropertyAssignment(candidate) && ((ts.isIdentifier(candidate.name) || ts.isStringLiteral(candidate.name)) && candidate.name.text === name));
  if (!property) {
    if (required) throw new Error(`GameDefinition is missing ${name}`);
    return undefined;
  }
  if (!ts.isStringLiteralLike(property.initializer)) throw new Error(`GameDefinition ${name} must be a string literal for portfolio generation`);
  return property.initializer.text;
}

function readDefinition(path: string, exportName: string): GameCatalogMetadata {
  const source = sourceFile(path);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== exportName || !declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) continue;
      return {
        id: stringProperty(declaration.initializer, "id")!,
        title: stringProperty(declaration.initializer, "title")!,
        description: stringProperty(declaration.initializer, "description")!,
        subject: stringProperty(declaration.initializer, "subject")!,
        recommendedAge: stringProperty(declaration.initializer, "recommendedAge")!,
        learningGoal: stringProperty(declaration.initializer, "learningGoal")!,
        status: stringProperty(declaration.initializer, "status")!,
        playLabel: stringProperty(declaration.initializer, "playLabel", false),
        route: stringProperty(declaration.initializer, "route", false),
      };
    }
  }
  throw new Error(`Unable to locate exported GameDefinition ${exportName} in ${path}`);
}

export function loadGameCatalogMetadata(root = resolve(import.meta.dirname, "../..")): GameCatalogMetadata[] {
  const catalogPath = resolve(root, "packages/data/gameCatalog.ts");
  const source = sourceFile(catalogPath);
  const imports = new Map<string, string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause?.namedBindings || !ts.isNamedImports(statement.importClause.namedBindings) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    for (const element of statement.importClause.namedBindings.elements) {
      const localName = element.name.text;
      const modulePath = resolve(dirname(catalogPath), statement.moduleSpecifier.text, "index.ts");
      imports.set(localName, modulePath);
    }
  }
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "allGameDefinitions" || !declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) continue;
      return declaration.initializer.elements.map((element) => {
        if (!ts.isIdentifier(element)) throw new Error("allGameDefinitions entries must be imported identifiers");
        const definitionPath = imports.get(element.text);
        if (!definitionPath) throw new Error(`Missing import path for catalog entry ${element.text}`);
        return readDefinition(definitionPath, element.text);
      });
    }
  }
  throw new Error("Unable to locate allGameDefinitions array");
}
