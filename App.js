import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Image,
  Dimensions,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import RulesIcon from './assets/images/rules.svg';
import ExpansionsIcon from './assets/images/expansions.svg';
import ToolsIcon from './assets/images/tools.svg';
import AboutIcon from './assets/images/about.svg';
import SearchIcon from './assets/images/search.svg';
import { styles, markdownStyles } from './src/styles';
import { useContent } from './src/hooks/useContent';
import { useGameAssistant } from './src/hooks/useGameAssistant';
import { ContentScreen, AboutScreen, ToolsScreen } from './src/screens';
import { VoiceAssistantFAB } from './src/components';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';

const SPLASH_MIN_MS = 1000;
const SPLASH_FADE_MS = 400;
const LOGO_SIZE_RATIO = 0.9;
/** Slightly smaller than splash so the background logo never appears larger and avoids shift. */
const BG_LOGO_SIZE_SCALE = 0.99;

const TABS = ['rules', 'expansions', 'tools', 'about'];
const tabToIndex = (tab) => TABS.indexOf(tab);

/** Tab bar height; used for explicit PagerView height on iOS to fix child layout. */
const TAB_BAR_HEIGHT = 68;
/** Cap bottom inset so we don't reserve more than needed for the OS gesture bar (avoids excessive gap). */
const TAB_BAR_BOTTOM_INSET_MAX = 20;

/** On iOS, PagerView children get 0 height with flex-only layout; use explicit height. */
function getPageHeight() {
  return Dimensions.get('window').height - TAB_BAR_HEIGHT;
}

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
  const isIOS = Platform.OS === 'ios';
  const splashOpacity = useRef(new Animated.Value(isIOS ? 1 : 0)).current;
  const mainAppOpacity = useRef(new Animated.Value(0)).current;
  const fadeOutStarted = useRef(false);
  const pagerRef = useRef(null);
  const iosScrollRef = useRef(null);
  const insets = useSafeAreaInsets();
  const tabBarBottomInset = Math.min(insets.bottom, TAB_BAR_BOTTOM_INSET_MAX);

  useEffect(() => {
    const t = setTimeout(() => setSplashMinTimeElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (isIOS) return;
    Animated.timing(splashOpacity, {
      toValue: 1,
      duration: SPLASH_FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [splashOpacity, isIOS]);

  const {
    isSupported: aiSupported,
    isListening,
    isThinking,
    isActive: aiActive,
    askTheRules,
    stopAssistant,
    availableVoices,
    selectedVoiceId,
    previewVoice,
  } = useGameAssistant();

  const {
    loading,
    content,
    expansionsContent,
    expansionSections,
    sections,
    searchQuery,
    showSearch,
    activeTab,
    setActiveTab,
    lastFetchDate,
    rulesEmpty,
    expansionsEmpty,
    retryFetchContent,
    rulesScrollViewRef,
    expansionsScrollViewRef,
    saveScrollY,
    searchInputRef,
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
  const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
  const pageHeight = getPageHeight();
  const pageStyle = Platform.OS === 'ios' ? { flex: 1, height: pageHeight } : { flex: 1 };

  const [contentAreaHeight, setContentAreaHeight] = useState(null);
  const handleContentAreaLayout = (e) => {
    const { height } = e.nativeEvent.layout;
    if (height > 0) setContentAreaHeight(height);
  };
  const effectivePageHeight = (Platform.OS === 'ios' && contentAreaHeight) ? contentAreaHeight : pageHeight;
  const effectivePageStyle = Platform.OS === 'ios'
    ? { flex: 1, height: effectivePageHeight, width: windowWidth }
    : { flex: 1 };

  useEffect(() => {
    const index = tabToIndex(activeTab);
    if (index >= 0 && pagerRef.current?.setPage) {
      pagerRef.current.setPage(index);
    }
    if (isIOS && iosScrollRef.current != null && typeof index === 'number') {
      iosScrollRef.current.scrollTo({ x: index * windowWidth, animated: true });
    }
  }, [activeTab]);

  const handlePageSelected = (e) => {
    const index = e.nativeEvent.position;
    if (TABS[index]) setActiveTab(TABS[index]);
  };

  const goToTab = (tab) => setActiveTab(tab);

  /** iOS only: fixed height for search header (fits both icon and expanded bar; no jump on toggle). */
  const IOS_HEADER_BAR_HEIGHT = 72;

  const renderPage = (tab) => {
    const isActive = activeTab === tab;
    const contentHeight = Platform.OS === 'ios' ? effectivePageHeight : undefined;
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
          contentHeight={contentHeight}
          contentPaddingTop={isIOS ? insets.top + IOS_HEADER_BAR_HEIGHT : undefined}
          isEmptyState={rulesEmpty}
          onRetry={retryFetchContent}
          emptyStateContentLabel="rules"
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
          contentHeight={contentHeight}
          contentPaddingTop={isIOS ? insets.top + IOS_HEADER_BAR_HEIGHT : undefined}
          isEmptyState={expansionsEmpty}
          onRetry={retryFetchContent}
          emptyStateContentLabel="expansions"
        />
      );
    }
    if (tab === 'tools') {
      return <ToolsScreen key="tools" styles={styles} contentHeight={contentHeight} contentPaddingTop={isIOS ? insets.top + IOS_HEADER_BAR_HEIGHT : undefined} />;
    }
    return (
      <AboutScreen
        key="about"
        lastFetchDate={lastFetchDate}
        styles={styles}
        contentHeight={contentHeight}
        contentPaddingTop={isIOS ? insets.top + IOS_HEADER_BAR_HEIGHT : undefined}
        isVoiceAssistantSupported={aiSupported}
        availableVoices={availableVoices}
        selectedVoiceId={selectedVoiceId}
        onVoiceSelect={previewVoice}
      />
    );
  };

  const successContent = (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      <View style={styles.mainContainer} onLayout={handleContentAreaLayout}>
        <View
          style={[
            styles.globalSearchHeader,
            (activeTab === 'tools' || activeTab === 'about' || (rulesEmpty && expansionsEmpty)) && { opacity: 0, pointerEvents: 'none' },
            isIOS && { paddingTop: insets.top + 10, minHeight: insets.top + IOS_HEADER_BAR_HEIGHT, height: insets.top + IOS_HEADER_BAR_HEIGHT },
          ]}
        >
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
        {isIOS ? (
          <ScrollView
            ref={iosScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
              if (TABS[index]) setActiveTab(TABS[index]);
            }}
            style={{ flex: 1 }}
          >
            <View style={[effectivePageStyle, { width: windowWidth }]}>{renderPage('rules')}</View>
            <View style={[effectivePageStyle, { width: windowWidth }]}>{renderPage('expansions')}</View>
            <View style={[effectivePageStyle, { width: windowWidth }]}>{renderPage('tools')}</View>
            <View style={[effectivePageStyle, { width: windowWidth }]}>{renderPage('about')}</View>
          </ScrollView>
        ) : (
        <PagerView
          ref={pagerRef}
          style={Platform.OS === 'ios' ? { flex: 1, height: effectivePageHeight } : { flex: 1 }}
          initialPage={tabToIndex(activeTab)}
          onPageSelected={handlePageSelected}
        >
          <View key="0" style={effectivePageStyle} collapsable={false}>
            {renderPage('rules')}
          </View>
          <View key="1" style={effectivePageStyle} collapsable={false}>
            {renderPage('expansions')}
          </View>
          <View key="2" style={effectivePageStyle} collapsable={false}>
            {renderPage('tools')}
          </View>
          <View key="3" style={effectivePageStyle} collapsable={false}>
            {renderPage('about')}
          </View>
        </PagerView>
        )}
      </View>
      <View style={[styles.tabBar, { height: 68 + tabBarBottomInset, paddingBottom: tabBarBottomInset }]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'rules' && styles.activeTabButton]}
          onPress={() => goToTab('rules')}
        >
          <View style={[styles.tabButtonInner, activeTab === 'rules' && styles.activeTabButtonInner]}>
            <View style={[styles.tabIconContainer, activeTab === 'rules' && styles.activeTabIconContainer]}>
              <RulesIcon width={32} height={32} color={activeTab === 'rules' ? '#121212' : '#E1E1E1'} fill={activeTab === 'rules' ? '#121212' : '#E1E1E1'} style={styles.tabIcon} />
            </View>
            <Text style={[styles.tabButtonText, activeTab === 'rules' && styles.activeTabButtonText]}>Rules</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'expansions' && styles.activeTabButton]}
          onPress={() => goToTab('expansions')}
        >
          <View style={[styles.tabButtonInner, activeTab === 'expansions' && styles.activeTabButtonInner]}>
            <View style={[styles.tabIconContainer, activeTab === 'expansions' && styles.activeTabIconContainer]}>
              <ExpansionsIcon width={32} height={32} color={activeTab === 'expansions' ? '#121212' : '#E1E1E1'} fill={activeTab === 'expansions' ? '#121212' : '#E1E1E1'} style={styles.tabIcon} />
            </View>
            <Text style={[styles.tabButtonText, activeTab === 'expansions' && styles.activeTabButtonText]}>Expansions</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'tools' && styles.activeTabButton]}
          onPress={() => goToTab('tools')}
        >
          <View style={[styles.tabButtonInner, activeTab === 'tools' && styles.activeTabButtonInner]}>
            <View style={[styles.tabIconContainer, activeTab === 'tools' && styles.activeTabIconContainer]}>
              <ToolsIcon width={32} height={32} color={activeTab === 'tools' ? '#121212' : '#E1E1E1'} fill={activeTab === 'tools' ? '#121212' : '#E1E1E1'} style={styles.tabIcon} />
            </View>
            <Text style={[styles.tabButtonText, activeTab === 'tools' && styles.activeTabButtonText]}>Tools</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'about' && styles.activeTabButton]}
          onPress={() => goToTab('about')}
        >
          <View style={[styles.tabButtonInner, activeTab === 'about' && styles.activeTabButtonInner]}>
            <View style={[styles.tabIconContainer, activeTab === 'about' && styles.activeTabIconContainer]}>
              <AboutIcon width={32} height={32} color={activeTab === 'about' ? '#121212' : '#E1E1E1'} fill={activeTab === 'about' ? '#121212' : '#E1E1E1'} style={styles.tabIcon} />
            </View>
            <Text style={[styles.tabButtonText, activeTab === 'about' && styles.activeTabButtonText]}>About</Text>
          </View>
        </TouchableOpacity>
      </View>
    </>
  );

  const mainContent = isIOS ? (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: 'transparent' }]}
      edges={['left', 'right', 'bottom']}
    >
      {successContent}
    </SafeAreaView>
  ) : (
    <View style={[styles.safeArea, { backgroundColor: 'transparent' }]}>
      {successContent}
    </View>
  );

  return (
    <View style={{ flex: 1, width: windowWidth, height: windowHeight, backgroundColor: '#121212' }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={isIOS ? 'transparent' : '#121212'}
        translucent={isIOS || undefined}
      />
      <Animated.View style={{ flex: 1, opacity: mainAppOpacity }}>
        <View style={{ flex: 1 }}>
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
          {mainContent}
        </View>
      </Animated.View>
      {/* Voice Assistant FAB — only when Gemini Nano supported, splash gone, and on content tabs */}
      {aiSupported && splashDismissed && (
        <View
          pointerEvents={(activeTab === 'rules' || activeTab === 'expansions') ? 'box-none' : 'none'}
          style={[
            {
              position: 'absolute',
              right: 20,
              bottom: TAB_BAR_HEIGHT + tabBarBottomInset + 16,
              zIndex: 10,
            },
            (activeTab !== 'rules' && activeTab !== 'expansions') && { opacity: 0 },
          ]}
        >
          <VoiceAssistantFAB
            isListening={isListening}
            isThinking={isThinking}
            isActive={aiActive}
            onPress={() => askTheRules([content, expansionsContent].filter(Boolean).join('\n\n'))}
            onStop={stopAssistant}
          />
        </View>
      )}

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
