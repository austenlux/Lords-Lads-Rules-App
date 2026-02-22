/**
 * Collapsible section with optional subsections and search highlighting.
 * Uses shared CollapsibleSection for header and expand/collapse behavior.
 */
import React from 'react';
import { Text } from 'react-native';
import { decodeHtmlEntities, normalizeSearchQuery } from '../utils/searchUtils';
import HighlightedMarkdown from './HighlightedMarkdown';
import CollapsibleSection from './CollapsibleSection';

export default function Section({
  title,
  level,
  content,
  subsections,
  onPress,
  isExpanded,
  path = [],
  onNavigate,
  sectionRefs,
  searchQuery,
  styles,
  markdownStyles,
}) {
  const trimmedSearchQuery = normalizeSearchQuery(searchQuery);
  const decodedTitle = decodeHtmlEntities(title);

  const handleLinkPress = (url) => {
    if (url.startsWith('#')) {
      const sectionTitle = decodeURIComponent(url.slice(1));
      onNavigate(sectionTitle);
      return false;
    }
    return true;
  };

  const fontSize = 32 - (level - 1) * 4;
  const titleNode =
    trimmedSearchQuery.length >= 2 ? (
      <Text style={[styles.sectionTitle, { fontSize, color: '#BB86FC' }]}>
        {decodedTitle
          .split(new RegExp(`(${trimmedSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
          .map((part, i) =>
            part.toLowerCase() === trimmedSearchQuery.toLowerCase() ? (
              <Text key={i} style={[{ fontSize, fontWeight: 'bold', color: '#BB86FC' }, styles.highlightedText]}>
                {part}
              </Text>
            ) : (
              part
            )
          )}
      </Text>
    ) : null;

  return (
    <CollapsibleSection
      title={decodedTitle}
      titleNode={titleNode}
      isExpanded={isExpanded}
      onToggle={() => onPress(path)}
      level={level}
      styles={styles}
      sectionRef={(ref) => {
        if (ref) sectionRefs[title] = ref;
      }}
    >
      {content && (
        <HighlightedMarkdown
          content={content}
          searchQuery={searchQuery}
          style={markdownStyles}
          onLinkPress={handleLinkPress}
        />
      )}
      {subsections?.map((subsection, index) => (
        <Section
          key={index}
          {...subsection}
          level={level + 1}
          path={[...path, 'subsections', index]}
          onPress={onPress}
          onNavigate={onNavigate}
          sectionRefs={sectionRefs}
          searchQuery={searchQuery}
          subsections={subsection.subsections}
          isExpanded={subsection.isExpanded}
          styles={styles}
          markdownStyles={markdownStyles}
        />
      ))}
    </CollapsibleSection>
  );
}
