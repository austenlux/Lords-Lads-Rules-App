/**
 * Content screen for Rules or Expansions tab: section list only.
 * Search UI lives in a fixed header above all tabs (in App.js).
 */
import React from 'react';
import { View, ScrollView } from 'react-native';
import { EmptySearchResults } from '../components';

export default function ContentScreen({
  sections,
  searchQuery,
  renderSection,
  scrollViewRef,
  onScroll,
  styles,
}) {
  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.scrollView}
      contentInsetAdjustmentBehavior="automatic"
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.contentContainer}>
        {sections.length === 0 && searchQuery && searchQuery.length >= 2 ? (
          <EmptySearchResults query={searchQuery} styles={styles} />
        ) : (
          sections.map((section, index) => renderSection(section, index))
        )}
      </View>
    </ScrollView>
  );
}
