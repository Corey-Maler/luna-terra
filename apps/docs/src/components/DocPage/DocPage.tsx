/* eslint-disable @typescript-eslint/no-empty-object-type */
import React, { useEffect, useRef } from 'react';
import { useNavGuide } from '../../context/NavGuideContext';
import { CodePreview } from '../CodePreview';

import styles from './DocPage.module.css';

export interface MethodParam {
  name: string;
  type: string;
  description: string;
  optional?: boolean;
  default?: string;
}

export interface MethodProps {
  /** Full TypeScript signature, e.g. `add(v: V2): V2` */
  signature: string;
  /** Short prose description of what this method does. */
  description: React.ReactNode;
  /** Parameter descriptions. Omit for zero-arg methods. */
  params?: MethodParam[];
  /** Return type and optional description. */
  returns?: { type: string; description?: string };
  /** Mark as a static method or property. */
  isStatic?: boolean;
}

export const DocPage = ({
  title,
  section,
  children,
}: React.PropsWithChildren<{ title: string; section: string }>) => {
  return (
    <div className={styles.container}>
      <p className={styles.pageSection}>{section}</p>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.body}>{children}</div>
    </div>
  );
};

/** A named section that appears in the NavGuide scroll-spy */
let sectionCounter = 0;

DocPage.Section = ({
  id,
  title,
  children,
}: React.PropsWithChildren<{ id: string; title: string }>) => {
  const { registerSection, unregisterSection } = useNavGuide();
  const orderRef = useRef(++sectionCounter);

  useEffect(() => {
    const order = orderRef.current;
    registerSection({ id, title, order });
    return () => unregisterSection(id);
  }, [id, title, registerSection, unregisterSection]);

  return (
    <section id={id} className={styles.section}>
      <h2 className={styles.sectionHeading}>{title}</h2>
      {children}
    </section>
  );
};

DocPage.Arg = ({ children }: React.PropsWithChildren<{}>) => {
  return (
    <h3 className={styles.arg}>
      <code>{children}</code>
    </h3>
  );
};

DocPage.Pre = ({ children }: React.PropsWithChildren<{}>) => {
  const code = flattenTextChildren(children);
  if (code !== null) {
    return (
      <div className={styles.preWrap}>
        <CodePreview
          language={guessCodeLanguage(code)}
          foldThreshold={999}
          showLineNumbers={false}
        >
          {code}
        </CodePreview>
      </div>
    );
  }

  return (
    <pre className={styles.pre}>
      {children}
    </pre>
  );
};

DocPage.Method = ({
  signature,
  description,
  params,
  returns,
  isStatic,
}: MethodProps) => {
  return (
    <div className={styles.method}>
      <div className={styles.methodHeader}>
        {isStatic && <span className={styles.staticBadge}>static</span>}
        <pre className={styles.methodSig}><code>{signature}</code></pre>
      </div>
      <p className={styles.methodDesc}>{description}</p>
      {params && params.length > 0 && (
        <dl className={styles.paramList}>
          {params.map(p => (
            <React.Fragment key={p.name}>
              <dt className={styles.paramDt}>
                <code className={styles.paramName}>{p.name}{p.optional ? '?' : ''}</code>
                <span className={styles.typeBadge}>{p.type}</span>
                {p.default !== undefined && (
                  <span className={styles.defaultChip}>= {p.default}</span>
                )}
              </dt>
              <dd className={styles.paramDd}>{p.description}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
      {returns && (
        <div className={styles.returns}>
          <span className={styles.returnsLabel}>Returns</span>
          <span className={styles.typeBadge}>{returns.type}</span>
          {returns.description && (
            <span className={styles.returnsDesc}> — {returns.description}</span>
          )}
        </div>
      )}
    </div>
  );
};

function flattenTextChildren(children: React.ReactNode): string | null {
  const parts: string[] = [];
  let ok = true;

  React.Children.forEach(children, child => {
    if (typeof child === 'string' || typeof child === 'number') {
      parts.push(String(child));
      return;
    }

    if (child === null || child === undefined || typeof child === 'boolean') {
      return;
    }

    ok = false;
  });

  return ok ? parts.join('') : null;
}

function guessCodeLanguage(code: string): string {
  const trimmed = code.trim();
  if (trimmed.startsWith('pnpm ') || trimmed.startsWith('npm ') || trimmed.startsWith('yarn ') || trimmed.startsWith('bun ')) {
    return 'bash';
  }
  if (trimmed.includes('interface ') || trimmed.includes('type ') || trimmed.includes(': ') || trimmed.includes('import {')) {
    return 'typescript';
  }
  return 'javascript';
}

