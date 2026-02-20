import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import RulesIcon from './assets/images/rules.svg';
import ExpansionsIcon from './assets/images/expansions.svg';
import AboutIcon from './assets/images/about.svg';
import { styles, markdownStyles } from './src/styles';
import { useContent } from './src/hooks/useContent';
import { ContentScreen, AboutScreen } from './src/screens';

export default function App() {
  const {
    loading,
    error,
    content,
    expansionsContent,
    expansionSections,
    sections,
    searchQuery,
    showSearch,
    activeTab,
    setActiveTab,
    lastFetchDate,
    scrollViewRef,
    searchInputRef,
    fetchExpansions,
    handleSearchQueryChange,
    toggleSearchBar,
    renderSection,
  } = useContent(styles, markdownStyles);

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Unable to Load Rules</Text>
            <View style={styles.centered}>
              <Markdown style={markdownStyles}>{"# Error\n\n" + error}</Markdown>
            </View>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchExpansions()}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const renderActiveScreen = () => {
    if (activeTab === 'rules') {
      return (
        <ContentScreen
          content={content}
          sections={sections}
          searchQuery={searchQuery}
          showSearch={showSearch}
          toggleSearchBar={toggleSearchBar}
          handleSearchQueryChange={handleSearchQueryChange}
          searchInputRef={searchInputRef}
          renderSection={renderSection}
          scrollViewRef={scrollViewRef}
          searchPlaceholder="Search rules..."
          styles={styles}
        />
      );
    }
    if (activeTab === 'expansions') {
      return (
        <ContentScreen
          content={expansionsContent}
          sections={expansionSections}
          searchQuery={searchQuery}
          showSearch={showSearch}
          toggleSearchBar={toggleSearchBar}
          handleSearchQueryChange={handleSearchQueryChange}
          searchInputRef={searchInputRef}
          renderSection={renderSection}
          scrollViewRef={scrollViewRef}
          searchPlaceholder="Search expansions..."
          styles={styles}
        />
      );
    }
    return <AboutScreen lastFetchDate={lastFetchDate} styles={styles} />;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      <View style={styles.mainContainer}>{renderActiveScreen()}</View>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'rules' && styles.activeTabButton]}
          onPress={() => setActiveTab('rules')}
        >
          <View style={[styles.tabIconContainer, activeTab === 'rules' && styles.activeTabIconContainer]}>
            <RulesIcon width={32} height={32} color={activeTab === 'rules' ? '#121212' : '#E1E1E1'} fill={activeTab === 'rules' ? '#121212' : '#E1E1E1'} style={styles.tabIcon} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'expansions' && styles.activeTabButton]}
          onPress={() => setActiveTab('expansions')}
        >
          <View style={[styles.tabIconContainer, activeTab === 'expansions' && styles.activeTabIconContainer]}>
            <ExpansionsIcon width={32} height={32} color={activeTab === 'expansions' ? '#121212' : '#E1E1E1'} fill={activeTab === 'expansions' ? '#121212' : '#E1E1E1'} style={styles.tabIcon} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'about' && styles.activeTabButton]}
          onPress={() => setActiveTab('about')}
        >
          <View style={[styles.tabIconContainer, activeTab === 'about' && styles.activeTabIconContainer]}>
            <AboutIcon width={32} height={32} color={activeTab === 'about' ? '#121212' : '#E1E1E1'} fill={activeTab === 'about' ? '#121212' : '#E1E1E1'} style={styles.tabIcon} />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
