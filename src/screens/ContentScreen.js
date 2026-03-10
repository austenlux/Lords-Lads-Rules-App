/**
 * Content screen for Rules or Expansions tab: section list only.
 * Search UI lives in a fixed header above all tabs (in App.js).
 */
import React, { useState } from 'react';
import { View, ScrollView, Platform, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { EmptySearchResults } from '../components';
import NoWifiIcon from '../components/NoWifiIcon';
import { useTheme } from '../context/ThemeContext';

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
  rateLimited = false,
  onRetry,
  emptyStateContentLabel = 'rules',
}) {
  const { titleFont, bodyFont } = useTheme();
  const [retryInProgress, setRetryInProgress] = useState(false);
  const showSearchEmpty = sections.length === 0 && searchQuery && searchQuery.length >= 2;
  const showFetchFailedEmpty = sections.length === 0 && isEmptyState && !showSearchEmpty;
  const isExpansions = emptyStateContentLabel === 'expansions';
  const emptyTitle = isExpansions ? 'Unable to load expansions' : 'Unable to load rules';
  const emptyMessage = (() => {
    if (isExpansions && rateLimited) {
      return "GitHub's API rate limit has been reached. Your cached expansions will load automatically — if this is your first launch, try again in a few minutes.";
    }
    if (isExpansions) {
      return "We couldn't fetch the expansions. Check your internet connection and try again.";
    }
    return "We couldn't fetch the rules. Check your internet connection and try again.";
  })();

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
            <View style={styles.emptyStateIcon}>
              <NoWifiIcon width={50} height={50} />
            </View>
            <Text style={[styles.emptyStateTitle, { fontFamily: titleFont }]}>{emptyTitle}</Text>
            <Text style={[styles.emptyStateText, { fontFamily: bodyFont }]}>{emptyMessage}</Text>
            {onRetry && (
              retryInProgress ? (
                <View style={[styles.retryButton, { marginTop: 16, justifyContent: 'center', alignItems: 'center' }]}>
                  <ActivityIndicator size="small" color="#121212" />
                </View>
              ) : (
                <TouchableOpacity style={[styles.retryButton, { marginTop: 16 }]} onPress={handleRetry}>
                  <Text style={[styles.retryButtonText, { fontFamily: bodyFont }]}>Try Again</Text>
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
