import { generatedSymbols } from '../generated/coreSymbols.generated';
import { RouteDefinitions } from '../pages/AllPages';
import { getDocSymbolHref } from './docSymbols';

export interface DocSearchResult {
  id: string;
  title: string;
  href: string;
  kind: 'page' | 'symbol' | 'api';
  section: string;
  summary: string;
  keywords: string[];
}

const pageResults: DocSearchResult[] = RouteDefinitions.flatMap((section) =>
  section.pages.flatMap((page) => {
    const pageHref = `/${section.tag}/${page.tag}`;
    const pageEntry: DocSearchResult = {
      id: `page:${section.tag}/${page.tag}`,
      title: page.title,
      href: pageHref,
      kind: 'page',
      section: section['section-title'],
      summary: `Docs page in ${section['section-title']}`,
      keywords: [page.title, page.tag, ...(page.searchTerms ?? [])],
    };

    const apiEntries: DocSearchResult[] = (page.searchEntries ?? []).map((entry) => ({
      id: `api:${section.tag}/${page.tag}:${entry.anchor ?? entry.title}`,
      title: entry.title,
      href: entry.anchor ? `${pageHref}#${entry.anchor}` : pageHref,
      kind: 'api',
      section: `${page.title} API`,
      summary: entry.summary ?? `API entry in ${page.title}`,
      keywords: [entry.title, ...(entry.keywords ?? [])],
    }));

    return [...apiEntries, pageEntry];
  }),
);

const symbolResults = generatedSymbols
  .map<DocSearchResult | null>((symbol) => {
    const href = getDocSymbolHref(symbol.name);
    if (!href) {
      return null;
    }

    return {
      id: `symbol:${symbol.id}`,
      title: symbol.name,
      href,
      kind: 'symbol' as const,
      section: symbol.packageName,
      summary: symbol.docs || symbol.summary,
      keywords: [symbol.name, symbol.kind, symbol.packageName, symbol.summary, symbol.docs],
    };
  })
  .filter((result): result is DocSearchResult => result !== null);

const searchCorpus = [...symbolResults, ...pageResults];

export function searchDocs(query: string, limit = 8): DocSearchResult[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return [];
  }

  return searchCorpus
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, normalizedQuery),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.entry.title.localeCompare(right.entry.title))
    .slice(0, limit)
    .map((candidate) => candidate.entry);
}

function scoreEntry(entry: DocSearchResult, normalizedQuery: string): number {
  const title = normalize(entry.title);
  const section = normalize(entry.section);
  const summary = normalize(entry.summary);
  const keywords = entry.keywords.map(normalize);

  if (title === normalizedQuery) {
    return 120;
  }

  let score = 0;
  let matchedPrimaryField = false;

  if (title.startsWith(normalizedQuery)) {
    score += 90;
    matchedPrimaryField = true;
  } else if (title.includes(normalizedQuery)) {
    score += 70;
    matchedPrimaryField = true;
  }

  for (const keyword of keywords) {
    if (keyword.startsWith(normalizedQuery)) {
      score += 18;
      matchedPrimaryField = true;
    } else if (keyword.includes(normalizedQuery)) {
      score += 10;
      matchedPrimaryField = true;
    }
  }

  if (!matchedPrimaryField) {
    return 0;
  }

  if (section.includes(normalizedQuery)) {
    score += 25;
  }

  if (summary.includes(normalizedQuery)) {
    score += 20;
  }

  if (entry.kind === 'symbol') {
    score += 8;
  }

  if (entry.kind === 'api') {
    score += 14;
  }

  return score;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}