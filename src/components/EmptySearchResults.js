/**
 * Empty state when search returns no matches.
 */
import React from 'react';
import { View, Text } from 'react-native';

export default function EmptySearchResults({ query, styles }) {
  return (
    <View style={styles.emptyStateContainer}>
      <Text style={styles.emptyStateIcon}>🔍</Text>
      <Text style={styles.emptyStateTitle}>No matching rules found</Text>
      <Text style={styles.emptyStateText}>We couldn't find any rules matching "{query}".</Text>
      <Text style={styles.emptyStateText}>Try using different keywords or check your spelling.</Text>
    </View>
  );
}
