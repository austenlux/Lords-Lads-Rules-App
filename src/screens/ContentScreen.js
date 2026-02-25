/**
 * Content screen for Rules or Expansions tab: section list only.
 * Search UI lives in a fixed header above all tabs (in App.js).
 */
import React, { useState } from 'react';
import { View, ScrollView, Platform, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
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
  isEmptyState = false,
  onRetry,
  emptyStateContentLabel = 'rules',
}) {
  const [retryInProgress, setRetryInProgress] = useState(false);
  const showSearchEmpty = sections.length === 0 && searchQuery && searchQuery.length >= 2;
  const showFetchFailedEmpty = sections.length === 0 && isEmptyState && !showSearchEmpty;
  const isExpansions = emptyStateContentLabel === 'expansions';
  const emptyTitle = isExpansions ? 'Unable to load expansions' : 'Unable to load rules';
  const emptyMessage = isExpansions
    ? "We couldn't fetch the expansions. Check your internet connection and try again."
    : "We couldn't fetch the rules. Check your internet connection and try again.";

  const handleRetry = async () => {
    if (!onRetry || retryInProgress) return;
    setRetryInProgress(true);
    try {
      await onRetry();
    } finally {
      setRetryInProgress(false);
    }
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.scrollView, contentHeight != null && (Platform.OS === 'ios' ? { minHeight: contentHeight } : { height: contentHeight, minHeight: contentHeight })]}
      contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <View style={[styles.contentContainer, contentPaddingTop != null && { paddingTop: contentPaddingTop }]}>
        {showSearchEmpty ? (
          <EmptySearchResults query={searchQuery} styles={styles} />
        ) : showFetchFailedEmpty ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateIcon}>📡</Text>
            <Text style={styles.emptyStateTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyStateText}>{emptyMessage}</Text>
            {onRetry && (
              retryInProgress ? (
                <View style={[styles.retryButton, { marginTop: 16, justifyContent: 'center', alignItems: 'center' }]}>
                  <ActivityIndicator size="small" color="#121212" />
                </View>
              ) : (
                <TouchableOpacity style={[styles.retryButton, { marginTop: 16 }]} onPress={handleRetry}>
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              )
            )}
          </View>
        ) : (
          sections.map((section, index) => renderSection(section, index))
        )}
      </View>
    </ScrollView>
  );
}
