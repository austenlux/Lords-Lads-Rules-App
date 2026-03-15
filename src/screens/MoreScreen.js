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
  Linking,
  Image,
  Switch,
  Platform,
  Dimensions,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { getEventLog, clearEventLog, onEventLogChange, formatEventLogAsText, logError, logEvent } from '../services/errorLogger';
import ErrorIcon from '../../assets/icons/error.svg';
import Clipboard from '@react-native-clipboard/clipboard';
import TrashIcon from '../../assets/icons/trash.svg';
import BenderIcon from '../../assets/icons/bender.svg';
import CopyIcon from '../../assets/icons/copy.svg';
import ExportIcon from '../../assets/icons/export.svg';
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
  FORCE_LOCAL_LLM: '@lnl_force_local_llm',
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
  cloudLlmStatus = {},
  geminiUsageStats,
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
  const [forceLocalLlm, setForceLocalLlm] = useState(false);
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
  const [ragExported, setRagExported] = useState(false);
  const [eventExported, setEventExported] = useState(false);
  const [ragChunksExpanded, setRagChunksExpanded] = useState(false);
  const [ragScoredChunksExpanded, setRagScoredChunksExpanded] = useState({});
  const [ragSelectedChunkExpanded, setRagSelectedChunkExpanded] = useState({});
  const [indexBuildExpanded, setIndexBuildExpanded] = useState(false);
  const [entryLocalExpanded, setEntryLocalExpanded] = useState({});
  const [entryCloudExpanded, setEntryCloudExpanded] = useState({});
  const [entryResponseExpanded, setEntryResponseExpanded] = useState({});
  const [entrySentenceExpanded, setEntrySentenceExpanded] = useState({});
  const [entryFinalChunksExpanded, setEntryFinalChunksExpanded] = useState({});
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
      const [rules, expansions, thinkingSounds, forceLocal] = await Promise.all([
        AsyncStorage.getItem(SETTINGS_KEYS.EXPAND_RULES_DEFAULT),
        AsyncStorage.getItem(SETTINGS_KEYS.EXPAND_EXPANSIONS_DEFAULT),
        AsyncStorage.getItem(SETTINGS_KEYS.THINKING_SOUNDS_ENABLED),
        AsyncStorage.getItem(SETTINGS_KEYS.FORCE_LOCAL_LLM),
      ]);
      setExpandRulesDefault(rules === 'true');
      setExpandExpansionsDefault(expansions === 'true');
      const soundsOn = thinkingSounds === 'true';
      setThinkingSoundsEnabled(soundsOn);
      NativeVoiceAssistantOptional?.setThinkingSoundEnabled(soundsOn);
      setForceLocalLlm(forceLocal === 'true');
    };
    load();
  }, []);

  const setExpandRulesDefaultAndSave = async (value) => {
    setExpandRulesDefault(value);
    await AsyncStorage.setItem(SETTINGS_KEYS.EXPAND_RULES_DEFAULT, value ? 'true' : 'false');
    logEvent('Feature Flags', `Expand Rules Default ${value ? 'enabled' : 'disabled'}`);
  };

  const setExpandExpansionsDefaultAndSave = async (value) => {
    setExpandExpansionsDefault(value);
    await AsyncStorage.setItem(SETTINGS_KEYS.EXPAND_EXPANSIONS_DEFAULT, value ? 'true' : 'false');
    logEvent('Feature Flags', `Expand Expansions Default ${value ? 'enabled' : 'disabled'}`);
  };

  const setThinkingSoundsEnabledAndSave = async (value) => {
    setThinkingSoundsEnabled(value);
    NativeVoiceAssistantOptional?.setThinkingSoundEnabled(value);
    await AsyncStorage.setItem(SETTINGS_KEYS.THINKING_SOUNDS_ENABLED, value ? 'true' : 'false');
    logEvent('Feature Flags', `Thinking Sounds ${value ? 'enabled' : 'disabled'}`);
  };

  const setForceLocalLlmAndSave = async (value) => {
    setForceLocalLlm(value);
    await AsyncStorage.setItem(SETTINGS_KEYS.FORCE_LOCAL_LLM, value ? 'true' : 'false');
    logEvent('Feature Flags', `Force Local LLM ${value ? 'enabled' : 'disabled'}`);
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
    setIndexBuildExpanded(false);
    setEntryLocalExpanded({});
    setEntryCloudExpanded({});
    setEntryResponseExpanded({});
    setEntrySentenceExpanded({});
    setEntryFinalChunksExpanded({});
    if (ragLogUnsub.current) { ragLogUnsub.current(); ragLogUnsub.current = null; }
  };

  // ── Toggle functions ─────────────────────────────────────────────────────

  const toggleMoreSection = (sectionKey) => {

    const willCollapse = sectionsExpanded[sectionKey];
    if (willCollapse) {
      if (sectionKey === SECTION_KEYS.SETTINGS)  collapseSettingsChildren();
      if (sectionKey === SECTION_KEYS.CHANGELOG) collapseChangelogChildren();
      if (sectionKey === SECTION_KEYS.DEBUG)     collapseDebugChildren();
    }
    setSectionsExpanded(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  const toggleVoiceLocale = (localeKey) => {

    const isExpanded = !expandedLocales[localeKey];
    animateSection(voiceLocaleAnims[localeKey], isExpanded);
    setExpandedLocales(prev => ({ ...prev, [localeKey]: isExpanded }));
  };

  const toggleExpandDefaults = () => {

    const isExpanded = !expandDefaultsExpanded;
    animateSection(animations['expandDefaults'], isExpanded);
    setExpandDefaultsExpanded(isExpanded);
  };

  const toggleTheme = () => {

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

    const isExpanded = !themeColorExpanded;
    animateSection(animations['themeColor'], isExpanded);
    if (!isExpanded) {
      COLOR_GROUPS.forEach(g => animateSection(animations[`colorGroup_${g.id}`], false));
      setColorGroupExpanded({});
    }
    setThemeColorExpanded(isExpanded);
  };

  const toggleColorGroup = (groupId) => {

    const isExpanded = !colorGroupExpanded[groupId];
    animateSection(animations[`colorGroup_${groupId}`], isExpanded);
    setColorGroupExpanded(prev => ({ ...prev, [groupId]: isExpanded }));
  };

  const toggleThemeFontPrimary = () => {

    const isExpanded = !themeFontPrimaryExpanded;
    animateSection(animations['themeFontPrimary'], isExpanded);
    setThemeFontPrimaryExpanded(isExpanded);
  };



  const toggleVoiceParent = () => {

    const isExpanded = !voiceParentExpanded;
    animateSection(animations['voiceParent'], isExpanded);
    if (!isExpanded) collapseAllLocales();
    setVoiceParentExpanded(isExpanded);
  };

  const toggleVoiceMeta = () => {

    const isExpanded = !voiceMetaExpanded;
    animateSection(animations['voiceMeta'], isExpanded);
    if (!isExpanded) collapseAllDebugVoices();
    setVoiceMetaExpanded(isExpanded);
  };

  const toggleFeatureFlags = () => {

    const isExpanded = !featureFlagsExpanded;
    animateSection(animations['featureFlags'], isExpanded);
    setFeatureFlagsExpanded(isExpanded);
  };

  const toggleVaDebug = () => {

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

    const isExpanded = !buildInfoExpanded;
    animateSection(animations['buildInfo'], isExpanded);
    setBuildInfoExpanded(isExpanded);
  };

  const toggleErrorLog = () => {

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

    const isExpanded = !ragLogExpanded;
    animateSection(animations['ragLog'], isExpanded);
    if (isExpanded) {
      setRagLog(getRagLog());
      ragLogUnsub.current = onRagLogChange(data => setRagLog(data));
    } else {
      if (ragLogUnsub.current) { ragLogUnsub.current(); ragLogUnsub.current = null; }
      setExpandedRetrievals({});
      setRagScoredChunksExpanded({});
      setRagSelectedChunkExpanded({});
      setIndexBuildExpanded(false);
      setEntryLocalExpanded({});
      setEntryCloudExpanded({});
      setEntryResponseExpanded({});
      setEntrySentenceExpanded({});
      setEntryFinalChunksExpanded({});
      Object.values(ragRetrievalAnims).forEach(a => animateSection(a, false, 0));
    }
    setRagLogExpanded(isExpanded);
  };

  const toggleRetrieval = (id) => {

    if (!ragRetrievalAnims[id]) ragRetrievalAnims[id] = { rotation: new Animated.Value(0) };
    const isExpanded = !expandedRetrievals[id];
    animateSection(ragRetrievalAnims[id], isExpanded);
    setExpandedRetrievals(prev => ({ ...prev, [id]: isExpanded }));
  };

  const handleCopyRagLog = () => {
    Clipboard.setString(formatRagLogAsText());
    logEvent('LLM Log', 'Copied to clipboard');
    setRagCopied(true);
    setTimeout(() => setRagCopied(false), 2000);
  };

  const handleClearRagLog = () => {
    clearRagLog();
    setRagLog({ indexBuild: null, retrievals: [] });
    setExpandedRetrievals({});
    setRagScoredChunksExpanded({});
    setRagSelectedChunkExpanded({});
    setIndexBuildExpanded(false);
    setEntryLocalExpanded({});
    setEntryCloudExpanded({});
    setEntryResponseExpanded({});
    setEntrySentenceExpanded({});
    setEntryFinalChunksExpanded({});
    Object.values(ragRetrievalAnims).forEach(a => animateSection(a, false, 0));
    logEvent('LLM Log', 'Cleared');
  };

  const handleExportRagLog = async () => {
    try {
      const text = formatRagLogAsText();
      const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
      const path = `${dir}/llm_log.txt`;
      await RNFS.writeFile(path, text, 'utf8');
      logEvent('LLM Log', 'Exported to llm_log.txt');
      setRagExported(true);
      setTimeout(() => setRagExported(false), 3000);
    } catch (e) {
      logError('RAG Export', e);
    }
  };

  const handleExportEventLog = async () => {
    try {
      const text = formatEventLogAsText();
      const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
      const path = `${dir}/event_log.txt`;
      await RNFS.writeFile(path, text, 'utf8');
      logEvent('Event Log', 'Exported to event_log.txt');
      setEventExported(true);
      setTimeout(() => setEventExported(false), 3000);
    } catch (e) {
      logError('Event Export', e);
    }
  };

  useEffect(() => {
    return () => {
      if (errorLogUnsub.current) errorLogUnsub.current();
      if (ragLogUnsub.current) ragLogUnsub.current();
    };
  }, []);

  const toggleDebugVoice = (voiceId) => {

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
    setRagScoredChunksExpanded({});
    setRagSelectedChunkExpanded({});
    setIndexBuildExpanded(false);
    setEntryLocalExpanded({});
    setEntryCloudExpanded({});
    setEntryResponseExpanded({});
    setEntrySentenceExpanded({});
    setEntryFinalChunksExpanded({});
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

    const isExpanded = !expandedVersions[version];
    animateSection(animations[version], isExpanded);
    setExpandedVersions(prev => ({ ...prev, [version]: isExpanded }));
  };

  const togglePastReleasesExpansion = () => {

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
      keyboardShouldPersistTaps="handled"
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
              <View style={[styles.versionContainer, { paddingHorizontal: 10 }]}>
                <TouchableOpacity onPress={toggleFeatureFlags} activeOpacity={0.7}>
                  <View style={styles.versionHeader}>
                    <CardIconTitle icon={<FlagIcon fill="#E53935" />} title="Feature Flags" styles={styles} />
                    <Animated.View style={{ transform: [{ rotate: animations['featureFlags']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                      <Text style={styles.versionArrow}>▶</Text>
                    </Animated.View>
                  </View>
                </TouchableOpacity>
                {featureFlagsExpanded && (
                  <View style={styles.versionContent}>
                    <View style={styles.settingsRow}>
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
                    <View style={[styles.settingsRow, styles.settingsRowLast, { marginBottom: 8 }]}>
                      <View style={[styles.settingsRowLabel, { flex: 1 }]}>
                        <Text style={[styles.settingsRowText, bodyFontStyle]}>Force Local LLM</Text>
                      </View>
                      <Switch
                        value={forceLocalLlm}
                        onValueChange={setForceLocalLlmAndSave}
                        trackColor={{ false: '#555', true: accent }}
                        thumbColor="#E1E1E1"
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* ── Build & Device Info ── */}
              <View style={[styles.versionContainer, { paddingHorizontal: 10 }]}>
                <TouchableOpacity onPress={toggleBuildInfo} activeOpacity={0.7}>
                  <View style={styles.versionHeader}>
                    <CardIconTitle icon={<DeviceIcon fill="#64B5F6" />} title="Build & Device Info" styles={styles} />
                    <Animated.View style={{ transform: [{ rotate: animations['buildInfo']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                      <Text style={styles.versionArrow}>▶</Text>
                    </Animated.View>
                  </View>
                </TouchableOpacity>
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
              </View>

              {/* ── Voice Assistant ── */}
              <View style={[styles.versionContainer, { paddingHorizontal: 10 }]}>
                <TouchableOpacity onPress={toggleVaDebug} activeOpacity={0.7}>
                  <View style={styles.versionHeader}>
                    <CardIconTitle icon={<MicIcon fill="#FF9800" />} title="Voice Assistant" styles={styles} />
                    <Animated.View style={{ transform: [{ rotate: animations['vaDebug']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                      <Text style={styles.versionArrow}>▶</Text>
                    </Animated.View>
                  </View>
                </TouchableOpacity>
                {vaDebugExpanded && (
                  <View style={[styles.versionContent, { paddingTop: 4, paddingLeft: 0, paddingRight: 0 }]}>
                    {/* General Status — items needed for both Local & Cloud LLM */}
                    {(() => {
                      const micOk = micPermissionStatus === 'granted';
                      const micFailed = micPermissionStatus === 'not_granted';
                      const speechOk = speechPermissionStatus === 'granted';
                      const speechFailed = ['denied', 'restricted', 'siri_disabled', 'no_on_device', 'unavailable'].includes(speechPermissionStatus);
                      const isAndroidPlatform = Platform.OS === 'android';
                      const sharedAllGood = micOk && (isAndroidPlatform || speechOk);
                      const sharedAnyFailed = micFailed || (!isAndroidPlatform && speechFailed);

                      const statusIcon = (ok, failed) =>
                        ok ? <BadgeSuccessIcon size={16} color="#4CAF50" />
                        : failed ? <BadgeErrorIcon size={16} color="#CF6679" />
                        : <BadgeWarningIcon size={16} color="#FFC107" />;

                      const sharedOverallIcon = sharedAllGood
                        ? <BadgeSuccessIcon size={22} color="#4CAF50" />
                        : sharedAnyFailed
                        ? <BadgeErrorIcon size={22} color="#CF6679" />
                        : <BadgeWarningIcon size={22} color="#FFC107" />;

                      return (
                        <>
                          <View style={{ marginTop: 12, marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                              <View style={{ width: 20, height: 20 }}>{sharedOverallIcon}</View>
                              <Text style={[styles.versionText, titleFontStyle]}>General Status</Text>
                            </View>
                          </View>
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
                        </>
                      );
                    })()}

                    {/* Local LLM Status */}
                    {(() => {
                      const deviceKey = modelStatus === 'unavailable' ? 'unavailable' : modelStatus === 'unknown' ? 'unknown' : 'supported';
                      const deviceOk = deviceKey === 'supported';
                      const devicePending = deviceKey === 'unknown';

                      const modelOk = modelStatus === 'available';
                      const modelNeedsSetup = ['ai_disabled', 'not_ready', 'downloadable', 'downloading'].includes(modelStatus);
                      const modelFailed = modelStatus === 'unavailable' || modelStatus === 'download_failed';

                      const localAnyFailed = (!deviceOk && !devicePending) || modelFailed;
                      const localAllGood = deviceOk && modelOk;

                      const statusIcon = (ok, failed) =>
                        ok ? <BadgeSuccessIcon size={16} color="#4CAF50" />
                        : failed ? <BadgeErrorIcon size={16} color="#CF6679" />
                        : <BadgeWarningIcon size={16} color="#FFC107" />;

                      const localOverallIcon = localAllGood
                        ? <BadgeSuccessIcon size={22} color="#4CAF50" />
                        : localAnyFailed
                        ? <BadgeErrorIcon size={22} color="#CF6679" />
                        : <BadgeWarningIcon size={22} color="#FFC107" />;

                      const modelText = VA_STATUS_LABEL.modelDownload[modelStatus] ?? modelStatus;

                      return (
                        <>
                          <View style={{ marginTop: 12, marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                              <View style={{ width: 20, height: 20 }}>{localOverallIcon}</View>
                              <Text style={[styles.versionText, titleFontStyle]}>Local LLM Status</Text>
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

                    {/* Cloud LLM Status */}
                    {(() => {
                      const cloudKeyOk = !!cloudLlmStatus.keyConfigured;
                      const usage = typeof geminiUsageStats === 'function' ? geminiUsageStats() : {};
                      const cloudOverallIcon = cloudKeyOk
                        ? <BadgeSuccessIcon size={22} color="#4CAF50" />
                        : <BadgeErrorIcon size={22} color="#CF6679" />;
                      return (
                        <>
                          <View style={{ marginTop: 12, marginBottom: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                              <View style={{ width: 20, height: 20 }}>{cloudOverallIcon}</View>
                              <Text style={[styles.versionText, titleFontStyle]}>Cloud LLM Status</Text>
                            </View>
                          </View>
                          <View style={styles.debugMetaRow}>
                            <Text style={[styles.debugMetaLabel, bodyFontStyle]}>API Key</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                              {cloudKeyOk
                                ? <BadgeSuccessIcon size={16} color="#4CAF50" />
                                : <BadgeErrorIcon size={16} color="#CF6679" />}
                              <Text style={[styles.debugMetaValue, { color: cloudKeyOk ? '#4CAF50' : '#CF6679' }]}>
                                {cloudKeyOk ? 'Configured' : 'Not Set'}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.debugMetaRow}>
                            <Text style={[styles.debugMetaLabel, bodyFontStyle]}>Calls (session)</Text>
                            <Text style={[styles.debugMetaValue, { color: '#CCC' }]}>
                              {usage.callsThisSession ?? 0}
                            </Text>
                          </View>
                          <View style={styles.debugMetaRow}>
                            <Text style={[styles.debugMetaLabel, bodyFontStyle]}>Calls (last 60s)</Text>
                            <Text style={[styles.debugMetaValue, { color: (usage.callsLastMinute ?? 0) >= 8 ? '#FFC107' : '#CCC' }]}>
                              {usage.callsLastMinute ?? 0}
                            </Text>
                          </View>
                          {usage.lastRateLimitAt && (
                            <View style={styles.debugMetaRow}>
                              <Text style={[styles.debugMetaLabel, bodyFontStyle]}>Last Rate Limit</Text>
                              <Text style={[styles.debugMetaValue, { color: '#CF6679' }]}>
                                {usage.lastRateLimitAt}
                              </Text>
                            </View>
                          )}
                        </>
                      );
                    })()}

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
              </View>
              {/* ── Event Log ── */}
              <View style={[styles.versionContainer, { paddingHorizontal: 10 }]}>
                <TouchableOpacity onPress={toggleErrorLog} activeOpacity={0.7}>
                  <View style={styles.versionHeader}>
                    <CardIconTitle icon={<ErrorIcon width={20} height={20} fill="#FFC107" />} title="Event Log" styles={styles} />
                    <Animated.View style={{ transform: [{ rotate: animations['errorLog']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                      <Text style={styles.versionArrow}>▶</Text>
                    </Animated.View>
                  </View>
                </TouchableOpacity>
                {errorLogExpanded && (
                  <View style={[styles.versionContent, { paddingLeft: 0, paddingRight: 0 }]}>
                    {errorLogEntries.length === 0 ? (
                      <Text style={[styles.debugMetaValue, { paddingHorizontal: 12, paddingVertical: 8 }]}>No events recorded.</Text>
                    ) : (
                      <>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                              minWidth: 95, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6,
                              borderWidth: 1,
                              borderColor: eventCopied ? '#4CAF50' : accent,
                              backgroundColor: eventCopied ? 'rgba(76,175,80,0.1)' : `${accent}1A`,
                            }}
                            onPress={() => {
                              Clipboard.setString(formatEventLogAsText());
                              logEvent('Event Log', 'Copied to clipboard');
                              setEventCopied(true);
                              setTimeout(() => setEventCopied(false), 2000);
                            }}
                          >
                            <CopyIcon width={15} height={15} fill={eventCopied ? '#4CAF50' : accent} />
                            <Text style={[{ color: eventCopied ? '#4CAF50' : accent, fontSize: 12 }, bodyFontStyle]}>
                              {eventCopied ? 'Copied!' : 'Copy'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                              minWidth: 95, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6,
                              borderWidth: 1,
                              borderColor: eventExported ? '#4CAF50' : accent,
                              backgroundColor: eventExported ? 'rgba(76,175,80,0.1)' : `${accent}1A`,
                            }}
                            onPress={handleExportEventLog}
                          >
                            <ExportIcon width={15} height={15} fill={eventExported ? '#4CAF50' : accent} />
                            <Text style={[{ color: eventExported ? '#4CAF50' : accent, fontSize: 12 }, bodyFontStyle]}>
                              {eventExported ? 'Exported!' : 'Export'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 6,
                              paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6,
                              borderWidth: 1, borderColor: accent, backgroundColor: `${accent}1A`,
                            }}
                            onPress={() => { clearEventLog(); setErrorLogEntries([]); logEvent('Event Log', 'Cleared'); }}
                          >
                            <TrashIcon width={15} height={15} fill={accent} />
                            <Text style={[{ color: accent, fontSize: 12 }, bodyFontStyle]}>Clear</Text>
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
              </View>

              {/* ── RAG Log ── */}
              <View style={[styles.versionContainer, { paddingHorizontal: 10 }]}>
                <TouchableOpacity onPress={toggleRagLog} activeOpacity={0.7}>
                  <View style={styles.versionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexShrink: 1 }}>
                        <BenderIcon width={24} height={24} fill="#7B8D9E" />
                        <Text style={[styles.versionText, { flexShrink: 1 }, titleFontStyle]}>LLM Log</Text>
                      </View>
                    <Animated.View style={{ transform: [{ rotate: animations['ragLog']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                      <Text style={styles.versionArrow}>▶</Text>
                    </Animated.View>
                  </View>
                </TouchableOpacity>
                {ragLogExpanded && (
                  <View style={[styles.versionContent, { paddingLeft: 0, paddingRight: 0 }]}>
                    {/* Action buttons */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                          minWidth: 95, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6,
                          borderWidth: 1, borderColor: ragCopied ? '#4CAF50' : accent,
                          backgroundColor: ragCopied ? 'rgba(76,175,80,0.1)' : `${accent}1A`,
                        }}
                        onPress={handleCopyRagLog}
                      >
                        <CopyIcon width={15} height={15} fill={ragCopied ? '#4CAF50' : accent} />
                        <Text style={[{ color: ragCopied ? '#4CAF50' : accent, fontSize: 12 }, bodyFontStyle]}>
                          {ragCopied ? 'Copied!' : 'Copy'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                          minWidth: 95, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6,
                          borderWidth: 1,
                          borderColor: ragExported ? '#4CAF50' : accent,
                          backgroundColor: ragExported ? 'rgba(76,175,80,0.1)' : `${accent}1A`,
                        }}
                        onPress={handleExportRagLog}
                      >
                        <ExportIcon width={15} height={15} fill={ragExported ? '#4CAF50' : accent} />
                        <Text style={[{ color: ragExported ? '#4CAF50' : accent, fontSize: 12 }, bodyFontStyle]}>
                          {ragExported ? 'Exported!' : 'Export'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 6,
                          paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6,
                          borderWidth: 1, borderColor: accent, backgroundColor: `${accent}1A`,
                        }}
                        onPress={handleClearRagLog}
                      >
                        <TrashIcon width={15} height={15} fill={accent} />
                        <Text style={[{ color: accent, fontSize: 12 }, bodyFontStyle]}>Clear</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Index Build Summary — collapsible, collapsed by default */}
                    <View style={[styles.versionContainer, { marginBottom: 8 }]}>
                      <TouchableOpacity
                        onPress={() => setIndexBuildExpanded(prev => !prev)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.versionHeader}>
                          <View style={{ flex: 1 }}>
                            <CardIconTitle icon={<BadgeInfoIcon size={18} color="#26C6DA" />} title="RAG Index Build" styles={styles} />
                            <Text style={[{ fontSize: 10, color: '#888', marginTop: 2, marginLeft: 28 }, bodyFontStyle]}>
                              Used for Local LLM only
                            </Text>
                          </View>
                          <Text style={{ fontSize: 10, color: '#999' }}>{indexBuildExpanded ? '▼' : '▶'}</Text>
                        </View>
                      </TouchableOpacity>
                      {indexBuildExpanded && (
                        ragLog.indexBuild ? (
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
                              onPress={() => setRagChunksExpanded(prev => !prev)}
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
                        )
                      )}
                    </View>

                    {/* Retrieval entries — chronological order (oldest first) */}
                    {ragLog.retrievals.length === 0 ? (
                      <Text style={[styles.debugMetaValue, { paddingHorizontal: 12, paddingVertical: 8 }]}>No retrievals recorded yet.</Text>
                    ) : (
                      ragLog.retrievals.slice().reverse().map((entry, idx) => {
                        const promptNumber = idx + 1;
                        if (!ragRetrievalAnims[entry.id]) ragRetrievalAnims[entry.id] = { rotation: new Animated.Value(0) };
                        const isOpen = expandedRetrievals[entry.id];
                        const usedCloud = entry.responseSource === 'cloud';
                        const isLocalOpen = entry.id in entryLocalExpanded ? entryLocalExpanded[entry.id] : !usedCloud;
                        const isCloudOpen = entry.id in entryCloudExpanded ? entryCloudExpanded[entry.id] : usedCloud;
                        const isResponseOpen = entry.id in entryResponseExpanded ? entryResponseExpanded[entry.id] : true;
                        const sourceBadgeColor = usedCloud ? '#4FC3F7' : '#FF9800';
                        const sourceBadgeLabel = usedCloud ? 'Cloud LLM' : 'Local LLM';
                        return (
                          <View
                            key={entry.id}
                            style={[styles.versionContainer, { marginBottom: 6 }]}
                          >
                            <TouchableOpacity
                              onPress={() => toggleRetrieval(entry.id)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.versionHeader}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <Text style={[{ fontSize: 12, color: accent, fontWeight: '700' }, bodyFontStyle]}>
                                      Prompt {promptNumber}
                                    </Text>
                                    <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: `${sourceBadgeColor}1A`, borderWidth: 1, borderColor: `${sourceBadgeColor}55` }}>
                                      <Text style={[{ fontSize: 9, color: sourceBadgeColor, fontWeight: '700' }, bodyFontStyle]}>{sourceBadgeLabel}</Text>
                                    </View>
                                  </View>
                                  <Text style={[{ fontSize: 13, color: '#E0E0E0', fontWeight: '600' }, bodyFontStyle]}>
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
                            </TouchableOpacity>
                            {isOpen && (
                              <View style={{ paddingTop: 8 }}>

                                {/* ── Local LLM section ── */}
                                <View style={{ marginBottom: 8, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,152,0,0.2)', overflow: 'hidden' }}>
                                  <TouchableOpacity
                                    onPress={() => setEntryLocalExpanded(prev => ({ ...prev, [entry.id]: !isLocalOpen }))}
                                    activeOpacity={0.7}
                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: 'rgba(255,152,0,0.06)' }}
                                  >
                                    <Text style={[{ fontSize: 12, color: '#FF9800', fontWeight: '700', flex: 1 }, bodyFontStyle]}>Local LLM</Text>
                                    {!usedCloud && (
                                      <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, backgroundColor: 'rgba(76,175,80,0.15)', marginRight: 6 }}>
                                        <Text style={[{ fontSize: 8, color: '#4CAF50', fontWeight: '700' }, bodyFontStyle]}>USED</Text>
                                      </View>
                                    )}
                                    <Text style={{ fontSize: 10, color: '#FF9800' }}>{isLocalOpen ? '▼' : '▶'}</Text>
                                  </TouchableOpacity>
                                  {isLocalOpen && (
                                    <View style={{ padding: 8 }}>
                                      {usedCloud ? (
                                        <Text style={[{ fontSize: 11, color: '#777', fontStyle: 'italic' }, bodyFontStyle]}>Not used for this prompt</Text>
                                      ) : (
                                        <>
                                          {entry.noIndex && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, marginBottom: 8, borderRadius: 6, backgroundColor: 'rgba(255,152,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,152,0,0.3)' }}>
                                              <BadgeWarningIcon size={16} color="#FF9800" />
                                              <Text style={[{ fontSize: 11, color: '#FF9800' }, bodyFontStyle]}>RAG index was not ready — no chunks retrieved</Text>
                                            </View>
                                          )}
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
                                          <TouchableOpacity
                                            onPress={() => setRagScoredChunksExpanded(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                                            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 4 }}
                                            activeOpacity={0.7}
                                          >
                                            <Text style={[{ fontSize: 11, color: '#999', flex: 1 }, bodyFontStyle]}>
                                              All chunks scored ({entry.allScoredChunks?.length ?? 0})
                                            </Text>
                                            <Text style={{ fontSize: 10, color: '#999' }}>{ragScoredChunksExpanded[entry.id] ? '▼' : '▶'}</Text>
                                          </TouchableOpacity>
                                          {ragScoredChunksExpanded[entry.id] && entry.allScoredChunks?.map((c, i) => (
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
                                              {entry.selectedChunks.map((c, i) => {
                                                const chunkKey = `${entry.id}_${i}`;
                                                const isChunkOpen = !!ragSelectedChunkExpanded[chunkKey];
                                                return (
                                                  <TouchableOpacity
                                                    key={i}
                                                    onPress={() => setRagSelectedChunkExpanded(prev => ({ ...prev, [chunkKey]: !prev[chunkKey] }))}
                                                    activeOpacity={0.7}
                                                    style={{
                                                      marginBottom: 6, padding: 8, borderRadius: 6,
                                                      backgroundColor: 'rgba(38,198,218,0.06)',
                                                      borderWidth: 1, borderColor: 'rgba(38,198,218,0.2)',
                                                    }}
                                                  >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                      <Text style={[{ fontSize: 11, color: '#26C6DA', fontWeight: '700', flex: 1 }, bodyFontStyle]}>
                                                        {c.heading} (score {c.score.toFixed(4)}, {c.source})
                                                      </Text>
                                                      <Text style={{ fontSize: 10, color: '#26C6DA', marginLeft: 6 }}>{isChunkOpen ? '▼' : '▶'}</Text>
                                                    </View>
                                                    {isChunkOpen && (
                                                      <Text style={[{ fontSize: 10, color: '#BBB', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 4 }]} selectable>
                                                        {c.content}
                                                      </Text>
                                                    )}
                                                  </TouchableOpacity>
                                                );
                                              })}
                                            </>
                                          )}

                                          {/* Post-Processing */}
                                          {entry.postProcessing && (
                                            <View style={{ marginTop: 10 }}>
                                              <Text style={[{ fontSize: 11, color: '#CE93D8', fontWeight: '700', marginBottom: 4 }, bodyFontStyle]}>
                                                Post-Processing
                                              </Text>
                                              {entry.postProcessing.filtered?.length > 0 ? (
                                                <View style={{ marginBottom: 6, padding: 6, borderRadius: 4, backgroundColor: 'rgba(255,152,0,0.06)', borderWidth: 1, borderColor: 'rgba(255,152,0,0.2)' }}>
                                                  <Text style={[{ fontSize: 10, color: '#FFB74D', fontWeight: '600', marginBottom: 2 }, bodyFontStyle]}>
                                                    Filtered out ({entry.postProcessing.filtered.length}):
                                                  </Text>
                                                  {entry.postProcessing.filtered.map((f, fi) => (
                                                    <Text key={fi} style={[{ fontSize: 10, color: '#FFCC80' }, bodyFontStyle]}>
                                                      • {f.heading} — score {f.score.toFixed(4)} — {f.reason}
                                                    </Text>
                                                  ))}
                                                </View>
                                              ) : (
                                                <Text style={[{ fontSize: 10, color: '#777', marginBottom: 4 }, bodyFontStyle]}>No chunks filtered out</Text>
                                              )}
                                              {entry.postProcessing.crossRefMerges?.length > 0 && (
                                                <View style={{ marginBottom: 6, padding: 6, borderRadius: 4, backgroundColor: 'rgba(206,147,216,0.06)', borderWidth: 1, borderColor: 'rgba(206,147,216,0.2)' }}>
                                                  <Text style={[{ fontSize: 10, color: '#CE93D8', fontWeight: '600', marginBottom: 2 }, bodyFontStyle]}>
                                                    Cross-ref merges ({entry.postProcessing.crossRefMerges.length}):
                                                  </Text>
                                                  {entry.postProcessing.crossRefMerges.map((m, mi) => (
                                                    <Text key={mi} style={[{ fontSize: 10, color: '#E1BEE7' }, bodyFontStyle]}>
                                                      • {m.from.join(' + ')} — {m.reason}
                                                    </Text>
                                                  ))}
                                                </View>
                                              )}
                                              {entry.postProcessing.parentMerges?.length > 0 && (
                                                <View style={{ marginBottom: 6, padding: 6, borderRadius: 4, backgroundColor: 'rgba(129,212,250,0.06)', borderWidth: 1, borderColor: 'rgba(129,212,250,0.2)' }}>
                                                  <Text style={[{ fontSize: 10, color: '#81D4FA', fontWeight: '600', marginBottom: 2 }, bodyFontStyle]}>
                                                    Same-parent merges ({entry.postProcessing.parentMerges.length}):
                                                  </Text>
                                                  {entry.postProcessing.parentMerges.map((m, mi) => (
                                                    <Text key={mi} style={[{ fontSize: 10, color: '#B3E5FC' }, bodyFontStyle]}>
                                                      • [{m.parent}] {m.merged.join(' + ')}
                                                    </Text>
                                                  ))}
                                                </View>
                                              )}
                                              <Text style={[{ fontSize: 10, color: '#CE93D8', fontWeight: '600' }, bodyFontStyle]}>
                                                Final chunks → LLM: {entry.postProcessing.finalCount}
                                              </Text>
                                            </View>
                                          )}

                                          {/* Sentence Extraction */}
                                          {entry.sentenceExtraction?.length > 0 && (
                                            <>
                                              <TouchableOpacity
                                                onPress={() => setEntrySentenceExpanded(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                                                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 4 }}
                                                activeOpacity={0.7}
                                              >
                                                <Text style={[{ fontSize: 11, color: '#999', flex: 1 }, bodyFontStyle]}>
                                                  Sentence Extraction ({entry.sentenceExtraction.length} chunks)
                                                </Text>
                                                <Text style={{ fontSize: 10, color: '#999' }}>{entrySentenceExpanded[entry.id] ? '▼' : '▶'}</Text>
                                              </TouchableOpacity>
                                              {entrySentenceExpanded[entry.id] && entry.sentenceExtraction.map((se, i) => (
                                                <View key={i} style={{ marginBottom: 6, padding: 6, borderRadius: 4, backgroundColor: 'rgba(129,212,250,0.06)', borderWidth: 1, borderColor: 'rgba(129,212,250,0.2)' }}>
                                                  <Text style={[{ fontSize: 11, color: '#81D4FA', fontWeight: '600', marginBottom: 2 }, bodyFontStyle]}>
                                                    Chunk {i + 1}: "{se.heading}" ({se.originalChars} → {se.extractedChars} chars)
                                                  </Text>
                                                  {se.sentences?.map((s, si) => {
                                                    const tag = s.score === '∞' ? 'H' : (s.kept ? '✓' : '✗');
                                                    const tagColor = s.score === '∞' ? '#81D4FA' : (s.kept ? '#4CAF50' : '#666');
                                                    return (
                                                      <Text key={si} style={[{ fontSize: 10, color: tagColor }, bodyFontStyle]}>
                                                        [{tag}] "{s.text.substring(0, 80)}{s.text.length > 80 ? '…' : ''}" (score: {s.score})
                                                      </Text>
                                                    );
                                                  })}
                                                </View>
                                              ))}
                                            </>
                                          )}

                                          {/* Final extracted/merged chunks */}
                                          {entry.sentenceExtraction?.length > 0 && (
                                            <>
                                              <TouchableOpacity
                                                onPress={() => setEntryFinalChunksExpanded(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                                                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 4 }}
                                                activeOpacity={0.7}
                                              >
                                                <Text style={[{ fontSize: 11, color: '#999', flex: 1 }, bodyFontStyle]}>
                                                  Final extracted chunks ({entry.sentenceExtraction.length})
                                                </Text>
                                                <Text style={{ fontSize: 10, color: '#999' }}>{entryFinalChunksExpanded[entry.id] ? '▼' : '▶'}</Text>
                                              </TouchableOpacity>
                                              {entryFinalChunksExpanded[entry.id] && entry.sentenceExtraction.map((se, i) => (
                                                <View key={i} style={{ marginBottom: 6, padding: 8, borderRadius: 6, backgroundColor: 'rgba(38,198,218,0.06)', borderWidth: 1, borderColor: 'rgba(38,198,218,0.2)' }}>
                                                  <Text style={[{ fontSize: 11, color: '#26C6DA', fontWeight: '700' }, bodyFontStyle]}>
                                                    {se.heading} ({se.extractedChars} chars)
                                                  </Text>
                                                  {se.extractedContent && (
                                                    <Text style={[{ fontSize: 10, color: '#BBB', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 4 }]} selectable>
                                                      {se.extractedContent}
                                                    </Text>
                                                  )}
                                                </View>
                                              ))}
                                            </>
                                          )}
                                        </>
                                      )}
                                    </View>
                                  )}
                                </View>

                                {/* ── Cloud LLM section ── */}
                                <View style={{ marginBottom: 8, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(79,195,247,0.2)', overflow: 'hidden' }}>
                                  <TouchableOpacity
                                    onPress={() => setEntryCloudExpanded(prev => ({ ...prev, [entry.id]: !isCloudOpen }))}
                                    activeOpacity={0.7}
                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: 'rgba(79,195,247,0.06)' }}
                                  >
                                    <Text style={[{ fontSize: 12, color: '#4FC3F7', fontWeight: '700', flex: 1 }, bodyFontStyle]}>Cloud LLM</Text>
                                    {usedCloud && (
                                      <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, backgroundColor: 'rgba(76,175,80,0.15)', marginRight: 6 }}>
                                        <Text style={[{ fontSize: 8, color: '#4CAF50', fontWeight: '700' }, bodyFontStyle]}>USED</Text>
                                      </View>
                                    )}
                                    <Text style={{ fontSize: 10, color: '#4FC3F7' }}>{isCloudOpen ? '▼' : '▶'}</Text>
                                  </TouchableOpacity>
                                  {isCloudOpen && (
                                    <View style={{ padding: 8 }}>
                                      {usedCloud ? (
                                        <>
                                          {[
                                            ...(entry.totalContextChars != null ? [{ label: 'Context → LLM', value: `${entry.totalContextChars.toLocaleString()} chars` }] : []),
                                            ...(entry.promptLength != null ? [{ label: 'Prompt length', value: `${entry.promptLength.toLocaleString()} chars` }] : []),
                                            ...(entry.modelName ? [{ label: 'Model', value: entry.modelName }] : []),
                                            ...(entry.cloudResponseTimeMs != null ? [{ label: 'Response time', value: `${entry.cloudResponseTimeMs.toLocaleString()}ms` }] : []),
                                          ].map(({ label, value }) => (
                                            <View key={label} style={styles.debugMetaRow}>
                                              <Text style={[styles.debugMetaLabel, bodyFontStyle]}>{label}</Text>
                                              <Text style={styles.debugMetaValue}>{value}</Text>
                                            </View>
                                          ))}
                                        </>
                                      ) : (
                                        <>
                                          <View style={styles.debugMetaRow}>
                                            <Text style={[styles.debugMetaLabel, bodyFontStyle]}>Fallback Reason</Text>
                                            <Text style={[styles.debugMetaValue, { color: '#CF6679' }]}>
                                              {entry.cloudFallbackReason || 'Not used'}
                                            </Text>
                                          </View>
                                        </>
                                      )}
                                      <View style={[styles.debugMetaRow, { marginTop: usedCloud ? 0 : 4 }]}>
                                        <Text style={[styles.debugMetaLabel, bodyFontStyle]}>Last Cloud Response</Text>
                                        <Text style={[styles.debugMetaValue, { color: cloudLlmStatus.lastCloudResponse ? '#4CAF50' : '#888' }]}>
                                          {cloudLlmStatus.lastCloudResponse ?? '—'}
                                        </Text>
                                      </View>
                                      <View style={styles.debugMetaRow}>
                                        <Text style={[styles.debugMetaLabel, bodyFontStyle]}>Fallback Count</Text>
                                        <Text style={[styles.debugMetaValue, { color: (cloudLlmStatus.fallbackCount ?? 0) > 0 ? '#FFC107' : '#888' }]}>
                                          {cloudLlmStatus.fallbackCount ?? 0}
                                        </Text>
                                      </View>
                                    </View>
                                  )}
                                </View>

                                {/* ── AI Response (collapsible, expanded by default) ── */}
                                {entry.aiResponse != null && (
                                  <View style={{ marginBottom: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(76,175,80,0.2)', overflow: 'hidden' }}>
                                    <TouchableOpacity
                                      onPress={() => setEntryResponseExpanded(prev => ({ ...prev, [entry.id]: !isResponseOpen }))}
                                      activeOpacity={0.7}
                                      style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: 'rgba(76,175,80,0.06)' }}
                                    >
                                      <Text style={[{ fontSize: 12, color: '#66BB6A', fontWeight: '700', flex: 1 }, bodyFontStyle]}>AI Response</Text>
                                      {entry.responseSource && (
                                        <Text style={[{ fontSize: 10, color: '#888', marginRight: 6 }, bodyFontStyle]}>
                                          {entry.responseSource}{entry.modelName ? ` (${entry.modelName})` : ''}
                                        </Text>
                                      )}
                                      <Text style={{ fontSize: 10, color: '#66BB6A' }}>{isResponseOpen ? '▼' : '▶'}</Text>
                                    </TouchableOpacity>
                                    {isResponseOpen && (
                                      <View style={{ padding: 8 }}>
                                        <Text style={[{ fontSize: 11, color: '#C8E6C9', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]} selectable>
                                          {entry.aiResponse}
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            </CollapsibleSection>
            </Animated.View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
