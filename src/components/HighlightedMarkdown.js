/**
 * Markdown component with search term highlighting (bold via **).
 */
import React from 'react';
import Markdown from 'react-native-markdown-display';
import { normalizeSearchQuery, highlightMatches } from '../utils/searchUtils';

export default function HighlightedMarkdown({ content, searchQuery, style, onLinkPress }) {
  if (!content) {
    return null;
  }

  const enhancedStyle = {
    ...style,
    bullet_list: {
      ...style?.bullet_list,
      marginBottom: 0,
      marginTop: 8,
      gap: 8,
    },
    ordered_list: {
      ...style?.ordered_list,
      marginBottom: 0,
      marginTop: 8,
      gap: 8,
    },
    listItem: {
      ...style?.listItem,
      marginBottom: 0,
      marginTop: 0,
    },
    strong: {
      backgroundColor: 'rgba(187, 134, 252, 0.3)',
      color: '#ffffff',
      fontWeight: 'bold',
    },
  };

  const normalizedQuery = normalizeSearchQuery(searchQuery);
  const highlightedContent =
    normalizedQuery.length >= 2 ? highlightMatches(content, normalizedQuery) : content;

  return (
    <Markdown style={enhancedStyle} onLinkPress={onLinkPress}>
      {highlightedContent}
    </Markdown>
  );
}
