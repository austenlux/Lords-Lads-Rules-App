/**
 * More screen: last sync date, support (Venmo), changelog from release_notes.md.
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Animated,
  LayoutAnimation,
  UIManager,
  Linking,
  Image,
  Switch,
  Platform,
  Dimensions,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { HEADER_HEIGHT } from '../styles';
import NativeVoiceAssistantOptional from '../specs/NativeVoiceAssistantOptional';
import {
  BUILD_COMMIT,
  BUILD_COMMIT_FULL,
  BUILD_COMMIT_MESSAGE,
  BUILD_VERSION_NAME,
  BUILD_VERSION_CODE,
  BUILD_TIMESTAMP,
} from '../buildInfo';

const SETTINGS_KEYS = {
  EXPAND_RULES_DEFAULT: '@lnl_expand_rules_default',
  EXPAND_EXPANSIONS_DEFAULT: '@lnl_expand_expansions_default',
  THINKING_SOUNDS_ENABLED: '@lnl_thinking_sounds_enabled',
  THEME: '@lnl_theme',
};
import { getVenmoPayUrl, ACCENT_COLOR } from '../constants';
import CollapsibleSection, { DEFAULT_SECTION_EXPANDED } from '../components/CollapsibleSection';
import SyncedIcon from '../../assets/icons/synced.svg';
import VenmoIcon from '../../assets/icons/venmo.svg';
import ChangelogIcon from '../../assets/icons/changelog.svg';
import SettingsIcon from '../../assets/icons/settings.svg';
import InfoIcon from '../../assets/icons/info.svg';
import RulesIcon from '../../assets/icons/rules.svg';
import ExpansionsIcon from '../../assets/icons/expansions.svg';
import DebugIcon from '../../assets/icons/debug.svg';
import MicIcon from '../../assets/icons/mic.svg';
import DeviceIcon from '../../assets/icons/device.svg';
import FlagIcon from '../../assets/icons/flag.svg';
import GithubIcon from '../../assets/icons/github.svg';
import ShipIcon from '../../assets/icons/ship.svg';
import CalendarIcon from '../../assets/icons/calendar.svg';
import ExpandIcon from '../../assets/icons/expand.svg';
import PaintIcon from '../../assets/icons/paint.svg';
import SplatIcon from '../../assets/icons/splat.svg';
import Font1Icon from '../../assets/icons/font1.svg';
import Font2Icon from '../../assets/icons/font2.svg';
import SpeakerIcon from '../../assets/icons/speaker.svg';
import CheckIcon from '../../assets/icons/check.svg';
import CloseIcon from '../../assets/icons/close.svg';

const CardIconTitle = ({ icon, title, styles, titleColor }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    {React.cloneElement(icon, { width: 20, height: 20 })}
    <Text style={[styles.versionText, titleColor && { color: titleColor }]}>{title}</Text>
  </View>
);

const THEME_OPTIONS = [
  { id: 'purple', label: 'Purple', color: ACCENT_COLOR },
  { id: 'blue',   label: 'Blue',   color: '#64B5F6' },
  { id: 'green',  label: 'Green',  color: '#66BB6A' },
  { id: 'red',    label: 'Red',    color: '#EF5350' },
  { id: 'orange', label: 'Orange', color: '#FFA726' },
  { id: 'brown',  label: 'Brown',  color: '#A1887F' },
  { id: 'teal',   label: 'Teal',   color: '#4DB6AC' },
  { id: 'pink',   label: 'Pink',   color: '#F48FB1' },
];
const DEFAULT_THEME = 'purple';

const PAST_RELEASES_KEY = 'pastReleases';
const SECTION_KEYS = { BUY_NAILS: 'buyNails', CHANGELOG: 'changelog', SETTINGS: 'settings', INFO: 'info', DEBUG: 'debug' };

const VA_STATUS_LABEL = {
  deviceSupport: {
    unknown:         '—',
    unavailable:     'Not Supported',
    supported:       'Supported',
  },
  modelDownload: {
    unknown:         'Checking…',
    available:       'Ready',
    downloadable:    'Pending Download',
    downloading:     'Downloading…',
    unavailable:     'N/A',
    download_failed: 'Download Failed',
  },
  mic: {
    unknown:       'Checking…',
    undetermined:  'Not determined',
    granted:       'Granted',
    not_granted:   'Not Granted',
  },
};

const VA_STATUS_COLOR = {
  deviceSupport: {
    unknown:     '#888888',
    unavailable: '#CF6679',
    supported:   '#4CAF50',
  },
  modelDownload: {
    unknown:         '#888888',
    available:       '#4CAF50',
    downloadable:    '#FF9800',
    downloading:     ACCENT_COLOR,
    unavailable:     '#888888',
    download_failed: '#CF6679',
  },
  mic: {
    unknown:      '#888888',
    undetermined: '#FF9800',
    granted:      '#4CAF50',
    not_granted:  '#CF6679',
  },
};

import { StyleSheet as RNStyleSheet } from 'react-native';
const vaReadinessStyles = RNStyleSheet.create({
  actionButton: {
    backgroundColor: 'rgba(187,134,252,0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(187,134,252,0.4)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: ACCENT_COLOR,
    fontSize: 13,
    fontWeight: '600',
  },
});

const RULEBOOK_REPO_URL = 'https://github.com/seanKenkeremath/lords-and-lads';
const APP_REPO_URL = 'https://github.com/austenlux/Lords-Lads-Rules-App';

const VENMO_OPTIONS = [
  { amount: 1, label: '$1', image: require('../../assets/icons/nail1.png') },
  { amount: 5, label: '$5', image: require('../../assets/icons/nail2.png') },
  { amount: 20, label: '$20', image: require('../../assets/icons/nail3.png') },
  { amount: 50, label: '$50', image: require('../../assets/icons/nail4.png') },
  { amount: 100, label: '$100', image: require('../../assets/icons/nail5.png') },
  { amount: 250, label: '$250', image: require('../../assets/icons/nail6.png') },
];

export default function MoreScreen({
  lastFetchDate,
  styles,
  contentHeight,
  contentPaddingTop,
  isVoiceAssistantSupported = false,
  availableVoices = [],
  selectedVoiceId = null,
  onVoiceSelect,
  modelStatus = 'unknown',
  micPermissionStatus = 'unknown',
  downloadProgressBytes = 0,
  onRetryModelSetup,
  isRetryingModelSetup = false,
  retryModelSetupError = null,
  modelDebugInfo = null,
}) {
  const [releaseNotes, setReleaseNotes] = useState([]);
  const [expandedVersions, setExpandedVersions] = useState({});
  const [pastReleasesExpanded, setPastReleasesExpanded] = useState(false);
  const [sectionsExpanded, setSectionsExpanded] = useState({
    [SECTION_KEYS.BUY_NAILS]: false,
    [SECTION_KEYS.CHANGELOG]: false,
    [SECTION_KEYS.SETTINGS]: false,
    [SECTION_KEYS.INFO]: false,
    [SECTION_KEYS.DEBUG]: false,
  });
  const [debugVisible, setDebugVisible] = useState(false);
  const [expandRulesDefault, setExpandRulesDefault] = useState(false);
  const [expandExpansionsDefault, setExpandExpansionsDefault] = useState(false);
  const animations = useRef({}).current;
  const voiceLocaleAnims = useRef({}).current;
  const debugVoiceAnims = useRef({}).current;
  const [expandedLocales, setExpandedLocales] = useState({});
  const [expandDefaultsExpanded, setExpandDefaultsExpanded] = useState(false);
  const [thinkingSoundsEnabled, setThinkingSoundsEnabled] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(DEFAULT_THEME);
  const [themeExpanded, setThemeExpanded] = useState(false);
  const [themeColorExpanded, setThemeColorExpanded] = useState(false);
  const [themeFontPrimaryExpanded, setThemeFontPrimaryExpanded] = useState(false);
  const [themeFontSecondaryExpanded, setThemeFontSecondaryExpanded] = useState(false);
  const [featureFlagsExpanded, setFeatureFlagsExpanded] = useState(false);
  const [voiceParentExpanded, setVoiceParentExpanded] = useState(false);
  const [voiceMetaExpanded, setVoiceMetaExpanded] = useState(false);
  const [expandedDebugVoices, setExpandedDebugVoices] = useState({});
  const [vaDebugExpanded, setVaDebugExpanded] = useState(false);
  const [buildInfoExpanded, setBuildInfoExpanded] = useState(false);
  const [commitMsgExpanded, setCommitMsgExpanded] = useState(false);

  // Initialise rotation animations for settings cards and debug sections.
  useEffect(() => {
    if (!animations['expandDefaults']) animations['expandDefaults'] = { rotation: new Animated.Value(0) };
    if (!animations['voiceParent'])    animations['voiceParent']    = { rotation: new Animated.Value(0) };
    if (!animations['voiceMeta'])      animations['voiceMeta']      = { rotation: new Animated.Value(0) };
    if (!animations['theme'])              animations['theme']              = { rotation: new Animated.Value(0) };
    if (!animations['themeColor'])         animations['themeColor']         = { rotation: new Animated.Value(0) };
    if (!animations['themeFontPrimary'])   animations['themeFontPrimary']   = { rotation: new Animated.Value(0) };
    if (!animations['themeFontSecondary']) animations['themeFontSecondary'] = { rotation: new Animated.Value(0) };
    if (!animations['featureFlags'])   animations['featureFlags']   = { rotation: new Animated.Value(0) };
    if (!animations['vaDebug'])        animations['vaDebug']        = { rotation: new Animated.Value(0) };
    if (!animations['buildInfo'])      animations['buildInfo']      = { rotation: new Animated.Value(0) };
  }, []);

  useEffect(() => {
    const load = async () => {
      const [rules, expansions, thinkingSounds, theme] = await Promise.all([
        AsyncStorage.getItem(SETTINGS_KEYS.EXPAND_RULES_DEFAULT),
        AsyncStorage.getItem(SETTINGS_KEYS.EXPAND_EXPANSIONS_DEFAULT),
        AsyncStorage.getItem(SETTINGS_KEYS.THINKING_SOUNDS_ENABLED),
        AsyncStorage.getItem(SETTINGS_KEYS.THEME),
      ]);
      setExpandRulesDefault(rules === 'true');
      setExpandExpansionsDefault(expansions === 'true');
      const soundsOn = thinkingSounds === 'true';
      setThinkingSoundsEnabled(soundsOn);
      NativeVoiceAssistantOptional?.setThinkingSoundEnabled(soundsOn);
      if (theme && THEME_OPTIONS.some(t => t.id === theme)) setSelectedTheme(theme);
    };
    load();
  }, []);

  const setExpandRulesDefaultAndSave = async (value) => {
    setExpandRulesDefault(value);
    await AsyncStorage.setItem(SETTINGS_KEYS.EXPAND_RULES_DEFAULT, value ? 'true' : 'false');
  };

  const setExpandExpansionsDefaultAndSave = async (value) => {
    setExpandExpansionsDefault(value);
    await AsyncStorage.setItem(SETTINGS_KEYS.EXPAND_EXPANSIONS_DEFAULT, value ? 'true' : 'false');
  };

  const setThinkingSoundsEnabledAndSave = async (value) => {
    setThinkingSoundsEnabled(value);
    NativeVoiceAssistantOptional?.setThinkingSoundEnabled(value);
    await AsyncStorage.setItem(SETTINGS_KEYS.THINKING_SOUNDS_ENABLED, value ? 'true' : 'false');
  };

  // ── Voice locale section animations ─────────────────────────────────────

  useEffect(() => {
    if (!availableVoices.length) return;
    availableVoices.forEach(({ language, id }) => {
      if (!voiceLocaleAnims[language]) {
        voiceLocaleAnims[language] = { rotation: new Animated.Value(0) };
      }
      if (!debugVoiceAnims[id]) {
        debugVoiceAnims[id] = { rotation: new Animated.Value(0) };
      }
    });
    setExpandedLocales(prev => {
      const next = { ...prev };
      availableVoices.forEach(({ language }) => {
        if (!(language in next)) next[language] = false;
      });
      return next;
    });
    setExpandedDebugVoices(prev => {
      const next = { ...prev };
      availableVoices.forEach(({ id }) => {
        if (!(id in next)) next[id] = false;
      });
      return next;
    });
  }, [availableVoices]);

  // ── Animation helpers ────────────────────────────────────────────────────
  // Single helper so all collapse/expand calls are consistent.
  const animateSection = (anim, toExpanded, duration = 200) => {
    if (!anim) return;
    Animated.timing(anim.rotation, { toValue: toExpanded ? 1 : 0, duration, useNativeDriver: true }).start();
  };

  // Collapse every locale sub-section inside the Voice Assistant card.
  const collapseAllLocales = () => {
    Object.values(voiceLocaleAnims).forEach(a => animateSection(a, false, 150));
    setExpandedLocales({});
  };

  // Collapse every individual voice card inside Voice Assistant Models.
  const collapseAllDebugVoices = () => {
    Object.values(debugVoiceAnims).forEach(a => animateSection(a, false, 150));
    setExpandedDebugVoices({});
  };

  // Collapse every version block inside Past Releases.
  const collapseAllVersions = () => {
    Object.keys(expandedVersions).forEach(v => {
      if (animations[v]) animateSection(animations[v], false, 150);
    });
    setExpandedVersions({});
  };

  // Collapse everything nested inside the Settings top-level section.
  const collapseSettingsChildren = () => {
    animateSection(animations['expandDefaults'], false, 150);
    setExpandDefaultsExpanded(false);
    animateSection(animations['voiceParent'], false, 150);
    setVoiceParentExpanded(false);
    collapseAllLocales();
  };

  // Collapse everything nested inside the Changelog top-level section.
  const collapseChangelogChildren = () => {
    animateSection(animations[PAST_RELEASES_KEY], false, 150);
    setPastReleasesExpanded(false);
    collapseAllVersions();
  };

  // Collapse everything nested inside the Debug top-level section.
  const collapseDebugChildren = () => {
    animateSection(animations['voiceMeta'], false, 150);
    setVoiceMetaExpanded(false);
    collapseAllDebugVoices();
    animateSection(animations['featureFlags'], false, 150);
    setFeatureFlagsExpanded(false);
    animateSection(animations['vaDebug'], false, 150);
    setVaDebugExpanded(false);
    animateSection(animations['buildInfo'], false, 150);
    setBuildInfoExpanded(false);
  };

  // ── Toggle functions ─────────────────────────────────────────────────────

  const toggleMoreSection = (sectionKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const willCollapse = sectionsExpanded[sectionKey];
    if (willCollapse) {
      if (sectionKey === SECTION_KEYS.SETTINGS)  collapseSettingsChildren();
      if (sectionKey === SECTION_KEYS.CHANGELOG) collapseChangelogChildren();
      if (sectionKey === SECTION_KEYS.DEBUG)     collapseDebugChildren();
    }
    setSectionsExpanded(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  const toggleVoiceLocale = (localeKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !expandedLocales[localeKey];
    animateSection(voiceLocaleAnims[localeKey], isExpanded);
    setExpandedLocales(prev => ({ ...prev, [localeKey]: isExpanded }));
  };

  const toggleExpandDefaults = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !expandDefaultsExpanded;
    animateSection(animations['expandDefaults'], isExpanded);
    setExpandDefaultsExpanded(isExpanded);
  };

  const toggleTheme = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !themeExpanded;
    animateSection(animations['theme'], isExpanded);
    if (!isExpanded) {
      animateSection(animations['themeColor'], false);
      animateSection(animations['themeFontPrimary'], false);
      animateSection(animations['themeFontSecondary'], false);
      setThemeColorExpanded(false);
      setThemeFontPrimaryExpanded(false);
      setThemeFontSecondaryExpanded(false);
    }
    setThemeExpanded(isExpanded);
  };

  const toggleThemeColor = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !themeColorExpanded;
    animateSection(animations['themeColor'], isExpanded);
    setThemeColorExpanded(isExpanded);
  };

  const toggleThemeFontPrimary = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !themeFontPrimaryExpanded;
    animateSection(animations['themeFontPrimary'], isExpanded);
    setThemeFontPrimaryExpanded(isExpanded);
  };

  const toggleThemeFontSecondary = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !themeFontSecondaryExpanded;
    animateSection(animations['themeFontSecondary'], isExpanded);
    setThemeFontSecondaryExpanded(isExpanded);
  };

  const selectTheme = async (themeId) => {
    setSelectedTheme(themeId);
    await AsyncStorage.setItem(SETTINGS_KEYS.THEME, themeId);
  };

  const toggleVoiceParent = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !voiceParentExpanded;
    animateSection(animations['voiceParent'], isExpanded);
    if (!isExpanded) collapseAllLocales();
    setVoiceParentExpanded(isExpanded);
  };

  const toggleVoiceMeta = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !voiceMetaExpanded;
    animateSection(animations['voiceMeta'], isExpanded);
    if (!isExpanded) collapseAllDebugVoices();
    setVoiceMetaExpanded(isExpanded);
  };

  const toggleFeatureFlags = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !featureFlagsExpanded;
    animateSection(animations['featureFlags'], isExpanded);
    setFeatureFlagsExpanded(isExpanded);
  };

  const toggleVaDebug = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !vaDebugExpanded;
    animateSection(animations['vaDebug'], isExpanded);
    if (!isExpanded) {
      animateSection(animations['voiceMeta'], false, 150);
      setVoiceMetaExpanded(false);
      collapseAllDebugVoices();
    }
    setVaDebugExpanded(isExpanded);
  };

  const toggleBuildInfo = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !buildInfoExpanded;
    animateSection(animations['buildInfo'], isExpanded);
    setBuildInfoExpanded(isExpanded);
  };

  const toggleDebugVoice = (voiceId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !expandedDebugVoices[voiceId];
    animateSection(debugVoiceAnims[voiceId], isExpanded);
    setExpandedDebugVoices(prev => ({ ...prev, [voiceId]: isExpanded }));
  };


  const handleMoreTitleLongPress = () => {
    if (!debugVisible) setDebugVisible(true);
  };

  /** Max height for expanded section so content can wrap; avoids static height cut-off. */
  const EXPANDED_MAX_HEIGHT = 3000;
  /** Max height for the past-releases container so nested content can grow. */
  const PAST_RELEASES_MAX_HEIGHT = 8000;

  const parseReleaseNotes = (content) => {
    const versions = [];
    let currentVersion = null;
    let currentSection = null;

    content.split('\n').forEach((line) => {
      if (line.startsWith('# ') || line.trim() === '' || line.startsWith('A comprehensive')) {
        return;
      }
      if (line.startsWith('## ')) {
        const match = line.match(/## (v[\d.]+) \((.*?)\)/);
        if (match) {
          currentVersion = {
            version: match[1],
            date: match[2],
            sections: [],
          };
          versions.push(currentVersion);
        }
        return;
      }
      if (line.startsWith('### ')) {
        currentSection = {
          title: line.replace('### ', ''),
          items: [],
        };
        if (currentVersion) {
          currentVersion.sections.push(currentSection);
        }
        return;
      }
      if (line.startsWith('Note: ')) {
        if (currentVersion) {
          currentVersion.note = line.replace('Note: ', '');
        }
        return;
      }
      if (line.startsWith('* ')) {
        const item = line.replace('* ', '');
        if (currentSection) {
          currentSection.items.push(item);
        }
      }
    });

    return versions;
  };

  useEffect(() => {
    const loadReleaseNotes = async () => {
      try {
        const rawContent =
          Platform.OS === 'ios'
            ? await RNFS.readFile(`${RNFS.MainBundlePath}/release_notes.md`, 'utf8')
            : await RNFS.readFileAssets('release_notes.md', 'utf8');
        const content = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const versions = parseReleaseNotes(content);
        const initialExpanded = {};
        versions.forEach((version) => {
          initialExpanded[version.version] = false;
          animations[version.version] = { rotation: new Animated.Value(0) };
        });
        animations[PAST_RELEASES_KEY] = { rotation: new Animated.Value(0) };
        setReleaseNotes(versions);
        setExpandedVersions(initialExpanded);
      } catch (error) {
        console.error('Error loading release notes:', error);
        const fallbackVersions = [
          {
            version: 'v1.3.0',
            date: '2025-04-04',
            sections: [
              {
                title: 'iOS Support and UI Improvements',
                items: [
                  'Added iOS simulator support',
                  'Enhanced UI with transparent status bar and updated icons',
                  'Improved build configurations for both platforms',
                  'Updated documentation with platform-specific guidance',
                ],
              },
            ],
            note: 'iOS build is for simulator only. For physical devices, build locally with your Apple Developer account.',
          },
        ];
        setReleaseNotes(fallbackVersions);
        setExpandedVersions({ 'v1.3.0': false });
        animations['v1.3.0'] = { rotation: new Animated.Value(0) };
        animations[PAST_RELEASES_KEY] = { rotation: new Animated.Value(0) };
      }
    };
    loadReleaseNotes();
  }, []);

  const toggleVersionExpansion = (version) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !expandedVersions[version];
    animateSection(animations[version], isExpanded);
    setExpandedVersions(prev => ({ ...prev, [version]: isExpanded }));
  };

  const togglePastReleasesExpansion = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !pastReleasesExpanded;
    animateSection(animations[PAST_RELEASES_KEY], isExpanded);
    if (!isExpanded) collapseAllVersions();
    setPastReleasesExpanded(isExpanded);
  };

  const latestRelease = releaseNotes.length > 0 ? releaseNotes[0] : null;
  const pastReleases = releaseNotes.length > 1 ? releaseNotes.slice(1) : [];

  const voiceLocaleGroups = useMemo(() => {
    if (!availableVoices.length) return [];
    const map = {};
    availableVoices.forEach(v => {
      if (!map[v.language]) {
        map[v.language] = { key: v.language, display: v.localeDisplay, voices: [] };
      }
      map[v.language].voices.push(v);
    });
    const COUNTRY_ORDER = ['en-US', 'en-GB', 'en-AU', 'en-IN', 'en-NG'];
    return Object.values(map).sort((a, b) => {
      const ai = COUNTRY_ORDER.indexOf(a.key);
      const bi = COUNTRY_ORDER.indexOf(b.key);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.display.localeCompare(b.display);
    });
  }, [availableVoices]);

  const renderVersionBlock = (version, showLatestBadge = false, containerStyle = {}) => (
    <TouchableOpacity
      key={version.version}
      style={[styles.versionContainer, containerStyle]}
      onPress={() => toggleVersionExpansion(version.version)}
      activeOpacity={0.7}
    >
      <View style={styles.versionHeader}>
        <View style={styles.versionRow}>
          {showLatestBadge && <ShipIcon width={20} height={20} fill="#29B6F6" />}
          <Text style={styles.versionText}>{version.version}</Text>
          <Text style={styles.versionDate}>{version.date}</Text>
          {showLatestBadge && (
            <View style={styles.latestBadge}>
              <Text style={styles.latestBadgeText}>Latest</Text>
            </View>
          )}
        </View>
        <Animated.View
          style={{
            transform: [
              {
                rotate:
                  animations[version.version]?.rotation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '90deg'],
                  }) || '0deg',
              },
            ],
          }}
        >
          <Text style={styles.versionArrow}>▶</Text>
        </Animated.View>
      </View>
      {expandedVersions[version.version] && (
        <View style={styles.versionContent}>
          {version.sections.map((section, sectionIndex) => (
            <View key={sectionIndex}>
              <Text style={styles.changelogSubtitle}>{section.title}:</Text>
              {section.items.map((item, itemIndex) => (
                <Text key={itemIndex} style={styles.changelogItem}>
                  • {item}
                </Text>
              ))}
            </View>
          ))}
          {version.note && (
            <Text style={[styles.changelogItem, { marginTop: 8, fontStyle: 'italic' }]}>
              {version.note}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[styles.scrollView, contentHeight != null && (Platform.OS === 'ios' ? { minHeight: contentHeight } : { height: contentHeight, minHeight: contentHeight })]}
      contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}
    >
      <View style={[styles.contentContainer, { paddingTop: contentPaddingTop ?? HEADER_HEIGHT }]}>
        <View style={styles.moreContainer}>
          <Text
            style={styles.moreTitle}
            onLongPress={handleMoreTitleLongPress}
            suppressHighlighting
          >
            More
          </Text>

          <CollapsibleSection
            title="Info"
            icon={<InfoIcon width={24} height={24} />}
            isExpanded={sectionsExpanded[SECTION_KEYS.INFO]}
            onToggle={() => toggleMoreSection(SECTION_KEYS.INFO)}
            styles={styles}
            style={styles.moreSectionWrapper}
          >
            {/* ── Official Rulebook card (includes Rules last synced) ── */}
            <View style={styles.versionContainer}>
              <CardIconTitle icon={<GithubIcon fill="#E1E1E1" />} title="Official Rulebook" styles={styles} />
              <Pressable onPress={() => Linking.openURL(RULEBOOK_REPO_URL)} style={{ marginTop: 6, marginBottom: 12 }}>
                <Text style={styles.infoLink}>{RULEBOOK_REPO_URL}</Text>
              </Pressable>
              <CardIconTitle icon={<SyncedIcon fill="#26C6DA" />} title="Rules Last Synced" styles={styles} />
              <Text style={[styles.moreTimestamp, { marginTop: 4 }]}>{lastFetchDate || 'Never'}</Text>
            </View>

            {/* ── App Repository card ── */}
            <View style={styles.versionContainer}>
              <CardIconTitle icon={<GithubIcon fill="#E1E1E1" />} title="App Repository" styles={styles} />
              <Pressable onPress={() => Linking.openURL(APP_REPO_URL)} style={{ marginTop: 6 }}>
                <Text style={styles.infoLink}>{APP_REPO_URL}</Text>
              </Pressable>
            </View>
          </CollapsibleSection>

          <CollapsibleSection
            title="Settings"
            icon={<SettingsIcon width={24} height={24} fill="#C45C26" />}
            isExpanded={sectionsExpanded[SECTION_KEYS.SETTINGS]}
            onToggle={() => toggleMoreSection(SECTION_KEYS.SETTINGS)}
            styles={styles}
            style={styles.moreSectionWrapper}
          >
            {/* ── Card: Expand all sections by default ── */}
            <TouchableOpacity
              style={styles.versionContainer}
              onPress={toggleExpandDefaults}
              activeOpacity={0.7}
            >
              <View style={styles.versionHeader}>
                <CardIconTitle icon={<ExpandIcon fill="#66BB6A" />} title="Expand all sections by default" styles={styles} />
                <Animated.View style={{ transform: [{ rotate: animations['expandDefaults']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                  <Text style={styles.versionArrow}>▶</Text>
                </Animated.View>
              </View>
              {expandDefaultsExpanded && (
                <View style={styles.versionContent}>
                  <View style={styles.settingsRow}>
                    <View style={styles.settingsRowLabel}>
                      <RulesIcon width={22} height={22} fill="#E1E1E1" style={styles.settingsRowIcon} />
                      <Text style={styles.settingsRowText}>Rules</Text>
                    </View>
                    <Switch
                      value={expandRulesDefault}
                      onValueChange={setExpandRulesDefaultAndSave}
                      trackColor={{ false: '#555', true: '#7B5CBF' }}
                      thumbColor="#E1E1E1"
                    />
                  </View>
                  <View style={[styles.settingsRow, styles.settingsRowLast]}>
                    <View style={styles.settingsRowLabel}>
                      <ExpansionsIcon width={22} height={22} fill="#E1E1E1" style={styles.settingsRowIcon} />
                      <Text style={styles.settingsRowText}>Expansions</Text>
                    </View>
                    <Switch
                      value={expandExpansionsDefault}
                      onValueChange={setExpandExpansionsDefaultAndSave}
                      trackColor={{ false: '#555', true: '#7B5CBF' }}
                      thumbColor="#E1E1E1"
                    />
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* ── Card: Voice Assistant ── */}
            {isVoiceAssistantSupported && voiceLocaleGroups.length > 0 && (
              <TouchableOpacity
                style={[styles.versionContainer, { paddingHorizontal: 10 }]}
                onPress={toggleVoiceParent}
                activeOpacity={0.7}
              >
                <View style={styles.versionHeader}>
                  <CardIconTitle icon={<MicIcon fill="#FF7043" />} title="Voice Assistant" styles={styles} />
                  <Animated.View style={{ transform: [{ rotate: animations['voiceParent']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                    <Text style={styles.versionArrow}>▶</Text>
                  </Animated.View>
                </View>
                {voiceParentExpanded && (
                  <View style={[styles.versionContent, { paddingLeft: 0, paddingRight: 0 }]}>
                    {voiceLocaleGroups.map(group => {
                      const groupHasSelection = group.voices.some(v => v.id === selectedVoiceId);
                      const localeAnim = voiceLocaleAnims[group.key];
                      const localeRotation = localeAnim?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
                      return (
                        <TouchableOpacity
                          key={group.key}
                          style={[styles.versionContainer, { paddingHorizontal: 10 }]}
                          onPress={() => toggleVoiceLocale(group.key)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.versionHeader}>
                            <View style={styles.versionRow}>
                              <Text style={[styles.versionText, { flexShrink: 1 }]}>{group.display}</Text>
                              {groupHasSelection && (
                                <View style={styles.latestBadge}>
                                  <Text style={styles.latestBadgeText}>Active</Text>
                                </View>
                              )}
                            </View>
                            <Animated.View style={{ transform: [{ rotate: localeRotation || '0deg' }], marginLeft: 12 }}>
                              <Text style={styles.versionArrow}>▶</Text>
                            </Animated.View>
                          </View>
                          {expandedLocales[group.key] && (
                            <View style={[styles.versionContent, { paddingLeft: 0, paddingRight: 0 }]}>
                              {group.voices.map((voice, index) => {
                                const isSelected = voice.id === selectedVoiceId;
                                const isLast = index === group.voices.length - 1;
                                return (
                                  <Pressable
                                    key={voice.id}
                                    onPress={() => onVoiceSelect?.(voice.id)}
                                    style={({ pressed }) => [
                                      styles.voiceRadioItem,
                                      isLast && styles.voiceRadioItemLast,
                                      pressed && styles.voiceRadioItemPressed,
                                    ]}
                                    android_ripple={{ color: 'rgba(187, 134, 252, 0.2)', borderless: false }}
                                  >
                                    <View style={[styles.voiceRadioOuter, isSelected && styles.voiceRadioOuterSelected]}>
                                      {isSelected && <View style={styles.voiceRadioInner} />}
                                    </View>
                                    <Text style={[styles.voiceRadioText, isSelected && styles.voiceRadioTextSelected]}>
                                      {voice.name}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* ── Card: Theme ── */}
            <TouchableOpacity
              style={[styles.versionContainer, { paddingHorizontal: 10 }]}
              onPress={toggleTheme}
              activeOpacity={0.7}
            >
              <View style={styles.versionHeader}>
                <CardIconTitle icon={<PaintIcon fill="#E89B3E" />} title="Theme" styles={styles} />
                <Animated.View style={{ transform: [{ rotate: animations['theme']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                  <Text style={styles.versionArrow}>▶</Text>
                </Animated.View>
              </View>
              {themeExpanded && (
                <View style={[styles.versionContent, { paddingLeft: 0, paddingRight: 0 }]}>

                  {/* ── Sub-section: Color ── */}
                  <TouchableOpacity
                    style={[styles.versionContainer, { paddingHorizontal: 10 }]}
                    onPress={toggleThemeColor}
                    activeOpacity={0.7}
                  >
                    <View style={styles.versionHeader}>
                      <CardIconTitle icon={<SplatIcon fill={THEME_OPTIONS.find(t => t.id === selectedTheme)?.color ?? ACCENT_COLOR} />} title="Color" styles={styles} titleColor={THEME_OPTIONS.find(t => t.id === selectedTheme)?.color} />
                      <Animated.View style={{ transform: [{ rotate: animations['themeColor']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                        <Text style={styles.versionArrow}>▶</Text>
                      </Animated.View>
                    </View>
                    {themeColorExpanded && (
                      <View style={[styles.versionContent, { paddingLeft: 0, paddingRight: 0 }]}>
                        {THEME_OPTIONS.map((theme, index) => {
                          const isSelected = theme.id === selectedTheme;
                          const isLast = index === THEME_OPTIONS.length - 1;
                          return (
                            <Pressable
                              key={theme.id}
                              onPress={() => selectTheme(theme.id)}
                              style={({ pressed }) => [
                                styles.voiceRadioItem,
                                isLast && styles.voiceRadioItemLast,
                                pressed && styles.voiceRadioItemPressed,
                              ]}
                              android_ripple={{ color: 'rgba(187, 134, 252, 0.2)', borderless: false }}
                            >
                              <View style={[styles.voiceRadioOuter, isSelected && { borderColor: theme.color }]}>
                                {isSelected && <View style={[styles.voiceRadioInner, { backgroundColor: theme.color }]} />}
                              </View>
                              <Text style={[styles.voiceRadioText, { color: theme.color }, isSelected && { fontWeight: '600' }]}>
                                {theme.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* ── Sub-section: Font - Primary ── */}
                  <TouchableOpacity
                    style={[styles.versionContainer, { paddingHorizontal: 10 }]}
                    onPress={toggleThemeFontPrimary}
                    activeOpacity={0.7}
                  >
                    <View style={styles.versionHeader}>
                      <CardIconTitle icon={<Font1Icon fill="#E1E1E1" />} title="Font - Primary" styles={styles} />
                      <Animated.View style={{ transform: [{ rotate: animations['themeFontPrimary']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                        <Text style={styles.versionArrow}>▶</Text>
                      </Animated.View>
                    </View>
                    {themeFontPrimaryExpanded && (
                      <View style={styles.versionContent}>
                        <Text style={styles.versionValue}>Coming soon</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* ── Sub-section: Font - Secondary ── */}
                  <TouchableOpacity
                    style={[styles.versionContainer, { paddingHorizontal: 10 }]}
                    onPress={toggleThemeFontSecondary}
                    activeOpacity={0.7}
                  >
                    <View style={styles.versionHeader}>
                      <CardIconTitle icon={<Font2Icon fill="#E1E1E1" />} title="Font - Secondary" styles={styles} />
                      <Animated.View style={{ transform: [{ rotate: animations['themeFontSecondary']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                        <Text style={styles.versionArrow}>▶</Text>
                      </Animated.View>
                    </View>
                    {themeFontSecondaryExpanded && (
                      <View style={styles.versionContent}>
                        <Text style={styles.versionValue}>Coming soon</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                </View>
              )}
            </TouchableOpacity>
          </CollapsibleSection>

          <CollapsibleSection
            title="Changelog"
            icon={<ChangelogIcon width={24} height={24} fill="#2E7D32" />}
            isExpanded={sectionsExpanded[SECTION_KEYS.CHANGELOG]}
            onToggle={() => toggleMoreSection(SECTION_KEYS.CHANGELOG)}
            styles={styles}
            style={styles.moreSectionWrapper}
          >
            {latestRelease && renderVersionBlock(latestRelease, true)}

            {pastReleases.length > 0 && (
              <TouchableOpacity
                style={[styles.versionContainer, { paddingHorizontal: 10 }]}
                onPress={togglePastReleasesExpansion}
                activeOpacity={0.7}
              >
                <View style={styles.versionHeader}>
                  <CardIconTitle icon={<CalendarIcon fill="#EC407A" />} title="Past Releases" styles={styles} />
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate:
                            animations[PAST_RELEASES_KEY]?.rotation.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '90deg'],
                            }) || '0deg',
                        },
                      ],
                    }}
                  >
                    <Text style={styles.versionArrow}>▶</Text>
                  </Animated.View>
                </View>
                {pastReleasesExpanded && (
                  <View style={[styles.versionContent, { paddingLeft: 0, paddingRight: 0 }]}>
                    {pastReleases.map((version) => renderVersionBlock(version, false, { paddingHorizontal: 10 }))}
                  </View>
                )}
              </TouchableOpacity>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Buy me some nails"
            icon={<VenmoIcon width={24} height={24} fill="#E8B923" />}
            isExpanded={sectionsExpanded[SECTION_KEYS.BUY_NAILS]}
            onToggle={() => toggleMoreSection(SECTION_KEYS.BUY_NAILS)}
            styles={styles}
            style={styles.moreSectionWrapper}
          >
            <View style={styles.versionContainer}>
              <View style={styles.paymentSection}>
              <View style={styles.venmoGridRow}>
                {VENMO_OPTIONS.slice(0, 3).map((item) => (
                  <View key={`venmo-${item.amount}`} style={styles.venmoGridCell}>
                    <View style={styles.nailButtonWrapper}>
                      <Pressable
                        style={({ pressed }) => [styles.nailButton, pressed && styles.nailButtonPressed]}
                        onPress={() => Linking.openURL(getVenmoPayUrl(item.amount))}
                        android_ripple={{ color: 'rgba(187, 134, 252, 0.4)', borderless: false }}
                      >
                        <Image
                          source={item.image}
                          style={styles.nailImage}
                          resizeMode="contain"
                        />
                        <Text style={styles.nailLabel}>{item.label}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.venmoGridRow}>
                {VENMO_OPTIONS.slice(3, 6).map((item) => (
                  <View key={`venmo-${item.amount}`} style={styles.venmoGridCell}>
                    <View style={styles.nailButtonWrapper}>
                      <Pressable
                        style={({ pressed }) => [styles.nailButton, pressed && styles.nailButtonPressed]}
                        onPress={() => Linking.openURL(getVenmoPayUrl(item.amount))}
                        android_ripple={{ color: 'rgba(187, 134, 252, 0.4)', borderless: false }}
                      >
                        <Image
                          source={item.image}
                          style={styles.nailImage}
                          resizeMode="contain"
                        />
                        <Text style={styles.nailLabel}>{item.label}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>
            </View>
          </CollapsibleSection>

          {debugVisible && (
            <CollapsibleSection
              title="Debug"
              icon={<DebugIcon width={24} height={24} fill="#FF7043" />}
              isExpanded={sectionsExpanded[SECTION_KEYS.DEBUG]}
              onToggle={() => toggleMoreSection(SECTION_KEYS.DEBUG)}
              styles={styles}
              style={styles.moreSectionWrapper}
            >
              {/* ── Feature Flags ── */}
              <TouchableOpacity
                style={[styles.versionContainer, { paddingHorizontal: 10 }]}
                onPress={toggleFeatureFlags}
                activeOpacity={0.7}
              >
                <View style={styles.versionHeader}>
                  <CardIconTitle icon={<FlagIcon fill="#FF9800" />} title="Feature Flags" styles={styles} />
                  <Animated.View style={{ transform: [{ rotate: animations['featureFlags']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                    <Text style={styles.versionArrow}>▶</Text>
                  </Animated.View>
                </View>
                {featureFlagsExpanded && (
                  <View style={styles.versionContent}>
                    <View style={[styles.settingsRow, styles.settingsRowLast, { marginBottom: 8 }]}>
                      <View style={styles.settingsRowLabel}>
                        <Text style={styles.settingsRowText}>Thinking Sounds</Text>
                      </View>
                      <Switch
                        value={thinkingSoundsEnabled}
                        onValueChange={setThinkingSoundsEnabledAndSave}
                        trackColor={{ false: '#555', true: '#7B5CBF' }}
                        thumbColor="#E1E1E1"
                      />
                    </View>
                  </View>
                )}
              </TouchableOpacity>

              {/* ── Build & Device Info ── */}
              <TouchableOpacity
                style={[styles.versionContainer, { paddingHorizontal: 10 }]}
                onPress={toggleBuildInfo}
                activeOpacity={0.7}
              >
                <View style={styles.versionHeader}>
                  <CardIconTitle icon={<DeviceIcon fill="#64B5F6" />} title="Build & Device Info" styles={styles} />
                  <Animated.View style={{ transform: [{ rotate: animations['buildInfo']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                    <Text style={styles.versionArrow}>▶</Text>
                  </Animated.View>
                </View>
                {buildInfoExpanded && (
                  <View style={[styles.versionContent, { paddingTop: 12 }]}>
                    {[
                      { label: 'Commit',       value: BUILD_COMMIT },
                      { label: 'Commit (full)', value: BUILD_COMMIT_FULL },
                      { label: 'Message',      value: BUILD_COMMIT_MESSAGE },
                      { label: 'Version',      value: `${BUILD_VERSION_NAME} (${BUILD_VERSION_CODE})` },
                      { label: 'Built',        value: new Date(BUILD_TIMESTAMP).toLocaleString() },
                      ...(Platform.OS === 'ios'
                        ? [
                            { label: 'Device', value: Platform.constants?.interfaceIdiom === 'phone' ? 'iPhone' : Platform.constants?.interfaceIdiom === 'pad' ? 'iPad' : Platform.constants?.interfaceIdiom ?? 'unknown' },
                            { label: 'iOS',    value: `${Platform.constants?.osVersion ?? '?'}` },
                          ]
                        : [
                            { label: 'Device', value: Platform.constants?.Model ?? 'unknown' },
                            { label: 'Brand',  value: (Platform.constants?.Brand ?? 'unknown').replace(/\b\w/g, c => c.toUpperCase()) },
                            { label: 'Android', value: `${Platform.constants?.Release ?? '?'} (API ${Platform.Version})` },
                          ]),
                      { label: 'Screen',       value: (() => { const { width, height } = Dimensions.get('window'); return `${Math.round(width)} × ${Math.round(height)}`; })() },
                    ].map(({ label, value }, idx, arr) => {
                      const isLast = idx === arr.length - 1;
                      const isMsg = label === 'Message';
                      const row = (
                        <View key={label} style={[styles.debugMetaRow, isLast && { borderBottomWidth: 0 }]}>
                          <Text style={styles.debugMetaLabel}>{label}</Text>
                          <Text
                            style={[styles.debugMetaValue, { fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo', flexShrink: 1 }, isMsg && !commitMsgExpanded && { color: ACCENT_COLOR }]}
                            numberOfLines={isMsg && commitMsgExpanded ? undefined : 2}
                          >
                            {value}{isMsg && !commitMsgExpanded ? ' ▸' : ''}
                          </Text>
                        </View>
                      );
                      if (isMsg) {
                        return (
                          <Pressable key={label} onPress={() => setCommitMsgExpanded(prev => !prev)}>
                            {row}
                          </Pressable>
                        );
                      }
                      return row;
                    })}
                  </View>
                )}
              </TouchableOpacity>

              {/* ── Voice Assistant ── */}
              <TouchableOpacity
                style={[styles.versionContainer, { paddingHorizontal: 10 }]}
                onPress={toggleVaDebug}
                activeOpacity={0.7}
              >
                <View style={styles.versionHeader}>
                  <CardIconTitle icon={<MicIcon fill="#FF7043" />} title="Voice Assistant" styles={styles} />
                  <Animated.View style={{ transform: [{ rotate: animations['vaDebug']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                    <Text style={styles.versionArrow}>▶</Text>
                  </Animated.View>
                </View>
                {vaDebugExpanded && (
                  <View style={[styles.versionContent, { paddingTop: 4, paddingLeft: 0, paddingRight: 0 }]}>
                    {/* Status subsection */}
                    <View style={{ marginTop: 8, marginBottom: 8 }}>
                      <CardIconTitle
                        icon={modelStatus === 'available' && micPermissionStatus === 'granted'
                          ? <CheckIcon fill="#4CAF50" />
                          : <CloseIcon fill="#CF6679" />
                        }
                        title="Status"
                        styles={styles}
                      />
                    </View>
                    <View style={styles.debugMetaRow}>
                      <Text style={styles.debugMetaLabel}>Device Support</Text>
                      <Text style={[styles.debugMetaValue, { color: VA_STATUS_COLOR.deviceSupport[modelStatus === 'unavailable' ? 'unavailable' : modelStatus === 'unknown' ? 'unknown' : 'supported'] }]}>
                        {VA_STATUS_LABEL.deviceSupport[modelStatus === 'unavailable' ? 'unavailable' : modelStatus === 'unknown' ? 'unknown' : 'supported']}
                      </Text>
                    </View>
                    <View style={styles.debugMetaRow}>
                      <Text style={styles.debugMetaLabel}>Model</Text>
                      <Text style={[styles.debugMetaValue, { color: VA_STATUS_COLOR.modelDownload[modelStatus] ?? '#888' }]}>
                        {modelStatus === 'downloading' && downloadProgressBytes > 0
                          ? `Downloading… ${(downloadProgressBytes / 1_048_576).toFixed(1)} MB`
                          : VA_STATUS_LABEL.modelDownload[modelStatus] ?? modelStatus}
                      </Text>
                    </View>
                    <View style={[styles.debugMetaRow, (Platform.OS !== 'ios' || !modelDebugInfo) && { borderBottomWidth: 0 }]}>
                      <Text style={styles.debugMetaLabel}>Mic Permission</Text>
                      <Text style={[styles.debugMetaValue, { color: VA_STATUS_COLOR.mic[micPermissionStatus] ?? '#888' }]}>
                        {VA_STATUS_LABEL.mic[micPermissionStatus] ?? micPermissionStatus}
                      </Text>
                    </View>
                    {Platform.OS === 'ios' && modelDebugInfo != null && (
                      <>
                        {modelDebugInfo.iosVersion != null && (
                          <View style={[styles.debugMetaRow, modelDebugInfo.modelAvailability == null && !(modelDebugInfo.unavailableReason != null && modelDebugInfo.unavailableReason !== '') && { borderBottomWidth: 0 }]}>
                            <Text style={styles.debugMetaLabel}>iOS Version</Text>
                            <Text style={[styles.debugMetaValue, { fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo', flexShrink: 1 }]}>
                              {String(modelDebugInfo.iosVersion)}
                            </Text>
                          </View>
                        )}
                        {modelDebugInfo.modelAvailability != null && (
                          <View style={[styles.debugMetaRow, !(modelDebugInfo.unavailableReason != null && modelDebugInfo.unavailableReason !== '') && { borderBottomWidth: 0 }]}>
                            <Text style={styles.debugMetaLabel}>Model Availability</Text>
                            <Text style={styles.debugMetaValue}>{String(modelDebugInfo.modelAvailability)}</Text>
                          </View>
                        )}
                        {modelDebugInfo.unavailableReason != null && modelDebugInfo.unavailableReason !== '' && (
                          <View style={[styles.debugMetaRow, { borderBottomWidth: 0 }]}>
                            <Text style={styles.debugMetaLabel}>Unavailable Reason</Text>
                            <Text style={styles.debugMetaValue}>{String(modelDebugInfo.unavailableReason)}</Text>
                          </View>
                        )}
                      </>
                    )}
                    {micPermissionStatus === 'not_granted' && (
                      <TouchableOpacity
                        style={vaReadinessStyles.actionButton}
                        onPress={() => Linking.openSettings()}
                      >
                        <Text style={vaReadinessStyles.actionButtonText}>Open Mic Settings</Text>
                      </TouchableOpacity>
                    )}
                    {(modelStatus === 'download_failed' || modelStatus === 'downloadable') && (
                      <>
                        <TouchableOpacity
                          style={[vaReadinessStyles.actionButton, isRetryingModelSetup && { opacity: 0.7 }]}
                          onPress={onRetryModelSetup}
                          disabled={isRetryingModelSetup}
                        >
                          <Text style={vaReadinessStyles.actionButtonText}>
                            {isRetryingModelSetup ? 'Retrying…' : 'Retry Model Setup'}
                          </Text>
                        </TouchableOpacity>
                        {retryModelSetupError != null && retryModelSetupError !== '' && (
                          <Text style={[styles.debugMetaValue, { color: '#CF6679', marginTop: 4, marginBottom: 8 }]}>
                            {retryModelSetupError}
                          </Text>
                        )}
                      </>
                    )}

                    {/* Models subsection */}
                    <TouchableOpacity
                      style={[styles.versionContainer, { marginTop: 8, paddingHorizontal: 10 }]}
                      onPress={toggleVoiceMeta}
                      activeOpacity={0.7}
                    >
                      <View style={styles.versionHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <CardIconTitle icon={<SpeakerIcon fill="#AB47BC" />} title="Models" styles={styles} />
                          <Text style={styles.versionDate}>{availableVoices.length} Available</Text>
                        </View>
                        <Animated.View style={{ transform: [{ rotate: animations['voiceMeta']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                          <Text style={styles.versionArrow}>▶</Text>
                        </Animated.View>
                      </View>
                      {voiceMetaExpanded && (
                        <View style={[styles.versionContent, { paddingLeft: 0, paddingRight: 0 }]}>
                          {availableVoices.map(voice => {
                            const voiceAnim = debugVoiceAnims[voice.id];
                            const isOpen = expandedDebugVoices[voice.id];
                            const metaRows = [
                              { label: 'ID',               value: voice.id },
                              { label: 'Display Name',     value: voice.name },
                              { label: 'Gender',           value: voice.gender ?? '—' },
                              { label: 'Language Tag',     value: voice.language },
                              { label: 'Locale',           value: voice.localeDisplay },
                              { label: 'Quality',          value: voice.qualityLabel ?? String(voice.quality ?? '—') },
                              { label: 'Latency',          value: voice.latencyLabel ?? String(voice.latency ?? '—') },
                              { label: 'Network Required', value: voice.networkRequired ? 'Yes' : 'No' },
                            ];
                            const featureItems = Array.isArray(voice.features) ? voice.features.filter(Boolean) : [];
                            return (
                              <TouchableOpacity
                                key={voice.id}
                                style={[styles.versionContainer, { paddingHorizontal: 10 }]}
                                onPress={() => toggleDebugVoice(voice.id)}
                                activeOpacity={0.7}
                              >
                                <View style={styles.versionHeader}>
                                  <View style={styles.versionRow}>
                                    <Text style={[styles.versionText, { flexShrink: 1, fontSize: 14 }]} numberOfLines={1}>{voice.id}</Text>
                                  </View>
                                  <Animated.View style={{ transform: [{ rotate: voiceAnim?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }], marginLeft: 12 }}>
                                    <Text style={styles.versionArrow}>▶</Text>
                                  </Animated.View>
                                </View>
                                {isOpen && (
                                  <View style={[styles.versionContent, { paddingTop: 4, paddingLeft: 8, paddingRight: 4 }]}>
                                    {metaRows.map(row => (
                                      <View key={row.label} style={styles.debugMetaRow}>
                                        <Text style={styles.debugMetaLabel}>{row.label}</Text>
                                        <Text style={styles.debugMetaValue}>{row.value}</Text>
                                      </View>
                                    ))}
                                    <View style={[styles.debugMetaRow, { borderBottomWidth: 0 }]}>
                                      <Text style={styles.debugMetaLabel}>Features</Text>
                                      <View style={{ flex: 1 }}>
                                        {featureItems.length > 0
                                          ? featureItems.map((f, i) => (
                                              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                                <Text style={{ fontSize: 12, color: '#CCCCCC', width: 14 }}>{'\u2022'}</Text>
                                                <Text style={[styles.debugMetaValue, { flex: 1 }]}>{f.trim()}</Text>
                                              </View>
                                            ))
                                          : <Text style={styles.debugMetaValue}>{'—'}</Text>
                                        }
                                      </View>
                                    </View>
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            </CollapsibleSection>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
