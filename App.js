import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import Markdown from 'react-native-markdown-display';
import RulesIcon from './assets/images/rules.svg';
import ExpansionsIcon from './assets/images/expansions.svg';
import AboutIcon from './assets/images/about.svg';
import SearchIcon from './assets/images/search.svg';
import { styles, markdownStyles } from './src/styles';
import { useContent } from './src/hooks/useContent';
import { ContentScreen, AboutScreen } from './src/screens';

const SPLASH_MIN_MS = 1000;
const SPLASH_FADE_MS = 400;
const LOGO_SIZE_RATIO = 0.9;
/** Slightly smaller than splash so the background logo never appears larger and avoids shift. */
const BG_LOGO_SIZE_SCALE = 0.99;

const TABS = ['rules', 'expansions', 'about'];
const tabToIndex = (tab) => TABS.indexOf(tab);

function getLogoLayout() {
  const { width, height } = Dimensions.get('window');
  const logoSize = Math.min(width, height) * LOGO_SIZE_RATIO;
  const bgLogoSize = logoSize * BG_LOGO_SIZE_SCALE;
  return {
    width,
    height,
    logoSize,
    logoLeft: (width - logoSize) / 2,
    logoTop: (height - logoSize) / 2,
    bgLogoSize,
    bgLogoLeft: (width - bgLogoSize) / 2,
    bgLogoTop: (height - bgLogoSize) / 2,
  };
}

export default function App() {
  const [splashMinTimeElapsed, setSplashMinTimeElapsed] = useState(false);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const splashOpacity = useRef(new Animated.Value(0)).current;
  const mainAppOpacity = useRef(new Animated.Value(0)).current;
  const fadeOutStarted = useRef(false);
  const pagerRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setSplashMinTimeElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    Animated.timing(splashOpacity, {
      toValue: 1,
      duration: SPLASH_FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [splashOpacity]);

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
    rulesScrollViewRef,
    expansionsScrollViewRef,
    saveScrollY,
    searchInputRef,
    fetchExpansions,
    handleSearchQueryChange,
    toggleSearchBar,
    renderSection,
  } = useContent(styles, markdownStyles);

  useEffect(() => {
    if (!splashMinTimeElapsed || loading || fadeOutStarted.current) return;
    fadeOutStarted.current = true;
    Animated.parallel([
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: SPLASH_FADE_MS,
        useNativeDriver: true,
      }),
      Animated.timing(mainAppOpacity, {
        toValue: 1,
        duration: SPLASH_FADE_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setSplashDismissed(true);
    });
  }, [splashMinTimeElapsed, loading, splashOpacity, mainAppOpacity]);

  const logoLayout = getLogoLayout();

  useEffect(() => {
    const index = tabToIndex(activeTab);
    if (index >= 0 && pagerRef.current?.setPage) {
      pagerRef.current.setPage(index);
    }
  }, [activeTab]);

  const handlePageSelected = (e) => {
    const index = e.nativeEvent.position;
    if (TABS[index]) setActiveTab(TABS[index]);
  };

  const goToTab = (tab) => setActiveTab(tab);

  const renderPage = (tab) => {
    const isActive = activeTab === tab;
    if (tab === 'rules') {
      return (
        <ContentScreen
          key="rules"
          sections={sections}
          searchQuery={searchQuery}
          renderSection={renderSection}
          scrollViewRef={rulesScrollViewRef}
          onScroll={saveScrollY('rules')}
          styles={styles}
        />
      );
    }
    if (tab === 'expansions') {
      return (
        <ContentScreen
          key="expansions"
          sections={expansionSections}
          searchQuery={searchQuery}
          renderSection={renderSection}
          scrollViewRef={expansionsScrollViewRef}
          onScroll={saveScrollY('expansions')}
          styles={styles}
        />
      );
    }
    return <AboutScreen key="about" lastFetchDate={lastFetchDate} styles={styles} />;
  };

  const mainContent = error ? (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: 'transparent' }]}>
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
  ) : (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: 'transparent' }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      <View style={styles.mainContainer}>
        <View style={styles.globalSearchHeader}>
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
                placeholder={activeTab === 'rules' ? 'Search rules...' : activeTab === 'expansions' ? 'Search expansions...' : 'Search...'}
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
        <PagerView
          ref={pagerRef}
          style={{ flex: 1 }}
          initialPage={tabToIndex(activeTab)}
          onPageSelected={handlePageSelected}
        >
          <View key="0" style={{ flex: 1 }} collapsable={false}>
            {renderPage('rules')}
          </View>
          <View key="1" style={{ flex: 1 }} collapsable={false}>
            {renderPage('expansions')}
          </View>
          <View key="2" style={{ flex: 1 }} collapsable={false}>
            {renderPage('about')}
          </View>
        </PagerView>
      </View>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'rules' && styles.activeTabButton]}
          onPress={() => goToTab('rules')}
        >
          <View style={[styles.tabIconContainer, activeTab === 'rules' && styles.activeTabIconContainer]}>
            <RulesIcon width={32} height={32} color={activeTab === 'rules' ? '#121212' : '#E1E1E1'} fill={activeTab === 'rules' ? '#121212' : '#E1E1E1'} style={styles.tabIcon} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'expansions' && styles.activeTabButton]}
          onPress={() => goToTab('expansions')}
        >
          <View style={[styles.tabIconContainer, activeTab === 'expansions' && styles.activeTabIconContainer]}>
            <ExpansionsIcon width={32} height={32} color={activeTab === 'expansions' ? '#121212' : '#E1E1E1'} fill={activeTab === 'expansions' ? '#121212' : '#E1E1E1'} style={styles.tabIcon} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'about' && styles.activeTabButton]}
          onPress={() => goToTab('about')}
        >
          <View style={[styles.tabIconContainer, activeTab === 'about' && styles.activeTabIconContainer]}>
            <AboutIcon width={32} height={32} color={activeTab === 'about' ? '#121212' : '#E1E1E1'} fill={activeTab === 'about' ? '#121212' : '#E1E1E1'} style={styles.tabIcon} />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <Animated.View style={{ flex: 1, opacity: mainAppOpacity }}>
        <View style={{ flex: 1 }}>
          {(activeTab === 'rules' || activeTab === 'expansions') && (
            <>
              <Image
                source={require('./assets/logo_dark_greyscale.png')}
                style={{
                  position: 'absolute',
                  width: logoLayout.bgLogoSize,
                  height: logoLayout.bgLogoSize,
                  left: logoLayout.bgLogoLeft,
                  top: logoLayout.bgLogoTop,
                }}
                resizeMode="contain"
              />
              <View
                style={{
                  position: 'absolute',
                  left: logoLayout.bgLogoLeft,
                  top: logoLayout.bgLogoTop,
                  width: logoLayout.bgLogoSize,
                  height: logoLayout.bgLogoSize,
                  backgroundColor: 'rgba(18, 18, 18, 0.7)',
                }}
              />
            </>
          )}
          {mainContent}
        </View>
      </Animated.View>
      {!splashDismissed && (
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: '#121212',
            opacity: splashOpacity,
          }}
        >
          <Image
            source={require('./assets/logo_dark.png')}
            style={{
              position: 'absolute',
              width: logoLayout.logoSize,
              height: logoLayout.logoSize,
              left: logoLayout.logoLeft,
              top: logoLayout.logoTop,
            }}
            resizeMode="contain"
          />
        </Animated.View>
      )}
    </View>
  );
}
