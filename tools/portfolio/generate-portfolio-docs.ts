import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadGameCatalogMetadata } from "./load-game-catalog-metadata";
import { renderPortfolioRoadmap, renderPortfolioStatus, renderReadmePortfolio, replaceMarkedSection } from "./portfolio-docs";

const root = resolve(import.meta.dirname, "../..");
const readmePath = resolve(root, "README.md");
const statusPath = resolve(root, "docs/project-status/portfolio-status.md");
const roadmapPath = resolve(root, "docs/project-status/portfolio-roadmap.md");
const gameCatalog = loadGameCatalogMetadata(root);

const readme = readFileSync(readmePath, "utf8");
writeFileSync(readmePath, replaceMarkedSection(readme, renderReadmePortfolio(gameCatalog)), "utf8");
writeFileSync(statusPath, renderPortfolioStatus(gameCatalog), "utf8");
writeFileSync(roadmapPath, renderPortfolioRoadmap(), "utf8");
process.stdout.write("Portfolio docs generated deterministically.\n");
