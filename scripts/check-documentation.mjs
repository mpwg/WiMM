// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import MarkdownIt from 'markdown-it';
import { parseAllDocuments } from 'yaml';

const markdown = new MarkdownIt({ html: true });
const textExtensions = new Set(['.json', '.md', '.yaml', '.yml']);
const skippedDirectories = new Set(['.git', '.githooks', '.toolchain-checks', 'dist', 'gen', 'node_modules', 'target', 'test-results']);

function parseArguments(argumentsList) {
  const rootFlag = argumentsList.indexOf('--root');
  if (rootFlag === -1) return process.cwd();

  const root = argumentsList[rootFlag + 1];
  if (!root) throw new Error('Für --root fehlt ein Verzeichnis.');

  return path.resolve(root);
}

async function collectFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) files.push(...(await collectFiles(root, fullPath)));
      continue;
    }

    if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

function relative(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function slugify(value) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('de-DE')
    .replace(/<[^>]*>/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/gu, '-');
}

function anchorsFor(source) {
  const anchors = new Set();
  const occurrences = new Map();
  const tokens = markdown.parse(source, {});

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].type !== 'heading_open') continue;

    const title = tokens[index + 1]?.content ?? '';
    const base = slugify(title);
    const count = occurrences.get(base) ?? 0;
    occurrences.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }

  return anchors;
}

function localLinksFor(source) {
  const links = [];
  const visit = (tokens) => {
    for (const token of tokens) {
      if (token.type === 'link_open' || token.type === 'image') {
        const link = token.attrGet('href') ?? token.attrGet('src');
        if (typeof link === 'string') links.push(link);
      }
      if (token.children) visit(token.children);
    }
  };

  visit(markdown.parse(source, {}));
  return links;
}

function isExternal(link) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(link);
}

function decodePart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(`Ungültige URL-Kodierung: ${value}`);
  }
}

function resolveLocalTarget(root, sourceFile, link) {
  const [rawPath, rawAnchor = ''] = link.split('#', 2);
  const decodedPath = decodePart(rawPath);
  const decodedAnchor = decodePart(rawAnchor);
  const target = decodedPath === '' ? sourceFile : path.resolve(path.dirname(sourceFile), decodedPath);
  const relativeTarget = path.relative(root, target);

  if (relativeTarget === '..' || relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget)) {
    throw new Error('Verweis verlässt das Repository.');
  }

  return { anchor: decodedAnchor, target };
}

async function validateFileFormat(root, file, errors) {
  const displayName = relative(root, file);
  const bytes = await readFile(file);
  let source;

  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    errors.push(`${displayName}: keine gültige UTF-8-Datei.`);
    return undefined;
  }

  if (source.includes('\r')) errors.push(`${displayName}: CR-Zeichen gefunden; LF verwenden.`);
  if (!source.endsWith('\n')) errors.push(`${displayName}: Abschlusszeile fehlt.`);
  if (/[^\S\r\n]+$/mu.test(source)) errors.push(`${displayName}: Leerraum am Zeilenende gefunden.`);

  const extension = path.extname(file).toLowerCase();
  try {
    if (extension === '.json') JSON.parse(source);
    if (extension === '.yaml' || extension === '.yml') {
      const documents = parseAllDocuments(source, { uniqueKeys: true });
      const yamlErrors = documents.flatMap((document) => document.errors.map((error) => error.message));
      if (yamlErrors.length > 0) {
        throw new Error(yamlErrors.join('; '));
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`${displayName}: ungültiges ${extension === '.json' ? 'JSON' : 'YAML'} (${message}).`);
  }

  return source;
}

export async function checkDocumentation(root) {
  const files = await collectFiles(root);
  const errors = [];
  const markdownSources = new Map();

  for (const file of files) {
    const source = await validateFileFormat(root, file, errors);
    if (source !== undefined && path.extname(file).toLowerCase() === '.md') {
      markdownSources.set(file, source);
    }
  }

  const anchors = new Map([...markdownSources].map(([file, source]) => [file, anchorsFor(source)]));

  for (const [sourceFile, source] of markdownSources) {
    for (const link of localLinksFor(source)) {
      if (isExternal(link)) continue;

      try {
        const { anchor, target } = resolveLocalTarget(root, sourceFile, link);
        const targetStatus = await stat(target).catch(() => undefined);
        if (!targetStatus?.isFile()) {
          errors.push(`${relative(root, sourceFile)}: Ziel fehlt (${link}).`);
          continue;
        }

        if (anchor !== '') {
          const targetAnchors = anchors.get(target);
          if (!targetAnchors) {
            errors.push(`${relative(root, sourceFile)}: Ankerziel ist keine Markdown-Datei (${link}).`);
          } else if (!targetAnchors.has(anchor)) {
            errors.push(`${relative(root, sourceFile)}: Anker fehlt (${link}).`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${relative(root, sourceFile)}: ungültiger Verweis (${link}; ${message}).`);
      }
    }
  }

  return errors;
}

async function main() {
  const root = parseArguments(process.argv.slice(2));
  const errors = await checkDocumentation(root);

  if (errors.length > 0) {
    console.error(`Dokumentationsprüfung fehlgeschlagen (${errors.length} Fehler):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log('Dokumentationsprüfung bestanden.');
}

const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedFile === fileURLToPath(import.meta.url)) await main();
