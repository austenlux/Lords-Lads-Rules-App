import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Linking,
  NativeModules,
  StyleSheet,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import RulesIcon from './assets/icons/rules.svg';
import ExpansionsIcon from './assets/icons/expansions.svg';
import ToolsIcon from './assets/icons/tools.svg';
import AboutIcon from './assets/icons/about.svg';
import SearchIcon from './assets/icons/search.svg';
import { createStyles, createMarkdownStyles } from './src/styles';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { useContent } from './src/hooks/useContent';
import { useGameAssistant } from './src/hooks/useGameAssistant';
import { ContentScreen, MoreScreen, ToolsScreen } from './src/screens';
import { VoiceAssistantFAB, VoiceAssistantModal } from './src/components';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { buildIndex } from './src/services/ragService';
import { initContentFlags } from './src/services/contentService';

const SPLASH_MIN_MS = 1000;
const SPLASH_FADE_MS = 400;
const LOGO_SIZE_RATIO = 0.9;
/** iOS: asset catalog image (Metro require doesn't work in iOS release builds).
    Android: Metro-bundled greyscale logo. */
const BG_LOGO_IOS = { uri: 'BgLogo' };
const BG_LOGO_ANDROID = require('./assets/logo_dark_greyscale.png');

const TAB_CONFIG = {
  rules: { Icon: RulesIcon, label: 'Rules' },
  expansions: { Icon: ExpansionsIcon, label: 'Expansions' },
  tools: { Icon: ToolsIcon, label: 'Tools' },
  more: { Icon: AboutIcon, label: 'More' },
};

/** Tab bar height; used for explicit PagerView height on iOS to fix child layout. */
const TAB_BAR_HEIGHT = 68;
/** Cap bottom inset so we don't reserve more than needed for the OS gesture bar (avoids excessive gap). */
const TAB_BAR_BOTTOM_INSET_MAX = 20;

function computeLogoLayout({ width, height }) {
  // Android: match the native splashscreen.xml logo size exactly (320dp) so there
  // is no visible size change when the RN overlay takes over from the window background.
  // iOS: ratio-based sizing (the native splash is handled by AppDelegate, not XML).
  const logoSize = Platform.OS === 'android' ? 320 : Math.min(width, height) * LOGO_SIZE_RATIO;
  return { width, height, logoSize, logoLeft: (width - logoSize) / 2, logoTop: (height - logoSize) / 2 };
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { accent, accentGlow, titleFontStyle, bodyFontStyle } = useTheme();
  const styles = useMemo(() => createStyles(accent, accentGlow), [accent, accentGlow]);
  const markdownStyles = useMemo(() => createMarkdownStyles(accent, titleFontStyle, bodyFontStyle), [accent, titleFontStyle, bodyFontStyle]);

  const [isConvoOpen, setIsConvoOpen] = useState(false);
  const [showMicDialog, setShowMicDialog] = useState(false);
  const prevIsThinkingRef = useRef(false);
  const askTheRulesRef = useRef(null);
  const isIOS = Platform.OS === 'ios';
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const mainAppOpacity = useRef(new Animated.Value(0)).current;
  const fadeOutStarted = useRef(false);
  const splashDismissedRef = useRef(false);
  const pagerRef = useRef(null);
  const iosScrollRef = useRef(null);
  const insets = useSafeAreaInsets();
  const tabBarBottomInset = Math.min(insets.bottom, TAB_BAR_BOTTOM_INSET_MAX);

  const [dims, setDims] = useState(() => Dimensions.get('window'));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setDims(window));
    return () => sub.remove();
  }, []);
  const logoLayout = useMemo(() => computeLogoLayout(dims), [dims]);
  const windowWidth = dims.width;
  const pageHeight = dims.height - TAB_BAR_HEIGHT;

  useEffect(() => {
    const t = setTimeout(() => {
      if (isIOS) {
        NativeModules.NativeSplashScreen?.dismiss();
      }
      if (!fadeOutStarted.current) {
        fadeOutStarted.current = true;
        Animated.parallel([
          Animated.timing(splashOpacity, { toValue: 0, duration: SPLASH_FADE_MS, useNativeDriver: true }),
          Animated.timing(mainAppOpacity, { toValue: 1, duration: SPLASH_FADE_MS, useNativeDriver: true }),
        ]).start(() => { splashDismissedRef.current = true; });
      }
    }, SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    initContentFlags().catch(() => {});
  }, []);

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
    requestMicPermission,
    speechPermissionStatus,
    speechPermissionError,
    clearSpeechPermissionError,
    retryModelSetup,
    modelDebugInfo,
    cloudLlmStatus,
    geminiUsageStats,
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
    rulesLastSynced,
    expansionsLastSynced,
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

  const tabs = useMemo(() => ['rules', 'expansions', 'tools', 'more'], []);
  const tabToIndex = useCallback((tab) => tabs.indexOf(tab), [tabs]);

  // ── RAG index ───────────────────────────────────────────────────────────
  const [ragIndexReady, setRagIndexReady] = useState(false);
  const [ragChunkCount, setRagChunkCount] = useState(0);
  const ragIndexRef = useRef(null);

  useEffect(() => {
    if (!content && !expansionsContent) return;
    const index = buildIndex(content || '', expansionsContent || '');
    index.rawRules = content || '';
    index.rawExpansions = expansionsContent || '';
    ragIndexRef.current = index;
    setRagChunkCount(index.totalChunks);
    setRagIndexReady(index.totalChunks > 0);
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
        askTheRulesRef.current?.(ragIndexRef.current);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isThinking, isConvoOpen, isListening]);


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
    if (isIOS && iosScrollRef.current != null && typeof index === 'number' && index >= 0) {
      iosScrollRef.current.scrollTo({ x: index * windowWidth, animated: true });
    }
  }, [activeTab, tabs, tabToIndex]);

  const handlePageSelected = (e) => {
    const index = e.nativeEvent.position;
    if (tabs[index]) setActiveTab(tabs[index]);
  };

  const goToTab = (tab) => setActiveTab(tab);

  /** iOS only: fixed height for search header (fits both icon and expanded bar; no jump on toggle). */
  const IOS_HEADER_BAR_HEIGHT = 72;

  const renderPage = (tab) => {
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
          isLoading={loading}
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
          isLoading={loading}
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
        rulesLastSynced={rulesLastSynced}
        expansionsLastSynced={expansionsLastSynced}
        styles={styles}
        contentHeight={contentHeight}
        contentPaddingTop={isIOS ? insets.top + IOS_HEADER_BAR_HEIGHT : undefined}
        isVoiceAssistantSupported={aiSupported}
        availableVoices={availableVoices}
        selectedVoiceId={selectedVoiceId}
        onVoiceSelect={previewVoice}
        modelStatus={modelStatus}
        micPermissionStatus={micPermissionStatus}
        speechPermissionStatus={speechPermissionStatus}
        onRetryModelSetup={retryModelSetup}
        modelDebugInfo={modelDebugInfo}
        ragIndexReady={ragIndexReady}
        ragChunkCount={ragChunkCount}
        cloudLlmStatus={cloudLlmStatus}
        geminiUsageStats={geminiUsageStats}
        onRefreshContent={retryFetchContent}
      />
    );
  };

  const successContent = (
    <>
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
                style={[styles.searchInput, bodyFontStyle]}
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
              if (tabs[index]) setActiveTab(tabs[index]);
            }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
          >
            {tabs.map((tab) => (
              <View key={tab} style={[effectivePageStyle, { width: windowWidth, backgroundColor: 'transparent' }]}>
                {renderPage(tab)}
              </View>
            ))}
          </ScrollView>
        ) : (
        <PagerView
          ref={pagerRef}
          style={Platform.OS === 'ios' ? { flex: 1, height: effectivePageHeight } : { flex: 1 }}
          initialPage={tabToIndex(activeTab)}
          onPageSelected={handlePageSelected}
        >
          {tabs.map((tab) => (
            <View key={tab} style={effectivePageStyle} collapsable={false}>
              {renderPage(tab)}
            </View>
          ))}
        </PagerView>
        )}
      </View>
      <View style={[styles.tabBar, { height: 68 + tabBarBottomInset, paddingBottom: tabBarBottomInset }]}>
        {tabs.map((tab) => {
          const { Icon, label } = TAB_CONFIG[tab];
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, isActive && styles.activeTabButton]}
              onPress={() => goToTab(tab)}
            >
              <View style={[styles.tabButtonInner, isActive && styles.activeTabButtonInner]}>
                <View style={[styles.tabIconContainer, isActive && styles.activeTabIconContainer]}>
                  <Icon width={32} height={32} color={isActive ? '#121212' : '#E1E1E1'} fill={isActive ? '#121212' : '#E1E1E1'} style={styles.tabIcon} />
                </View>
                <Text style={[styles.tabButtonText, bodyFontStyle, isActive && styles.activeTabButtonText]}>{label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
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
    <View style={{ flex: 1, backgroundColor: isIOS ? 'transparent' : '#121212' }}>
      {!isIOS && (
        <>
          <Image
            source={BG_LOGO_ANDROID}
            style={{
              position: 'absolute',
              width: logoLayout.logoSize,
              height: logoLayout.logoSize,
              left: logoLayout.logoLeft,
              top: logoLayout.logoTop,
            }}
            resizeMode="contain"
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(18, 18, 18, 0.7)' }]} pointerEvents="none" />
        </>
      )}
      <StatusBar
        barStyle="light-content"
        backgroundColor={isIOS ? 'transparent' : '#121212'}
        translucent={isIOS || undefined}
      />
      <Animated.View style={{ flex: 1, opacity: mainAppOpacity }}>
        {mainContent}
      </Animated.View>

      {aiSupported && ragIndexReady && (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, zIndex: 10 }}
        >
          <VoiceAssistantModal
            messages={messages}
            isOpen={isConvoOpen}
            fabBottom={TAB_BAR_HEIGHT + tabBarBottomInset + 16}
          />
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', right: 20, bottom: TAB_BAR_HEIGHT + tabBarBottomInset + 16 }}
          >
            <VoiceAssistantFAB
              isListening={isListening}
              isThinking={isThinking}
              isActive={aiActive}
              hasConversation={isConvoOpen}
              onPress={async () => {
                if (micPermissionStatus === 'granted') {
                  setIsConvoOpen(true);
                  askTheRules(ragIndexRef.current);
                  return;
                }
                const result = await requestMicPermission();
                if (result === 'granted') {
                  setIsConvoOpen(true);
                  askTheRules(ragIndexRef.current);
                } else {
                  setShowMicDialog(true);
                }
              }}
              onStop={() => {
                setIsConvoOpen(false);
                stopAssistant();
              }}
            />
          </View>
        </View>
      )}

      {!isIOS && (
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            zIndex: 100,
            backgroundColor: '#121212',
            opacity: splashOpacity,
          }}
          pointerEvents="none"
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

      {(showMicDialog || speechPermissionError) && (
        <View style={micDialogStyles.overlay}>
          <View style={micDialogStyles.backdrop}>
            <View style={[micDialogStyles.card, { borderColor: `${accent}40` }]}>
              <Text style={[micDialogStyles.title, { color: accent }, titleFontStyle]}>
                {speechPermissionError ? 'Speech Recognition Required' : 'Microphone Access Required'}
              </Text>
              <Text style={[micDialogStyles.body, bodyFontStyle]}>
                {speechPermissionError?.code === 'siri_disabled'
                  ? 'Siri & Dictation must be enabled for on-device speech recognition.\n\nGo to Settings → Apple Intelligence & Siri and enable Siri. Then check Settings → General → Keyboard and enable Dictation.'
                  : speechPermissionError
                    ? speechPermissionError.message
                    : 'Microphone permission was previously denied. You\'ll need to enable it manually in your device settings.'}
              </Text>
              <TouchableOpacity
                style={[micDialogStyles.settingsButton, { backgroundColor: accent }]}
                onPress={() => {
                  setShowMicDialog(false);
                  clearSpeechPermissionError();
                  setIsConvoOpen(false);
                  Linking.openURL('App-prefs:General&path=Keyboard').catch(() => Linking.openSettings());
                }}
              >
                <Text style={[micDialogStyles.settingsButtonText, bodyFontStyle]}>
                  {speechPermissionError?.code === 'siri_disabled' ? 'Open Siri Settings' : 'Open Settings'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={micDialogStyles.dismissButton}
                onPress={() => { setShowMicDialog(false); clearSpeechPermissionError(); setIsConvoOpen(false); }}
              >
                <Text style={[micDialogStyles.dismissButtonText, bodyFontStyle]}>Dismiss</Text>
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
    borderColor: 'rgba(255,255,255,0.15)',
  },
  title: {
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
