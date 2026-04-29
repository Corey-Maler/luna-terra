import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

const PACKAGES = [
  {
    packageName: '@lunaterra/core',
    entryFile: 'packages/core/src/index.ts',
    outputFile: 'apps/docs/src/generated/coreSymbols.generated.ts',
  },
];

const TYPE_FORMAT_FLAGS =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.UseFullyQualifiedType |
  ts.TypeFormatFlags.WriteArrowStyleSignature |
  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

await Promise.all(PACKAGES.map(generatePackageIndex));

async function generatePackageIndex(config) {
  const compilerOptions = loadCompilerOptions();
  const entryFile = path.join(workspaceRoot, config.entryFile);
  const outputFile = path.join(workspaceRoot, config.outputFile);
  const program = ts.createProgram([entryFile], compilerOptions);
  const checker = program.getTypeChecker();
  const entrySourceFile = program.getSourceFile(entryFile);

  if (!entrySourceFile) {
    throw new Error(`Could not load entry file: ${config.entryFile}`);
  }

  const moduleSymbol = checker.getSymbolAtLocation(entrySourceFile);
  if (!moduleSymbol) {
    throw new Error(`Could not resolve module symbol for: ${config.entryFile}`);
  }

  const exports = checker
    .getExportsOfModule(moduleSymbol)
    .map((symbol) => serializeSymbol(symbol, checker, config.packageName))
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));

  const content = renderGeneratedModule(config.packageName, exports);
  await fs.writeFile(outputFile, content, 'utf8');

  console.log(`Generated ${path.relative(workspaceRoot, outputFile)} (${exports.length} symbols)`);
}

function loadCompilerOptions() {
  const configPath = ts.findConfigFile(workspaceRoot, ts.sys.fileExists, 'tsconfig.base.json');
  if (!configPath) {
    throw new Error('Could not find tsconfig.base.json');
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(formatDiagnostic(configFile.error));
  }

  const compilerOptions = ts.convertCompilerOptionsFromJson(
    configFile.config.compilerOptions ?? {},
    workspaceRoot,
    configPath,
  );

  if (compilerOptions.errors.length > 0) {
    throw new Error(compilerOptions.errors.map(formatDiagnostic).join('\n'));
  }

  return {
    ...compilerOptions.options,
    noEmit: true,
  };
}

function serializeSymbol(symbol, checker, packageName) {
  const aliasedSymbol = unaliasSymbol(symbol, checker);
  const declaration = getPrimaryDeclaration(aliasedSymbol);

  if (!declaration) {
    return null;
  }

  const sourceFile = declaration.getSourceFile();
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(declaration.getStart());
  const name = aliasedSymbol.getName();
  const docs = ts.displayPartsToString(aliasedSymbol.getDocumentationComment(checker)).trim();
  const kind = getSymbolKind(aliasedSymbol, declaration);
  const summary = getSymbolSummary(aliasedSymbol, declaration, checker, name);
  const members = getSymbolMembers(aliasedSymbol, declaration, checker);

  return {
    id: `${packageName}:${name}`,
    packageName,
    name,
    kind,
    summary,
    docs,
    sourcePath: normalizePath(path.relative(workspaceRoot, sourceFile.fileName)),
    sourceLine: line + 1,
    sourceColumn: character + 1,
    members,
  };
}

function getPrimaryDeclaration(symbol) {
  const declarations = symbol.declarations ?? [];
  return declarations.find((declaration) => !ts.isExportSpecifier(declaration)) ?? declarations[0] ?? null;
}

function getSymbolKind(symbol, declaration) {
  if (ts.isClassDeclaration(declaration)) return 'class';
  if (ts.isInterfaceDeclaration(declaration)) return 'interface';
  if (ts.isTypeAliasDeclaration(declaration)) return 'type';
  if (ts.isEnumDeclaration(declaration)) return 'enum';
  if (ts.isFunctionDeclaration(declaration)) return 'function';
  if (ts.isVariableDeclaration(declaration) || ts.isVariableStatement(declaration)) return 'variable';
  if (symbol.flags & ts.SymbolFlags.TypeAlias) return 'type';
  if (symbol.flags & ts.SymbolFlags.Interface) return 'interface';
  if (symbol.flags & ts.SymbolFlags.Class) return 'class';
  return 'symbol';
}

function getSymbolSummary(symbol, declaration, checker, name) {
  if (ts.isClassDeclaration(declaration)) {
    return `class ${name}`;
  }
  if (ts.isInterfaceDeclaration(declaration)) {
    return `interface ${name}`;
  }
  if (ts.isTypeAliasDeclaration(declaration)) {
    return `type ${name} = ${declaration.type.getText()}`;
  }
  if (ts.isEnumDeclaration(declaration)) {
    return `enum ${name}`;
  }
  if (ts.isFunctionDeclaration(declaration)) {
    return signatureToString(checker, declaration, name);
  }
  if (ts.isVariableDeclaration(declaration)) {
    return `${name}: ${typeNodeOrInferred(checker, declaration, declaration.type)}`;
  }
  return name;
}

function getSymbolMembers(symbol, declaration, checker) {
  if (!ts.isClassDeclaration(declaration) && !ts.isInterfaceDeclaration(declaration)) {
    return [];
  }

  const type = checker.getDeclaredTypeOfSymbol(symbol);
  const properties = checker.getPropertiesOfType(type);
  const members = [];

  for (const memberSymbol of properties) {
    const memberDeclaration = getPrimaryDeclaration(memberSymbol);
    if (!memberDeclaration || isNonPublicMember(memberDeclaration)) {
      continue;
    }

    const memberName = memberSymbol.getName();
    const memberDocs = ts.displayPartsToString(memberSymbol.getDocumentationComment(checker)).trim();
    const memberKind = getMemberKind(memberDeclaration);
    const signature = getMemberSignature(memberSymbol, memberDeclaration, checker, memberName);
    const sourceFile = memberDeclaration.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(memberDeclaration.getStart());

    members.push({
      name: memberName,
      kind: memberKind,
      signature,
      docs: memberDocs,
      sourcePath: normalizePath(path.relative(workspaceRoot, sourceFile.fileName)),
      sourceLine: line + 1,
      sourceColumn: character + 1,
    });
  }

  if (ts.isClassDeclaration(declaration)) {
    for (const constructorDeclaration of declaration.members.filter(ts.isConstructorDeclaration)) {
      if (isNonPublicMember(constructorDeclaration)) {
        continue;
      }

      const constructorSignature = checker.getSignatureFromDeclaration(constructorDeclaration);
      members.unshift({
        name: 'constructor',
        kind: 'constructor',
        signature: constructorSignature
          ? `new ${checker.signatureToString(constructorSignature, constructorDeclaration, TYPE_FORMAT_FLAGS, TYPE_FORMAT_FLAGS)}`
          : 'new ()',
        docs: getNodeDocumentation(constructorDeclaration),
        sourcePath: normalizePath(path.relative(workspaceRoot, constructorDeclaration.getSourceFile().fileName)),
        sourceLine: constructorDeclaration.getSourceFile().getLineAndCharacterOfPosition(constructorDeclaration.getStart()).line + 1,
        sourceColumn: constructorDeclaration.getSourceFile().getLineAndCharacterOfPosition(constructorDeclaration.getStart()).character + 1,
      });
    }
  }

  return members.sort(compareMembers);
}

function compareMembers(left, right) {
  if (left.kind === 'constructor' && right.kind !== 'constructor') return -1;
  if (left.kind !== 'constructor' && right.kind === 'constructor') return 1;
  return left.name.localeCompare(right.name);
}

function getMemberKind(declaration) {
  if (ts.isConstructorDeclaration(declaration)) return 'constructor';
  if (ts.isMethodDeclaration(declaration) || ts.isMethodSignature(declaration)) return 'method';
  if (ts.isGetAccessorDeclaration(declaration)) return 'getter';
  if (ts.isSetAccessorDeclaration(declaration)) return 'setter';
  if (ts.isPropertyDeclaration(declaration) || ts.isPropertySignature(declaration)) return 'property';
  return 'member';
}

function getMemberSignature(symbol, declaration, checker, name) {
  if (ts.isMethodDeclaration(declaration) || ts.isMethodSignature(declaration)) {
    return signatureToString(checker, declaration, name);
  }
  if (ts.isGetAccessorDeclaration(declaration)) {
    return `get ${name}(): ${typeNodeOrInferred(checker, declaration, declaration.type)}`;
  }
  if (ts.isSetAccessorDeclaration(declaration)) {
    return `set ${name}(${declaration.parameters.map((parameter) => parameter.getText()).join(', ')}): void`;
  }
  if (ts.isPropertyDeclaration(declaration) || ts.isPropertySignature(declaration)) {
    const optional = declaration.questionToken ? '?' : '';
    return `${name}${optional}: ${typeNodeOrInferred(checker, declaration, declaration.type)}`;
  }

  const callSignatures = checker.getTypeOfSymbolAtLocation(symbol, declaration).getCallSignatures();
  if (callSignatures[0]) {
    return `${name}${checker.signatureToString(callSignatures[0], declaration, TYPE_FORMAT_FLAGS, TYPE_FORMAT_FLAGS)}`;
  }

  return name;
}

function signatureToString(checker, declaration, name) {
  const signature = checker.getSignatureFromDeclaration(declaration);
  if (!signature) {
    return name;
  }

  return `${name}${checker.signatureToString(signature, declaration, TYPE_FORMAT_FLAGS, TYPE_FORMAT_FLAGS)}`;
}

function typeNodeOrInferred(checker, declaration, typeNode) {
  if (typeNode) {
    return typeNode.getText();
  }

  return checker.typeToString(checker.getTypeAtLocation(declaration), declaration, TYPE_FORMAT_FLAGS);
}

function isNonPublicMember(declaration) {
  const flags = ts.getCombinedModifierFlags(declaration);
  return Boolean(flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected));
}

function unaliasSymbol(symbol, checker) {
  if (symbol.flags & ts.SymbolFlags.Alias) {
    return checker.getAliasedSymbol(symbol);
  }
  return symbol;
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function formatDiagnostic(diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
}

function getNodeDocumentation(node) {
  return ts.getJSDocCommentsAndTags(node)
    .map((tag) => typeof tag.comment === 'string' ? tag.comment.trim() : '')
    .filter(Boolean)
    .join('\n');
}

function renderGeneratedModule(packageName, symbols) {
  const serializedSymbols = JSON.stringify(symbols, null, 2);

  return `/* eslint-disable */\n/* auto-generated by scripts/generate-doc-symbol-index.mjs */\n\nexport interface GeneratedDocSymbolMember {\n  name: string;\n  kind: 'constructor' | 'method' | 'getter' | 'setter' | 'property' | 'member';\n  signature: string;\n  docs: string;\n  sourcePath: string;\n  sourceLine: number;\n  sourceColumn: number;\n}\n\nexport interface GeneratedDocSymbol {\n  id: string;\n  packageName: string;\n  name: string;\n  kind: 'class' | 'interface' | 'type' | 'enum' | 'function' | 'variable' | 'symbol';\n  summary: string;\n  docs: string;\n  sourcePath: string;\n  sourceLine: number;\n  sourceColumn: number;\n  members: GeneratedDocSymbolMember[];\n}\n\nexport const generatedPackageName = ${JSON.stringify(packageName)};\n\nexport const generatedSymbols: GeneratedDocSymbol[] = ${serializedSymbols} as GeneratedDocSymbol[];\n\nexport const generatedSymbolIndex: Record<string, GeneratedDocSymbol> = Object.fromEntries(\n  generatedSymbols.map((symbol) => [symbol.name, symbol]),\n);\n`;
}