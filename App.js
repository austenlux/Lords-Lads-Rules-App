import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import RulesIcon from './assets/images/rules.svg';
import ExpansionsIcon from './assets/images/expansions.svg';
import AboutIcon from './assets/images/about.svg';
import { styles, markdownStyles } from './src/styles';
import { useContent } from './src/hooks/useContent';
import { ContentScreen, AboutScreen } from './src/screens';

const SPLASH_MIN_MS = 1000;
const SPLASH_FADE_MS = 400;
const LOGO_SIZE_RATIO = 0.9;
/** Slightly smaller than splash so the background logo never appears larger and avoids shift. */
const BG_LOGO_SIZE_SCALE = 0.99;

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
    scrollViewRef,
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
