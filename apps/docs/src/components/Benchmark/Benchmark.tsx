import { Button } from '../Button/Button';
import { Progress } from '../Progress/Progress';

import styles from './Benchmark.module.css';
import { CodePreview } from '../CodePreview';
import { useState } from 'react';
import { HorizontalStack } from '../horizontalStack';
import { DocPage } from '../DocPage/DocPage';
import { SlideIn } from '../SlideIn/SlideIn';

export type CTX = Record<any, any>;
export type BenchFn = (context: CTX) => void;
export type Results = Record<number, { first: number; second: number }>;

const ResultsGrid = ({ results }: { results: Results }) => {
  if (Object.keys(results).length === 0) return null;

  return (
    <div className={styles.resultsGrid}>
      <div className={styles.gridHeader}>Iterations</div>
      <div className={styles.gridHeader + ' ' + styles.first}>First</div>
      <div className={styles.gridHeader + ' ' + styles.second}>Second</div>

      {Object.entries(results).map(([iter, res]) => {
        const t1 = res.first;
        const t2 = res.second;
        const firstIsFaster = t1 < t2;
        const fasterTime = firstIsFaster ? t1 : t2;
        const slowerTime = firstIsFaster ? t2 : t1;
        const percentFaster = (slowerTime / fasterTime - 1) * 100;

        return (
          <>
            <div className={styles.gridCell} key={`${iter}-iter`}>
              {iter}
            </div>
            <div className={styles.gridCell} key={`${iter}-first`}>
              {t1.toFixed(2)}ms
              {firstIsFaster && (
                <>
                  {' '}
                  (
                  <span className={styles.faster}>
                    {percentFaster.toFixed(2)}% faster
                  </span>
                  )
                </>
              )}
            </div>
            <div className={styles.gridCell} key={`${iter}-second`}>
              {t2.toFixed(2)}ms
              {!firstIsFaster && (
                <>
                  {' '}
                  (
                  <span className={styles.faster}>
                    {percentFaster.toFixed(2)}% faster
                  </span>
                  )
                </>
              )}
            </div>
          </>
        );
      })}
    </div>
  );
};

export const Benchmark = ({
  setupFn,
  fn1,
  fn2,
  title,
  description,
  section,
}: {
  setupFn: (ctx: CTX) => void;
  fn1: BenchFn;
  fn2: BenchFn;
  title: string;
  description: string;
  section: string;
}) => {
  const [progress, setProgress] = useState(-1);
  const [results, setResults] = useState<Results>({});
  const measure = (iter: number) => {
    const context: CTX = {};
    setupFn(context);

    const start1 = performance.now();
    for (let i = 0; i < iter; i++) {
      fn1(context);
    }
    const end1 = performance.now();

    const start2 = performance.now();
    for (let i = 0; i < iter; i++) {
      fn2(context);
    }
    const end2 = performance.now();

    return {
      first: end1 - start1,
      second: end2 - start2,
    };
  };

  const run = async () => {
    const result: Results = {};
    const iterations = [1000, 5_000, 10_000, 50_000, 100_000, 200_000, 300_000];
    setProgress(0);
    await new Promise((resolve) => setTimeout(resolve, 50));


    for (let i = 0; i < iterations.length; i++) {
      const iter = iterations[i];
      const res = measure(iter);
      await new Promise((resolve) => setTimeout(resolve, 50));
      setProgress((i / iterations.length) * 100);
      result[iter] = res;
    }
    setProgress(100);
    setResults(result);
  };

  const runMore = async () => {
    const currentIters = Object.keys(results).map(Number);
    const maxIter = currentIters.length > 0 ? Math.max(...currentIters) : 0;
    const nextIter = maxIter > 0 ? maxIter + 100_000 : 1000;

    const res = measure(nextIter);
    setResults((prev) => ({ ...prev, [nextIter]: res }));
  };
  return (
    <DocPage title={title} section={section}>
      <div className={styles.wrap}>
        <div className="description">{description}</div>
        <h3>Setup code</h3>
        <CodePreview>{setupFn.toString()}</CodePreview>
        <h3 className={styles.first}>First alternative code</h3>
        <CodePreview>{fn1.toString()}</CodePreview>
        <h3 className={styles.second}>Second alternative code</h3>
        <CodePreview>{fn2.toString()}</CodePreview>

        <ResultsGrid results={results} />
        <HorizontalStack blockMargin={4}>
          <Button onClick={run}>Run</Button>
          <Button variant='secondary' onClick={runMore}>Run more</Button>
        </HorizontalStack>
        <SlideIn isOpen={progress >= 0 && progress < 100}>
            <Progress value={progress} label="PROGRESS" />
        </SlideIn>
      </div>
    </DocPage>
  );
};
