import { useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { Button } from '../Button/Button';
import { getDocsCodeBlockStyle, getDocsCodeTheme, getDocsLineNumberStyle } from '../../theme/codeTheme';
import { useDocsDarkMode } from '../../theme/useDocsDarkMode';

export const CodePreview = ({
  children,
  language = 'javascript',
  foldThreshold = 20,
  showLineNumbers = true,
}: {
  children: string;
  language?: string;
  foldThreshold?: number;
  showLineNumbers?: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDarkMode = useDocsDarkMode();

  const lines = children.split('\n');
  const shouldFold = lines.length > foldThreshold;
  const displayedCode =
    shouldFold && !isExpanded
      ? lines.slice(0, foldThreshold).join('\n')
      : children;

  return (
    <div>
      <SyntaxHighlighter
        language={language}
        style={getDocsCodeTheme(isDarkMode)}
        customStyle={getDocsCodeBlockStyle(isDarkMode)}
        lineNumberStyle={getDocsLineNumberStyle(isDarkMode)}
        showLineNumbers={showLineNumbers}
      >
        {displayedCode}
      </SyntaxHighlighter>
      {shouldFold && (
        <Button
          variant="link"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Show Less' : `Show all ${lines.length} lines`}
        </Button>
      )}
    </div>
  );
};
