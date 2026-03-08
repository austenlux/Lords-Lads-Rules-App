import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Image,
  ImageBackground,
  Dimensions,
  Animated,
  Platform,
  ScrollView,
  Linking,
  StyleSheet,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import RulesIcon from './assets/icons/rules.svg';
import ExpansionsIcon from './assets/icons/expansions.svg';
import ToolsIcon from './assets/icons/tools.svg';
import AboutIcon from './assets/icons/about.svg';
import SearchIcon from './assets/icons/search.svg';
import { styles, markdownStyles } from './src/styles';
import { useContent } from './src/hooks/useContent';
import { useGameAssistant } from './src/hooks/useGameAssistant';
import { ContentScreen, MoreScreen, ToolsScreen } from './src/screens';
import { VoiceAssistantFAB, VoiceAssistantModal } from './src/components';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';

const SPLASH_MIN_MS = 1000;
const SPLASH_FADE_MS = 400;
const LOGO_SIZE_RATIO = 0.9;
/** Slightly smaller than splash so the background logo never appears larger and avoids shift. */
const BG_LOGO_SIZE_SCALE = 0.99;

const TABS = ['rules', 'expansions', 'tools', 'more'];
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
  const [isConvoOpen, setIsConvoOpen] = useState(false);
  const [showMicDialog, setShowMicDialog] = useState(false);
  const prevIsThinkingRef = useRef(false);
  const convoContextRef = useRef({ rules: '', expansions: '' });
  const askTheRulesRef = useRef(null);
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
    partialSpeech,
    askTheRules,
    stopAssistant,
    availableVoices,
    selectedVoiceId,
    previewVoice,
    messages,
    modelStatus,
    micPermissionStatus,
    downloadProgressBytes,
    retryModelSetup,
    isRetryingModelSetup,
    retryModelSetupError,
    modelDebugInfo,
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
    expansionsRateLimited,
    retryFetchContent,
    rulesScrollViewRef,
    expansionsScrollViewRef,
    saveScrollY,
    searchInputRef,
    handleSearchQueryChange,
    toggleSearchBar,
    renderSection,
  } = useContent(styles, markdownStyles);

  // Keep the latest content in a ref so the auto-continue effect can read it
  // without needing content/expansionsContent as effect dependencies.
  useEffect(() => {
    convoContextRef.current = { rules: content, expansions: expansionsContent };
  }, [content, expansionsContent]);

  // Keep askTheRulesRef current so the auto-continue timeout always calls
  // the latest version regardless of when the 600ms delay resolves.
  useEffect(() => {
    askTheRulesRef.current = askTheRules;
  }, [askTheRules]);

  // Auto-start the next listening turn after the assistant finishes speaking.
  // Triggers only when isThinking transitions true→false while the convo is open.
  useEffect(() => {
    const wasThinking = prevIsThinkingRef.current;
    prevIsThinkingRef.current = isThinking;
    if (wasThinking && !isThinking && isConvoOpen && !isListening) {
      const timer = setTimeout(() => {
        askTheRulesRef.current?.(
          convoContextRef.current.rules,
          convoContextRef.current.expansions,
        );
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isThinking, isConvoOpen, isListening]);

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
          rateLimited={expansionsRateLimited}
          onRetry={retryFetchContent}
          emptyStateContentLabel="expansions"
        />
      );
    }
    if (tab === 'tools') {
      return <ToolsScreen key="tools" styles={styles} contentHeight={contentHeight} contentPaddingTop={isIOS ? insets.top + IOS_HEADER_BAR_HEIGHT : undefined} />;
    }
    return (
      <MoreScreen
        key="more"
        lastFetchDate={lastFetchDate}
        styles={styles}
        contentHeight={contentHeight}
        contentPaddingTop={isIOS ? insets.top + IOS_HEADER_BAR_HEIGHT : undefined}
        isVoiceAssistantSupported={aiSupported}
        availableVoices={availableVoices}
        selectedVoiceId={selectedVoiceId}
        onVoiceSelect={previewVoice}
        modelStatus={modelStatus}
        micPermissionStatus={micPermissionStatus}
        downloadProgressBytes={downloadProgressBytes}
        onRetryModelSetup={retryModelSetup}
        isRetryingModelSetup={isRetryingModelSetup}
        retryModelSetupError={retryModelSetupError}
        modelDebugInfo={modelDebugInfo}
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
            (activeTab === 'tools' || activeTab === 'more' || (rulesEmpty && expansionsEmpty)) && { opacity: 0, pointerEvents: 'none' },
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
            style={{ flex: 1, backgroundColor: 'transparent' }}
          >
            <View style={[effectivePageStyle, { width: windowWidth, backgroundColor: 'transparent' }]}>{renderPage('rules')}</View>
            <View style={[effectivePageStyle, { width: windowWidth, backgroundColor: 'transparent' }]}>{renderPage('expansions')}</View>
            <View style={[effectivePageStyle, { width: windowWidth, backgroundColor: 'transparent' }]}>{renderPage('tools')}</View>
            <View style={[effectivePageStyle, { width: windowWidth, backgroundColor: 'transparent' }]}>{renderPage('more')}</View>
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
            {renderPage('more')}
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
          style={[styles.tabButton, activeTab === 'more' && styles.activeTabButton]}
          onPress={() => goToTab('more')}
        >
          <View style={[styles.tabButtonInner, activeTab === 'more' && styles.activeTabButtonInner]}>
            <View style={[styles.tabIconContainer, activeTab === 'more' && styles.activeTabIconContainer]}>
              <AboutIcon width={32} height={32} color={activeTab === 'more' ? '#121212' : '#E1E1E1'} fill={activeTab === 'more' ? '#121212' : '#E1E1E1'} style={styles.tabIcon} />
            </View>
            <Text style={[styles.tabButtonText, activeTab === 'more' && styles.activeTabButtonText]}>More</Text>
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
    <View style={{ flex: 1, width: windowWidth, height: windowHeight }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={isIOS ? 'transparent' : '#121212'}
        translucent={isIOS || undefined}
      />
      {/* Background: on iOS use ImageBackground so the logo actually renders (absolute Image often doesn't on iOS). */}
      {isIOS ? (
        <View style={{ flex: 1 }}>
          <ImageBackground
            source={require('./assets/logo_dark.png')}
            style={{ flex: 1 }}
            resizeMode="contain"
            imageStyle={{
              position: 'absolute',
              left: logoLayout.bgLogoLeft,
              top: logoLayout.bgLogoTop,
              width: logoLayout.bgLogoSize,
              height: logoLayout.bgLogoSize,
            }}
          >
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
            {/* TEMP A1 debug: empty view to test if ImageBackground renders when content is absent */}
            <View style={{ flex: 1 }} />
          </ImageBackground>
        </View>
      ) : (
        <>
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { width: logoLayout.width, height: logoLayout.height },
            ]}
            pointerEvents="none"
          >
            <Image
              source={require('./assets/logo_dark_greyscale.png')}
              style={{
                position: 'absolute',
                left: logoLayout.bgLogoLeft,
                top: logoLayout.bgLogoTop,
                width: logoLayout.bgLogoSize,
                height: logoLayout.bgLogoSize,
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
          </View>
          <Animated.View style={{ flex: 1, opacity: mainAppOpacity, backgroundColor: 'transparent' }}>
            <View style={{ flex: 1, backgroundColor: 'transparent' }}>{mainContent}</View>
          </Animated.View>
        </>
      )}
      {/* Voice Assistant — FAB + conversation modal.
          Shown once the splash is dismissed and Gemini Nano is confirmed available. */}
      {aiSupported && splashDismissed && (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
            zIndex: 10,
          }}
        >
          {/* Conversation modal — floats above the FAB */}
          <VoiceAssistantModal
            messages={messages}
            isOpen={isConvoOpen}
            fabBottom={TAB_BAR_HEIGHT + tabBarBottomInset + 16}
          />

          {/* FAB — anchored bottom-right */}
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              right: 20,
              bottom: TAB_BAR_HEIGHT + tabBarBottomInset + 16,
            }}
          >
            <VoiceAssistantFAB
              isListening={isListening}
              isThinking={isThinking}
              isActive={aiActive}
              hasConversation={isConvoOpen}
              onPress={() => {
                if (micPermissionStatus !== 'granted') {
                  setShowMicDialog(true);
                  return;
                }
                setIsConvoOpen(true);
                askTheRules(content, expansionsContent);
              }}
              onStop={() => {
                setIsConvoOpen(false);
                stopAssistant();
              }}
            />
          </View>
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

      {showMicDialog && (
        <View style={micDialogStyles.overlay}>
          <View style={micDialogStyles.backdrop}>
            <View style={micDialogStyles.card}>
              <Text style={micDialogStyles.title}>Microphone Access Required</Text>
              <Text style={micDialogStyles.body}>
                The Voice Assistant needs microphone access to hear your questions.
                Please enable it in your device settings.
              </Text>
              <TouchableOpacity
                style={micDialogStyles.settingsButton}
                onPress={() => { setShowMicDialog(false); Linking.openSettings(); }}
              >
                <Text style={micDialogStyles.settingsButtonText}>Open Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={micDialogStyles.dismissButton}
                onPress={() => setShowMicDialog(false)}
              >
                <Text style={micDialogStyles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const micDialogStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(187,134,252,0.25)',
  },
  title: {
    color: '#BB86FC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    color: '#E0E0E0',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  settingsButton: {
    backgroundColor: '#BB86FC',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  settingsButtonText: {
    color: '#121212',
    fontSize: 15,
    fontWeight: '700',
  },
  dismissButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#888888',
    fontSize: 14,
  },
});
