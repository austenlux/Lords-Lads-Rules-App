/**
 * Content screen for Rules or Expansions tab: section list only.
 * Search UI lives in a fixed header above all tabs (in App.js).
 */
import React from 'react';
import { View, ScrollView, Platform } from 'react-native';
import { EmptySearchResults } from '../components';

export default function ContentScreen({
  sections,
  searchQuery,
  renderSection,
  scrollViewRef,
  onScroll,
  styles,
  contentHeight,
  contentPaddingTop,
}) {
  return (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.scrollView, contentHeight != null && (Platform.OS === 'ios' ? { minHeight: contentHeight } : { height: contentHeight, minHeight: contentHeight })]}
      contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <View style={[styles.contentContainer, contentPaddingTop != null && { paddingTop: contentPaddingTop }]}>
        {sections.length === 0 && searchQuery && searchQuery.length >= 2 ? (
          <EmptySearchResults query={searchQuery} styles={styles} />
        ) : (
          sections.map((section, index) => renderSection(section, index))
        )}
      </View>
    </ScrollView>
  );
}
