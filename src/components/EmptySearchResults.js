/**
 * Empty state when search returns no matches.
 */
import React from 'react';
import { View, Text } from 'react-native';
import SearchIcon from '../../assets/icons/search.svg';
import { useTheme } from '../context/ThemeContext';

export default function EmptySearchResults({ query, styles }) {
  const { titleFont, bodyFont } = useTheme();
  return (
    <View style={styles.emptyStateContainer}>
      <View style={styles.emptyStateIcon}>
        <SearchIcon width={50} height={50} fill="#2196F3" />
      </View>
      <Text style={[styles.emptyStateTitle, { fontFamily: titleFont }]}>No matching rules found</Text>
      <Text style={[styles.emptyStateText, { fontFamily: bodyFont }]}>We couldn't find any rules matching "{query}".</Text>
      <Text style={[styles.emptyStateText, { fontFamily: bodyFont }]}>Try using different keywords or check your spelling.</Text>
    </View>
  );
}
