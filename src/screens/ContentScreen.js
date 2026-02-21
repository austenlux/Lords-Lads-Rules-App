/**
 * Content screen for Rules or Expansions tab: search bar and section list.
 */
import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { EmptySearchResults } from '../components';
import SearchIcon from '../../assets/images/search.svg';

export default function ContentScreen({
  content,
  sections,
  searchQuery,
  showSearch,
  toggleSearchBar,
  handleSearchQueryChange,
  searchInputRef,
  renderSection,
  scrollViewRef,
  onScroll,
  searchPlaceholder,
  styles,
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.headerContainer}>
        {!showSearch ? (
          <>
            <View style={styles.spacer} />
            <TouchableOpacity style={styles.searchIconContainer} onPress={toggleSearchBar}>
              <SearchIcon width={24} height={24} fill="#2196F3" />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.searchBarWrapper}>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={handleSearchQueryChange}
              autoFocus={true}
            />
            <TouchableOpacity style={styles.closeIconContainer} onPress={toggleSearchBar}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
    </View>
  );
}
