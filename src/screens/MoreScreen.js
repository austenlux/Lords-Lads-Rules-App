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
import { getEventLog, clearEventLog, onEventLogChange, formatEventLogAsText } from '../services/errorLogger';
import ErrorIcon from '../../assets/icons/error.svg';
import Clipboard from '@react-native-clipboard/clipboard';
import TrashIcon from '../../assets/icons/trash.svg';
import BenderIcon from '../../assets/icons/bender.svg';
import CopyIcon from '../../assets/icons/copy.svg';
import { getRagLog, clearRagLog, onRagLogChange, formatRagLogAsText } from '../services/ragLogger';
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
};
import { getVenmoPayUrl } from '../constants';
import { useTheme, COLOR_GROUPS, FONT_PAIRINGS } from '../context/ThemeContext';
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
import FontIcon from '../../assets/icons/font.svg';
import SpeakerIcon from '../../assets/icons/speaker.svg';
import AnvilIcon from '../../assets/icons/anvil.svg';
import TreeIcon from '../../assets/icons/tree.svg';
import LogIcon from '../../assets/icons/log.svg';
import MountainIcon from '../../assets/icons/mountain.svg';
import SkyIcon from '../../assets/icons/sky.svg';
import BeerIcon from '../../assets/icons/beer.svg';
import RainbowIcon from '../../assets/icons/rainbow.svg';
import { BadgeInfoIcon, BadgeErrorIcon, BadgeSuccessIcon, BadgeWarningIcon } from '../components/BadgeIcons';

function CardIconTitle({ icon, title, styles, titleColor }) {
  const { titleFontStyle } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexShrink: 1 }}>
      {React.cloneElement(icon, { width: 20, height: 20 })}
      <Text style={[styles.versionText, { flexShrink: 1 }, titleFontStyle, titleColor && { color: titleColor }]}>{title}</Text>
    </View>
  );
}



const COLOR_GROUP_ICONS = {
  forge:    { Icon: AnvilIcon,    color: '#7B8C9E', stroke: false },
  timber:   { Icon: LogIcon,      color: '#A0522D', stroke: false },
  wilds:    { Icon: MountainIcon, color: '#4A8A5B', stroke: false },
  elements: { Icon: SkyIcon,      color: null,      stroke: false },
  aurora:   { Icon: RainbowIcon,  color: null,      stroke: false },
  brew:     { Icon: BeerIcon,     color: '#D18D00', stroke: true  },
};

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
    downloadable:    'Not Enabled',
    downloading:     'Not Enabled',
    unavailable:     'Not Supported',
    not_ready:       'Not Enabled',
    ai_disabled:     'Not Enabled',
    download_failed: 'Setup Failed',
  },
  mic: {
    unknown:       'Checking…',
    undetermined:  'Not determined',
    granted:       'Granted',
    not_granted:   'Not Granted',
  },
  speech: {
    unknown:        'Checking…',
    undetermined:   'Not determined',
    granted:        'Ready',
    denied:         'Denied',
    restricted:     'Restricted',
    siri_disabled:  'Siri & Dictation Off',
    no_on_device:   'On-Device Not Available',
    unavailable:    'Unavailable',
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
    downloading:     '#FF9800',
    unavailable:     '#CF6679',
    not_ready:       '#FF9800',
    ai_disabled:     '#FF9800',
    download_failed: '#CF6679',
  },
  mic: {
    unknown:      '#888888',
    undetermined: '#FF9800',
    granted:      '#4CAF50',
    not_granted:  '#CF6679',
  },
  speech: {
    unknown:        '#888888',
    undetermined:   '#FF9800',
    granted:        '#4CAF50',
    denied:         '#CF6679',
    restricted:     '#CF6679',
    siri_disabled:  '#CF6679',
    no_on_device:   '#CF6679',
    unavailable:    '#CF6679',
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
    color: '#BB86FC',
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
  rulesLastSynced,
  expansionsLastSynced,
  styles,
  contentHeight,
  contentPaddingTop,
  isVoiceAssistantSupported = false,
  availableVoices = [],
  selectedVoiceId = null,
  onVoiceSelect,
  modelStatus = 'unknown',
  micPermissionStatus = 'unknown',
  speechPermissionStatus = 'unknown',
  onRetryModelSetup,
  modelDebugInfo = null,
  ragIndexReady = false,
  ragChunkCount = 0,
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
  const { themeId: selectedTheme, accent, selectTheme, fontId: selectedFont, selectFont, titleFont, bodyFont, titleFontStyle, bodyFontStyle } = useTheme();
  const [themeExpanded, setThemeExpanded] = useState(false);
  const [themeColorExpanded, setThemeColorExpanded] = useState(false);
  const [colorGroupExpanded, setColorGroupExpanded] = useState({});
  const [themeFontPrimaryExpanded, setThemeFontPrimaryExpanded] = useState(false);
  const [featureFlagsExpanded, setFeatureFlagsExpanded] = useState(false);
  const [voiceParentExpanded, setVoiceParentExpanded] = useState(false);
  const [voiceMetaExpanded, setVoiceMetaExpanded] = useState(false);
  const [expandedDebugVoices, setExpandedDebugVoices] = useState({});
  const [vaDebugExpanded, setVaDebugExpanded] = useState(false);
  const [buildInfoExpanded, setBuildInfoExpanded] = useState(false);
  const [commitMsgExpanded, setCommitMsgExpanded] = useState(false);
  const [errorLogExpanded, setErrorLogExpanded] = useState(false);
  const [errorLogEntries, setErrorLogEntries] = useState([]);
  const errorLogUnsub = useRef(null);
  const [ragLogExpanded, setRagLogExpanded] = useState(false);
  const [ragLog, setRagLog] = useState({ indexBuild: null, retrievals: [] });
  const [expandedRetrievals, setExpandedRetrievals] = useState({});
  const [ragCopied, setRagCopied] = useState(false);
  const [eventCopied, setEventCopied] = useState(false);
  const [ragChunksExpanded, setRagChunksExpanded] = useState(false);
  const ragLogUnsub = useRef(null);
  const ragRetrievalAnims = useRef({}).current;

  // Initialise rotation animations for settings cards and debug sections.
  useEffect(() => {
    if (!animations['expandDefaults']) animations['expandDefaults'] = { rotation: new Animated.Value(0) };
    if (!animations['voiceParent'])    animations['voiceParent']    = { rotation: new Animated.Value(0) };
    if (!animations['voiceMeta'])      animations['voiceMeta']      = { rotation: new Animated.Value(0) };
    if (!animations['theme'])              animations['theme']              = { rotation: new Animated.Value(0) };
    if (!animations['themeColor'])         animations['themeColor']         = { rotation: new Animated.Value(0) };
    COLOR_GROUPS.forEach(g => {
      const key = `colorGroup_${g.id}`;
      if (!animations[key]) animations[key] = { rotation: new Animated.Value(0) };
    });
    if (!animations['themeFontPrimary'])   animations['themeFontPrimary']   = { rotation: new Animated.Value(0) };
    if (!animations['featureFlags'])   animations['featureFlags']   = { rotation: new Animated.Value(0) };
    if (!animations['vaDebug'])        animations['vaDebug']        = { rotation: new Animated.Value(0) };
    if (!animations['buildInfo'])      animations['buildInfo']      = { rotation: new Animated.Value(0) };
    if (!animations['errorLog'])      animations['errorLog']      = { rotation: new Animated.Value(0) };
    if (!animations['ragLog'])        animations['ragLog']        = { rotation: new Animated.Value(0) };
  }, []);

  useEffect(() => {
    const load = async () => {
      const [rules, expansions, thinkingSounds] = await Promise.all([
        AsyncStorage.getItem(SETTINGS_KEYS.EXPAND_RULES_DEFAULT),
        AsyncStorage.getItem(SETTINGS_KEYS.EXPAND_EXPANSIONS_DEFAULT),
        AsyncStorage.getItem(SETTINGS_KEYS.THINKING_SOUNDS_ENABLED),
      ]);
      setExpandRulesDefault(rules === 'true');
      setExpandExpansionsDefault(expansions === 'true');
      const soundsOn = thinkingSounds === 'true';
      setThinkingSoundsEnabled(soundsOn);
      NativeVoiceAssistantOptional?.setThinkingSoundEnabled(soundsOn);
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
    animateSection(animations['ragLog'], false, 150);
    setRagLogExpanded(false);
    if (ragLogUnsub.current) { ragLogUnsub.current(); ragLogUnsub.current = null; }
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
      COLOR_GROUPS.forEach(g => animateSection(animations[`colorGroup_${g.id}`], false));
      animateSection(animations['themeFontPrimary'], false);
      setThemeColorExpanded(false);
      setColorGroupExpanded({});
      setThemeFontPrimaryExpanded(false);
    }
    setThemeExpanded(isExpanded);
  };

  const toggleThemeColor = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !themeColorExpanded;
    animateSection(animations['themeColor'], isExpanded);
    if (!isExpanded) {
      COLOR_GROUPS.forEach(g => animateSection(animations[`colorGroup_${g.id}`], false));
      setColorGroupExpanded({});
    }
    setThemeColorExpanded(isExpanded);
  };

  const toggleColorGroup = (groupId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !colorGroupExpanded[groupId];
    animateSection(animations[`colorGroup_${groupId}`], isExpanded);
    setColorGroupExpanded(prev => ({ ...prev, [groupId]: isExpanded }));
  };

  const toggleThemeFontPrimary = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !themeFontPrimaryExpanded;
    animateSection(animations['themeFontPrimary'], isExpanded);
    setThemeFontPrimaryExpanded(isExpanded);
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

  const toggleErrorLog = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !errorLogExpanded;
    animateSection(animations['errorLog'], isExpanded);
    if (isExpanded) {
      setErrorLogEntries(getEventLog());
      errorLogUnsub.current = onEventLogChange((entries) => {
        setErrorLogEntries([...entries]);
      });
    } else {
      if (errorLogUnsub.current) { errorLogUnsub.current(); errorLogUnsub.current = null; }
    }
    setErrorLogExpanded(isExpanded);
  };

  const toggleRagLog = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !ragLogExpanded;
    animateSection(animations['ragLog'], isExpanded);
    if (isExpanded) {
      setRagLog(getRagLog());
      ragLogUnsub.current = onRagLogChange(data => setRagLog(data));
    } else {
      if (ragLogUnsub.current) { ragLogUnsub.current(); ragLogUnsub.current = null; }
      setExpandedRetrievals({});
      Object.values(ragRetrievalAnims).forEach(a => animateSection(a, false, 0));
    }
    setRagLogExpanded(isExpanded);
  };

  const toggleRetrieval = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (!ragRetrievalAnims[id]) ragRetrievalAnims[id] = { rotation: new Animated.Value(0) };
    const isExpanded = !expandedRetrievals[id];
    animateSection(ragRetrievalAnims[id], isExpanded);
    setExpandedRetrievals(prev => ({ ...prev, [id]: isExpanded }));
  };

  const handleCopyRagLog = () => {
    Clipboard.setString(formatRagLogAsText());
    setRagCopied(true);
    setTimeout(() => setRagCopied(false), 2000);
  };

  const handleClearRagLog = () => {
    clearRagLog();
    setRagLog({ indexBuild: null, retrievals: [] });
    setExpandedRetrievals({});
    Object.values(ragRetrievalAnims).forEach(a => animateSection(a, false, 0));
  };

  useEffect(() => {
    return () => {
      if (errorLogUnsub.current) errorLogUnsub.current();
      if (ragLogUnsub.current) ragLogUnsub.current();
    };
  }, []);

  const toggleDebugVoice = (voiceId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isExpanded = !expandedDebugVoices[voiceId];
    animateSection(debugVoiceAnims[voiceId], isExpanded);
    setExpandedDebugVoices(prev => ({ ...prev, [voiceId]: isExpanded }));
  };


  const debugFlashAnim = useRef(new Animated.Value(0)).current;

  const collapseAllSections = () => {
    setSectionsExpanded({
      [SECTION_KEYS.BUY_NAILS]: false,
      [SECTION_KEYS.CHANGELOG]: false,
      [SECTION_KEYS.SETTINGS]: false,
      [SECTION_KEYS.INFO]: false,
      [SECTION_KEYS.DEBUG]: false,
    });
    setExpandedVersions({});
    setExpandedLocales({});
    setExpandedDebugVoices({});
    setExpandDefaultsExpanded(false);
    setThemeExpanded(false);
    setThemeColorExpanded(false);
    setColorGroupExpanded({});
    setThemeFontPrimaryExpanded(false);
    setFeatureFlagsExpanded(false);
    setVoiceParentExpanded(false);
    setVoiceMetaExpanded(false);
    setVaDebugExpanded(false);
    setBuildInfoExpanded(false);
    setCommitMsgExpanded(false);
    setErrorLogExpanded(false);
    setErrorLogEntries([]);
    setRagLogExpanded(false);
    setRagLog({ indexBuild: null, retrievals: [] });
    setExpandedRetrievals({});
    Object.values(animations).forEach(a => animateSection(a, false, 0));
    Object.values(voiceLocaleAnims).forEach(a => animateSection(a, false, 0));
    Object.values(debugVoiceAnims).forEach(a => animateSection(a, false, 0));
    Object.values(ragRetrievalAnims).forEach(a => animateSection(a, false, 0));
  };

  const handleMoreTitleLongPress = () => {
    const willShow = !debugVisible;
    setDebugVisible(willShow);
    if (willShow) {
      collapseAllSections();
      Animated.sequence([
        Animated.timing(debugFlashAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(debugFlashAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
        Animated.timing(debugFlashAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(debugFlashAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start();
    }
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
        logError('Release Notes', error, { phase: 'loadReleaseNotes' });
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
          <Text style={[styles.versionText, titleFontStyle]}>{version.version}</Text>
          <Text style={[styles.versionDate, bodyFontStyle]}>{version.date}</Text>
          {showLatestBadge && (
            <View style={styles.latestBadge}>
              <Text style={[styles.latestBadgeText, bodyFontStyle]}>Latest</Text>
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
              <Text style={[styles.changelogSubtitle, titleFontStyle]}>{section.title}:</Text>
              {section.items.map((item, itemIndex) => (
                <Text key={itemIndex} style={[styles.changelogItem, bodyFontStyle]}>
                  • {item}
                </Text>
              ))}
            </View>
          ))}
          {version.note && (
            <Text style={[styles.changelogItem, { marginTop: 8, fontStyle: 'italic' }, bodyFontStyle]}>
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
            style={[styles.moreTitle, titleFontStyle]}
            onLongPress={handleMoreTitleLongPress}
            suppressHighlighting
            numberOfLines={1}
            adjustsFontSizeToFit
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
                <Text style={[styles.infoLink, bodyFontStyle]}>{RULEBOOK_REPO_URL}</Text>
              </Pressable>
              <CardIconTitle icon={<SyncedIcon fill="#26C6DA" />} title="Rules Last Synced" styles={styles} />
              <Text style={[styles.moreTimestamp, { marginTop: 4, marginBottom: 12 }, bodyFontStyle]}>{rulesLastSynced || lastFetchDate || 'Never'}</Text>
              <CardIconTitle icon={<SyncedIcon fill="#26C6DA" />} title="Expansions Last Synced" styles={styles} />
              <Text style={[styles.moreTimestamp, { marginTop: 4 }, bodyFontStyle]}>{expansionsLastSynced || lastFetchDate || 'Never'}</Text>
            </View>

            {/* ── App Repository card ── */}
            <View style={styles.versionContainer}>
              <CardIconTitle icon={<GithubIcon fill="#E1E1E1" />} title="App Repository" styles={styles} />
              <Pressable onPress={() => Linking.openURL(APP_REPO_URL)} style={{ marginTop: 6 }}>
                <Text style={[styles.infoLink, bodyFontStyle]}>{APP_REPO_URL}</Text>
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
                      <Text style={[styles.settingsRowText, bodyFontStyle]}>Rules</Text>
                    </View>
                    <Switch
                      value={expandRulesDefault}
                      onValueChange={setExpandRulesDefaultAndSave}
                      trackColor={{ false: '#555', true: accent }}
                      thumbColor="#E1E1E1"
                    />
                  </View>
                  <View style={[styles.settingsRow, styles.settingsRowLast]}>
                    <View style={styles.settingsRowLabel}>
                      <ExpansionsIcon width={22} height={22} fill="#E1E1E1" style={styles.settingsRowIcon} />
                      <Text style={[styles.settingsRowText, bodyFontStyle]}>Expansions</Text>
                    </View>
                    <Switch
                      value={expandExpansionsDefault}
                      onValueChange={setExpandExpansionsDefaultAndSave}
                      trackColor={{ false: '#555', true: accent }}
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
                  <CardIconTitle icon={<MicIcon fill="#FF9800" />} title="Voice Assistant" styles={styles} />
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
                              <Text style={[styles.versionText, { flex: 1 }, titleFontStyle]}>{group.display}</Text>
                              {groupHasSelection && (
                                <View style={styles.latestBadge}>
                                  <Text style={[styles.latestBadgeText, bodyFontStyle]}>Active</Text>
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
                                    android_ripple={{ color: `${accent}33`, borderless: false }}
                                  >
                                    <View style={[styles.voiceRadioOuter, isSelected && styles.voiceRadioOuterSelected]}>
                                      {isSelected && <View style={styles.voiceRadioInner} />}
                                    </View>
                                    <Text style={[styles.voiceRadioText, bodyFontStyle, isSelected && styles.voiceRadioTextSelected]}>
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
                <CardIconTitle icon={<PaintIcon fill={accent} />} title="Theme" styles={styles} />
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
                      <CardIconTitle icon={<SplatIcon fill="#BB86FC" />} title="Colors" styles={styles} titleColor={accent} />
                      <Animated.View style={{ transform: [{ rotate: animations['themeColor']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                        <Text style={styles.versionArrow}>▶</Text>
                      </Animated.View>
                    </View>
                    {themeColorExpanded && (
                      <View style={[styles.versionContent, { paddingLeft: 0, paddingRight: 0 }]}>
                        {COLOR_GROUPS.map((group) => {
                          const groupKey = `colorGroup_${group.id}`;
                          const isGroupOpen = !!colorGroupExpanded[group.id];
                          return (
                            <TouchableOpacity
                              key={group.id}
                              style={[styles.versionContainer, { paddingHorizontal: 10 }]}
                              onPress={() => toggleColorGroup(group.id)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.versionHeader}>
                                <View style={styles.versionRow}>
                                  {(() => {
                                    const { Icon, color: iconColor, stroke: isStroke } = COLOR_GROUP_ICONS[group.id];
                                    const iconProps = iconColor
                                      ? (isStroke ? { fill: 'none', stroke: iconColor } : { fill: iconColor })
                                      : {};
                                    return <CardIconTitle icon={<Icon {...iconProps} />} title={group.label} styles={styles} titleColor={accent} />;
                                  })()}
                                  {group.options.some(opt => opt.id === selectedTheme) && (
                                    <View style={styles.latestBadge}>
                                      <Text style={[styles.latestBadgeText, bodyFontStyle]}>Active</Text>
                                    </View>
                                  )}
                                </View>
                                <Animated.View style={{ transform: [{ rotate: animations[groupKey]?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                                  <Text style={styles.versionArrow}>▶</Text>
                                </Animated.View>
                              </View>
                              {isGroupOpen && (
                                <View style={[styles.versionContent, { paddingLeft: 0, paddingRight: 0 }]}>
                                  <View style={styles.colorGrid}>
                                    {group.options.map((theme) => {
                                      const isSelected = theme.id === selectedTheme;
                                      return (
                                        <Pressable
                                          key={theme.id}
                                          onPress={() => selectTheme(theme.id)}
                                          style={({ pressed }) => [
                                            styles.colorBtn,
                                            { borderColor: theme.color },
                                            isSelected && { backgroundColor: theme.color },
                                            pressed && !isSelected && { opacity: 0.7 },
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.colorBtnText,
                                              { color: theme.color }, bodyFontStyle,
                                              isSelected && styles.colorBtnTextSelected,
                                            ]}
                                          >
                                            {theme.label.replace(' ', '\n')}
                                          </Text>
                                        </Pressable>
                                      );
                                    })}
                                  </View>
                                </View>
                              )}
                            </TouchableOpacity>
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
                      <CardIconTitle icon={<FontIcon fill="#E1E1E1" />} title="Fonts" styles={styles} />
                      <Animated.View style={{ transform: [{ rotate: animations['themeFontPrimary']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                        <Text style={styles.versionArrow}>▶</Text>
                      </Animated.View>
                    </View>
                    {themeFontPrimaryExpanded && (
                      <View style={[styles.versionContent, { paddingLeft: 0, paddingRight: 0 }]}>
                        {FONT_PAIRINGS.map((pairing) => {
                          const isFontSelected = pairing.id === selectedFont;
                          return (
                            <View key={pairing.id} style={styles.fontPairingWrapper}>
                              <Pressable
                                onPress={() => selectFont(pairing.id)}
                                style={({ pressed }) => [
                                  styles.fontBtn,
                                  { borderColor: accent },
                                  isFontSelected && { backgroundColor: accent },
                                  pressed && !isFontSelected && { opacity: 0.7 },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.fontBtnTitle,
                                    { fontFamily: pairing.titleFont, color: isFontSelected ? '#1E1E22' : accent },
                                  ]}
                                >
                                  {pairing.titlePreview}
                                </Text>
                                <Text
                                  style={[
                                    styles.fontBtnDesc,
                                    { fontFamily: pairing.descFont, color: isFontSelected ? '#1E1E22' : '#E1E1E1' },
                                  ]}
                                >
                                  {pairing.descPreview}
                                </Text>
                              </Pressable>
                            </View>
                          );
                        })}
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
                        android_ripple={{ color: `${accent}66`, borderless: false }}
                      >
                        <Image
                          source={item.image}
                          style={styles.nailImage}
                          resizeMode="contain"
                        />
                        <Text style={[styles.nailLabel, bodyFontStyle]}>{item.label}</Text>
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
                        android_ripple={{ color: `${accent}66`, borderless: false }}
                      >
                        <Image
                          source={item.image}
                          style={styles.nailImage}
                          resizeMode="contain"
                        />
                        <Text style={[styles.nailLabel, bodyFontStyle]}>{item.label}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>
            </View>
          </CollapsibleSection>

          {debugVisible && (
            <Animated.View style={{
              width: '100%',
              backgroundColor: debugFlashAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['transparent', 'rgba(255, 112, 67, 0.15)'],
              }),
              borderRadius: 12,
            }}>
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
                  <CardIconTitle icon={<FlagIcon fill="#E53935" />} title="Feature Flags" styles={styles} />
                  <Animated.View style={{ transform: [{ rotate: animations['featureFlags']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                    <Text style={styles.versionArrow}>▶</Text>
                  </Animated.View>
                </View>
                {featureFlagsExpanded && (
                  <View style={styles.versionContent}>
                    <View style={[styles.settingsRow, styles.settingsRowLast, { marginBottom: 8 }]}>
                      <View style={styles.settingsRowLabel}>
                        <Text style={[styles.settingsRowText, bodyFontStyle]}>Thinking Sounds</Text>
                      </View>
                      <Switch
                        value={thinkingSoundsEnabled}
                        onValueChange={setThinkingSoundsEnabledAndSave}
                        trackColor={{ false: '#555', true: accent }}
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
                          <Text style={[styles.debugMetaLabel, bodyFontStyle]}>{label}</Text>
                          <Text
                            style={[styles.debugMetaValue, { fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo', flexShrink: 1 }, isMsg && !commitMsgExpanded && { color: accent }]}
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
                  <CardIconTitle icon={<MicIcon fill="#FF9800" />} title="Voice Assistant" styles={styles} />
                  <Animated.View style={{ transform: [{ rotate: animations['vaDebug']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                    <Text style={styles.versionArrow}>▶</Text>
                  </Animated.View>
                </View>
                {vaDebugExpanded && (
                  <View style={[styles.versionContent, { paddingTop: 4, paddingLeft: 0, paddingRight: 0 }]}>
                    {/* Status subsection */}
                    {(() => {
                      const deviceKey = modelStatus === 'unavailable' ? 'unavailable' : modelStatus === 'unknown' ? 'unknown' : 'supported';
                      const deviceOk = deviceKey === 'supported';
                      const devicePending = deviceKey === 'unknown';

                      const modelOk = modelStatus === 'available';
                      const modelNeedsSetup = ['ai_disabled', 'not_ready', 'downloadable', 'downloading'].includes(modelStatus);
                      const modelFailed = modelStatus === 'unavailable' || modelStatus === 'download_failed';
                      const modelPending = !modelOk && !modelFailed && !modelNeedsSetup;

                      const micOk = micPermissionStatus === 'granted';
                      const micFailed = micPermissionStatus === 'not_granted';
                      const micPending = !micOk && !micFailed;

                      const speechOk = speechPermissionStatus === 'granted';
                      const speechFailed = ['denied', 'restricted', 'siri_disabled', 'no_on_device', 'unavailable'].includes(speechPermissionStatus);
                      const speechPending = !speechOk && !speechFailed;

                      const anyFailed = !deviceOk && !devicePending || modelFailed || micFailed || speechFailed;
                      const allGood = deviceOk && modelOk && micOk && speechOk;

                      const statusIcon = (ok, failed) =>
                        ok ? <BadgeSuccessIcon size={16} color="#4CAF50" />
                        : failed ? <BadgeErrorIcon size={16} color="#CF6679" />
                        : <BadgeWarningIcon size={16} color="#FFC107" />;

                      const overallIcon = allGood
                        ? <BadgeSuccessIcon size={22} color="#4CAF50" />
                        : anyFailed
                        ? <BadgeErrorIcon size={22} color="#CF6679" />
                        : <BadgeWarningIcon size={22} color="#FFC107" />;

                      const modelText = VA_STATUS_LABEL.modelDownload[modelStatus] ?? modelStatus;

                      return (
                        <>
                          <View style={{ marginTop: 12, marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                              <View style={{ width: 20, height: 20 }}>{overallIcon}</View>
                              <Text style={[styles.versionText, titleFontStyle]}>Status</Text>
                            </View>
                          </View>
                          <View style={styles.debugMetaRow}>
                            <Text style={[styles.debugMetaLabel, bodyFontStyle]}>Device Support</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                              {statusIcon(deviceOk, !deviceOk && !devicePending)}
                              <Text style={[styles.debugMetaValue, { color: VA_STATUS_COLOR.deviceSupport[deviceKey] }]}>
                                {VA_STATUS_LABEL.deviceSupport[deviceKey]}
                              </Text>
                            </View>
                          </View>
                          <View style={modelStatus === 'downloading' ? [styles.debugMetaRow, { borderBottomWidth: 0 }] : styles.debugMetaRow}>
                            <Text style={[styles.debugMetaLabel, bodyFontStyle]}>AI Model</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                              {statusIcon(modelOk, modelFailed)}
                              <Text style={[styles.debugMetaValue, { color: VA_STATUS_COLOR.modelDownload[modelStatus] ?? '#888' }]}>
                                {modelText}
                              </Text>
                            </View>
                          </View>
                          {modelNeedsSetup && (
                            <Text style={[{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 4, marginBottom: 6 }, bodyFontStyle]}>
                              Enable Apple Intelligence in your device Settings, then use Retry below.
                            </Text>
                          )}
                          <View style={styles.debugMetaRow}>
                            <Text style={[styles.debugMetaLabel, bodyFontStyle]}>Mic Permission</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                              {statusIcon(micOk, micFailed)}
                              <Text style={[styles.debugMetaValue, { color: VA_STATUS_COLOR.mic[micPermissionStatus] ?? '#888' }]}>
                                {VA_STATUS_LABEL.mic[micPermissionStatus] ?? micPermissionStatus}
                              </Text>
                            </View>
                          </View>
                          {micPermissionStatus === 'not_granted' && (
                            <TouchableOpacity
                              style={[vaReadinessStyles.actionButton, { backgroundColor: `${accent}26`, borderColor: `${accent}66` }]}
                              onPress={() => Linking.openSettings()}
                            >
                              <Text style={[vaReadinessStyles.actionButtonText, { color: accent }, bodyFontStyle]}>Open Mic Settings</Text>
                            </TouchableOpacity>
                          )}
                          {Platform.OS === 'ios' && (
                            <>
                              <View style={[styles.debugMetaRow, { borderBottomWidth: 0 }]}>
                                <Text style={[styles.debugMetaLabel, bodyFontStyle]}>Speech Recognition</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                  {statusIcon(speechOk, speechFailed)}
                                  <Text style={[styles.debugMetaValue, { color: VA_STATUS_COLOR.speech[speechPermissionStatus] ?? '#888' }]}>
                                    {VA_STATUS_LABEL.speech[speechPermissionStatus] ?? speechPermissionStatus}
                                  </Text>
                                </View>
                              </View>
                              {speechFailed && (
                                <TouchableOpacity
                                  style={[vaReadinessStyles.actionButton, { backgroundColor: `${accent}26`, borderColor: `${accent}66` }]}
                                  onPress={() => Linking.openSettings()}
                                >
                                  <Text style={[vaReadinessStyles.actionButtonText, { color: accent }, bodyFontStyle]}>
                                    {speechPermissionStatus === 'siri_disabled' ? 'Enable Siri & Dictation' : 'Open Speech Settings'}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </>
                          )}
                          {(modelNeedsSetup || modelStatus === 'download_failed') && (
                            <>
                              <TouchableOpacity
                                style={[vaReadinessStyles.actionButton, { marginTop: 12, backgroundColor: `${accent}26`, borderColor: `${accent}66` }]}
                                onPress={onRetryModelSetup}
                              >
                                <Text style={[vaReadinessStyles.actionButtonText, { color: accent }, bodyFontStyle]}>
                                  Retry AI Model Setup
                                </Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </>
                      );
                    })()}

                    {/* RAG Index status */}
                    <View style={styles.debugMetaRow}>
                      <Text style={[styles.debugMetaLabel, bodyFontStyle]}>RAG Index</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        {ragIndexReady
                          ? <BadgeSuccessIcon size={16} color="#4CAF50" />
                          : <BadgeInfoIcon size={16} color="#888888" />}
                        <Text style={[styles.debugMetaValue, { color: ragIndexReady ? '#4CAF50' : '#888888' }]}>
                          {ragIndexReady ? `Ready (${ragChunkCount} chunks)` : 'Not Available'}
                        </Text>
                      </View>
                    </View>

                    {/* Models subsection */}
                    <TouchableOpacity
                      style={[styles.versionContainer, { marginTop: 8, paddingHorizontal: 10 }]}
                      onPress={toggleVoiceMeta}
                      activeOpacity={0.7}
                    >
                      <View style={styles.versionHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <CardIconTitle icon={<SpeakerIcon fill="#AB47BC" />} title="Models" styles={styles} />
                          <Text style={[styles.versionDate, bodyFontStyle]}>{availableVoices.length} Available</Text>
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
                                        <Text style={[styles.debugMetaLabel, bodyFontStyle]}>{row.label}</Text>
                                        <Text style={styles.debugMetaValue}>{row.value}</Text>
                                      </View>
                                    ))}
                                    <View style={[styles.debugMetaRow, { borderBottomWidth: 0 }]}>
                                      <Text style={[styles.debugMetaLabel, bodyFontStyle]}>Features</Text>
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
              {/* ── Event Log ── */}
              <TouchableOpacity
                style={[styles.versionContainer, { paddingHorizontal: 10 }]}
                onPress={toggleErrorLog}
                activeOpacity={0.7}
              >
                <View style={styles.versionHeader}>
                  <CardIconTitle icon={<ErrorIcon width={20} height={20} fill="#FFC107" />} title="Event Log" styles={styles} />
                  <Animated.View style={{ transform: [{ rotate: animations['errorLog']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                    <Text style={styles.versionArrow}>▶</Text>
                  </Animated.View>
                </View>
                {errorLogExpanded && (
                  <View style={[styles.versionContent, { paddingLeft: 0, paddingRight: 0 }]}>
                    {errorLogEntries.length === 0 ? (
                      <Text style={[styles.debugMetaValue, { paddingHorizontal: 12, paddingVertical: 8 }]}>No events recorded.</Text>
                    ) : (
                      <>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 6,
                              paddingHorizontal: 16, paddingVertical: 7, borderRadius: 6,
                              borderWidth: 1,
                              borderColor: eventCopied ? '#4CAF50' : accent,
                              backgroundColor: eventCopied ? 'rgba(76,175,80,0.1)' : `${accent}1A`,
                            }}
                            onPress={() => {
                              Clipboard.setString(formatEventLogAsText());
                              setEventCopied(true);
                              setTimeout(() => setEventCopied(false), 2000);
                            }}
                          >
                            <CopyIcon width={16} height={16} fill={eventCopied ? '#4CAF50' : accent} />
                            <Text style={[{ color: eventCopied ? '#4CAF50' : accent, fontSize: 13 }, bodyFontStyle]}>
                              {eventCopied ? 'Copied!' : 'Copy All'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 6,
                              paddingHorizontal: 16, paddingVertical: 7, borderRadius: 6,
                              borderWidth: 1, borderColor: accent, backgroundColor: `${accent}1A`,
                            }}
                            onPress={() => { clearEventLog(); setErrorLogEntries([]); }}
                          >
                            <TrashIcon width={18} height={18} fill={accent} />
                            <Text style={[{ color: accent, fontSize: 13 }, bodyFontStyle]}>Clear Log</Text>
                          </TouchableOpacity>
                        </View>
                        {errorLogEntries.map((entry, i) => {
                          const typeColor = entry.type === 'error' ? '#CF6679'
                            : entry.type === 'success' ? '#66BB6A'
                            : '#4FC3F7';
                          const typeLabel = entry.type === 'error' ? 'ERROR'
                            : entry.type === 'success' ? 'SUCCESS'
                            : 'INFO';
                          const badgeIcon = entry.type === 'error'
                            ? <BadgeErrorIcon size={18} color={typeColor} />
                            : entry.type === 'success'
                            ? <BadgeSuccessIcon size={18} color={typeColor} />
                            : <BadgeInfoIcon size={18} color={typeColor} />;
                          const usefulErrorName = entry.errorName && entry.errorName !== 'Error' ? entry.errorName : null;
                          return (
                            <View key={i} style={[styles.debugMetaRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 3, paddingVertical: 8 }]}>
                              <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                                borderWidth: 1,
                                borderColor: typeColor,
                                borderRadius: 5,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                              }}>
                                {badgeIcon}
                                <Text style={[{
                                  fontSize: 13,
                                  color: typeColor,
                                  fontWeight: 'bold',
                                  includeFontPadding: false,
                                  textAlignVertical: 'center',
                                }, bodyFontStyle]}>{typeLabel}</Text>
                              </View>
                              <View style={{ gap: 3, paddingLeft: 2, paddingTop: 6, width: '100%' }}>
                                <Text style={[{ fontSize: 11, color: '#CCC' }, bodyFontStyle]}>
                                  <Text style={{ color: '#999' }}>Time:  </Text>{entry.ts}
                                </Text>
                                <Text style={[{ fontSize: 11, color: '#CCC' }, bodyFontStyle]}>
                                  <Text style={{ color: '#999' }}>Source:  </Text>{entry.source}
                                </Text>
                                <Text style={[{ fontSize: 12, color: '#E0E0E0' }, bodyFontStyle]}>
                                  <Text style={{ color: '#999' }}>Message:  </Text>{entry.message}
                                </Text>
                                {entry.elapsedMs != null && (
                                  <Text style={[{ fontSize: 11, color: '#CCC' }, bodyFontStyle]}>
                                    <Text style={{ color: '#999' }}>Elapsed:  </Text>{entry.elapsedMs}ms
                                  </Text>
                                )}
                                {entry.url != null && (
                                  <Text style={[{ fontSize: 11, color: '#CCC' }, bodyFontStyle]}>
                                    <Text style={{ color: '#999' }}>URL:  </Text>{entry.url}
                                  </Text>
                                )}
                                {usefulErrorName != null && (
                                  <Text style={[{ fontSize: 11, color: '#CCC' }, bodyFontStyle]}>
                                    <Text style={{ color: '#999' }}>Error:  </Text>{usefulErrorName}
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </>
                    )}
                  </View>
                )}
              </TouchableOpacity>

              {/* ── RAG Log ── */}
              <TouchableOpacity
                style={[styles.versionContainer, { paddingHorizontal: 10 }]}
                onPress={toggleRagLog}
                activeOpacity={0.7}
              >
                <View style={styles.versionHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexShrink: 1 }}>
                      <BenderIcon width={24} height={24} fill="#7B8D9E" />
                      <Text style={[styles.versionText, { flexShrink: 1 }, titleFontStyle]}>RAG Log</Text>
                    </View>
                  <Animated.View style={{ transform: [{ rotate: animations['ragLog']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                    <Text style={styles.versionArrow}>▶</Text>
                  </Animated.View>
                </View>
                {ragLogExpanded && (
                  <View style={[styles.versionContent, { paddingLeft: 0, paddingRight: 0 }]}>
                    {/* Action buttons */}
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 6,
                          paddingHorizontal: 16, paddingVertical: 7, borderRadius: 6,
                          borderWidth: 1, borderColor: ragCopied ? '#4CAF50' : accent,
                          backgroundColor: ragCopied ? 'rgba(76,175,80,0.1)' : `${accent}1A`,
                        }}
                        onPress={handleCopyRagLog}
                      >
                        <CopyIcon width={16} height={16} fill={ragCopied ? '#4CAF50' : accent} />
                        <Text style={[{ color: ragCopied ? '#4CAF50' : accent, fontSize: 13 }, bodyFontStyle]}>
                          {ragCopied ? 'Copied!' : 'Copy All'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 6,
                          paddingHorizontal: 16, paddingVertical: 7, borderRadius: 6,
                          borderWidth: 1, borderColor: accent, backgroundColor: `${accent}1A`,
                        }}
                        onPress={handleClearRagLog}
                      >
                        <TrashIcon width={16} height={16} fill={accent} />
                        <Text style={[{ color: accent, fontSize: 13 }, bodyFontStyle]}>Clear Log</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Index Build Summary */}
                    <View style={[styles.versionContainer, { marginBottom: 8 }]}>
                      <CardIconTitle icon={<BadgeInfoIcon size={18} color="#26C6DA" />} title="Index Build" styles={styles} />
                      {ragLog.indexBuild ? (
                        <View style={{ paddingTop: 8 }}>
                          {[
                            { label: 'Built at', value: ragLog.indexBuild.timestamp },
                            { label: 'Total chunks', value: String(ragLog.indexBuild.totalChunks) },
                            { label: 'Build time', value: `${ragLog.indexBuild.buildTimeMs}ms` },
                            { label: 'Content size', value: `${ragLog.indexBuild.totalContentSize.toLocaleString()} chars` },
                          ].map(({ label, value }) => (
                            <View key={label} style={styles.debugMetaRow}>
                              <Text style={[styles.debugMetaLabel, bodyFontStyle]}>{label}</Text>
                              <Text style={styles.debugMetaValue}>{value}</Text>
                            </View>
                          ))}
                          <TouchableOpacity
                            onPress={() => {
                              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                              setRagChunksExpanded(prev => !prev);
                            }}
                            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 4 }}
                            activeOpacity={0.7}
                          >
                            <Text style={[{ fontSize: 11, color: '#999', flex: 1 }, bodyFontStyle]}>
                              Chunks ({ragLog.indexBuild.totalChunks})
                            </Text>
                            <Text style={{ fontSize: 10, color: '#999' }}>{ragChunksExpanded ? '▼' : '▶'}</Text>
                          </TouchableOpacity>
                          {ragChunksExpanded && ragLog.indexBuild.chunks.map((c, i) => (
                            <View key={i} style={[styles.debugMetaRow, { flexDirection: 'column', gap: 2, paddingVertical: 4 }]}>
                              <Text style={[{ fontSize: 11, color: '#E0E0E0', fontWeight: '600' }, bodyFontStyle]} numberOfLines={1}>
                                {i + 1}. {c.heading}
                              </Text>
                              <Text style={[{ fontSize: 10, color: '#999' }, bodyFontStyle]}>
                                {c.source} · {c.charCount} chars · {c.wordCount} words · ~{c.tokenEstimate} tokens
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={[styles.debugMetaValue, { paddingTop: 8 }]}>No index build recorded yet.</Text>
                      )}
                    </View>

                    {/* Retrieval entries */}
                    {ragLog.retrievals.length === 0 ? (
                      <Text style={[styles.debugMetaValue, { paddingHorizontal: 12, paddingVertical: 8 }]}>No retrievals recorded yet.</Text>
                    ) : (
                      ragLog.retrievals.map(entry => {
                        if (!ragRetrievalAnims[entry.id]) ragRetrievalAnims[entry.id] = { rotation: new Animated.Value(0) };
                        const isOpen = expandedRetrievals[entry.id];
                        return (
                          <TouchableOpacity
                            key={entry.id}
                            style={[styles.versionContainer, { marginBottom: 6 }]}
                            onPress={() => toggleRetrieval(entry.id)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.versionHeader}>
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={[{ fontSize: 13, color: '#E0E0E0', fontWeight: '600' }, bodyFontStyle]} numberOfLines={1}>
                                  "{entry.question}"
                                </Text>
                                <Text style={[{ fontSize: 10, color: '#888', marginTop: 2 }, bodyFontStyle]}>
                                  {entry.timestamp}
                                </Text>
                              </View>
                              <Animated.View style={{ transform: [{ rotate: ragRetrievalAnims[entry.id]?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                                <Text style={styles.versionArrow}>▶</Text>
                              </Animated.View>
                            </View>
                            {isOpen && (
                              <View style={{ paddingTop: 8 }}>
                                {/* Retrieval metadata */}
                                {[
                                  { label: 'Keywords', value: entry.keywords?.join(', ') || 'none' },
                                  { label: 'Top-K', value: String(entry.topK) },
                                  ...(entry.totalContextChars != null ? [{ label: 'Context → LLM', value: `${entry.totalContextChars.toLocaleString()} chars` }] : []),
                                  ...(entry.promptLength != null ? [{ label: 'Prompt length', value: `${entry.promptLength.toLocaleString()} chars` }] : []),
                                ].map(({ label, value }) => (
                                  <View key={label} style={styles.debugMetaRow}>
                                    <Text style={[styles.debugMetaLabel, bodyFontStyle]}>{label}</Text>
                                    <Text style={styles.debugMetaValue}>{value}</Text>
                                  </View>
                                ))}

                                {/* All scored chunks */}
                                <Text style={[{ fontSize: 11, color: '#999', marginTop: 10, marginBottom: 4 }, bodyFontStyle]}>
                                  All chunks scored ({entry.allScoredChunks?.length ?? 0}):
                                </Text>
                                {entry.allScoredChunks?.map((c, i) => (
                                  <View key={i} style={[styles.debugMetaRow, {
                                    flexDirection: 'column', gap: 2, paddingVertical: 3,
                                    backgroundColor: c.selected ? 'rgba(76,175,80,0.08)' : 'transparent',
                                    borderLeftWidth: c.selected ? 2 : 0,
                                    borderLeftColor: '#4CAF50',
                                    paddingLeft: c.selected ? 6 : 0,
                                  }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                      {c.selected && <BadgeSuccessIcon size={12} color="#4CAF50" />}
                                      <Text style={[{ fontSize: 11, color: c.selected ? '#4CAF50' : '#CCC', fontWeight: c.selected ? '700' : '400', flex: 1 }, bodyFontStyle]} numberOfLines={1}>
                                        {i + 1}. {c.heading}
                                      </Text>
                                    </View>
                                    <Text style={[{ fontSize: 10, color: c.score > 0 ? '#AAA' : '#666' }, bodyFontStyle]}>
                                      Score: {c.score.toFixed(4)} · {c.source} · {c.charCount} chars · {c.wordCount} words
                                    </Text>
                                  </View>
                                ))}

                                {/* Selected chunks with full text */}
                                {entry.selectedChunks?.length > 0 && (
                                  <>
                                    <Text style={[{ fontSize: 11, color: '#999', marginTop: 10, marginBottom: 4 }, bodyFontStyle]}>
                                      Selected chunks sent to LLM ({entry.selectedChunks.length}):
                                    </Text>
                                    {entry.selectedChunks.map((c, i) => (
                                      <View key={i} style={{
                                        marginBottom: 6, padding: 8, borderRadius: 6,
                                        backgroundColor: 'rgba(38,198,218,0.06)',
                                        borderWidth: 1, borderColor: 'rgba(38,198,218,0.2)',
                                      }}>
                                        <Text style={[{ fontSize: 11, color: '#26C6DA', fontWeight: '700', marginBottom: 4 }, bodyFontStyle]}>
                                          {c.heading} (score {c.score.toFixed(4)}, {c.source})
                                        </Text>
                                        <Text style={[{ fontSize: 10, color: '#BBB', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]} selectable>
                                          {c.content}
                                        </Text>
                                      </View>
                                    ))}
                                  </>
                                )}
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                )}
              </TouchableOpacity>
            </CollapsibleSection>
            </Animated.View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
