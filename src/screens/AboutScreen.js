/**
 * About screen: last sync date, support (Venmo), changelog from release_notes.md.
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { HEADER_HEIGHT } from '../styles';

const SETTINGS_KEYS = {
  EXPAND_RULES_DEFAULT: '@lnl_expand_rules_default',
  EXPAND_EXPANSIONS_DEFAULT: '@lnl_expand_expansions_default',
};
import { getVenmoPayUrl } from '../constants';
import CollapsibleSection, { DEFAULT_SECTION_EXPANDED } from '../components/CollapsibleSection';
import SyncedIcon from '../../assets/images/synced.svg';
import VenmoIcon from '../../assets/images/venmo.svg';
import ChangelogIcon from '../../assets/images/changelog.svg';
import SettingsIcon from '../../assets/images/settings.svg';
import InfoIcon from '../../assets/images/info.svg';
import RulesIcon from '../../assets/images/rules.svg';
import ExpansionsIcon from '../../assets/images/expansions.svg';
import DebugIcon from '../../assets/images/debug.svg';

const PAST_RELEASES_KEY = 'pastReleases';
const SECTION_KEYS = { RULES_SYNCED: 'rulesSynced', BUY_NAILS: 'buyNails', CHANGELOG: 'changelog', SETTINGS: 'settings', INFO: 'info', DEBUG: 'debug' };

const RULEBOOK_REPO_URL = 'https://github.com/seanKenkeremath/lords-and-lads';
const APP_REPO_URL = 'https://github.com/austenlux/Lords-Lads-Rules-App';

const VENMO_OPTIONS = [
  { amount: 1, label: '$1', image: require('../../assets/images/nail1.png') },
  { amount: 5, label: '$5', image: require('../../assets/images/nail2.png') },
  { amount: 20, label: '$20', image: require('../../assets/images/nail3.png') },
  { amount: 50, label: '$50', image: require('../../assets/images/nail4.png') },
  { amount: 100, label: '$100', image: require('../../assets/images/nail5.png') },
  { amount: 250, label: '$250', image: require('../../assets/images/nail6.png') },
];

export default function AboutScreen({
  lastFetchDate,
  styles,
  contentHeight,
  contentPaddingTop,
  isVoiceAssistantSupported = false,
  availableVoices = [],
  selectedVoiceId = null,
  onVoiceSelect,
}) {
  const [releaseNotes, setReleaseNotes] = useState([]);
  const [expandedVersions, setExpandedVersions] = useState({});
  const [pastReleasesExpanded, setPastReleasesExpanded] = useState(false);
  const [sectionsExpanded, setSectionsExpanded] = useState({
    [SECTION_KEYS.RULES_SYNCED]: DEFAULT_SECTION_EXPANDED,
    [SECTION_KEYS.BUY_NAILS]: DEFAULT_SECTION_EXPANDED,
    [SECTION_KEYS.CHANGELOG]: DEFAULT_SECTION_EXPANDED,
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
  const [voiceParentExpanded, setVoiceParentExpanded] = useState(false);
  const [voiceMetaExpanded, setVoiceMetaExpanded] = useState(false);
  const [expandedDebugVoices, setExpandedDebugVoices] = useState({});

  const VOICE_SECTION_MAX_HEIGHT = 1500;
  const EXPAND_DEFAULTS_MAX_HEIGHT = 300;
  const VOICE_PARENT_MAX_HEIGHT = 8000;
  const VOICE_META_MAX_HEIGHT = 12000;
  const DEBUG_VOICE_MAX_HEIGHT = 400;

  // Initialise animation pairs for settings cards and debug sections.
  useEffect(() => {
    if (!animations['expandDefaults']) {
      animations['expandDefaults'] = { rotation: new Animated.Value(0), maxHeight: new Animated.Value(0) };
    }
    if (!animations['voiceParent']) {
      animations['voiceParent'] = { rotation: new Animated.Value(0), maxHeight: new Animated.Value(0) };
    }
    if (!animations['voiceMeta']) {
      animations['voiceMeta'] = { rotation: new Animated.Value(0), maxHeight: new Animated.Value(0) };
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const [rules, expansions] = await Promise.all([
        AsyncStorage.getItem(SETTINGS_KEYS.EXPAND_RULES_DEFAULT),
        AsyncStorage.getItem(SETTINGS_KEYS.EXPAND_EXPANSIONS_DEFAULT),
      ]);
      setExpandRulesDefault(rules === 'true');
      setExpandExpansionsDefault(expansions === 'true');
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

  // ── Voice locale section animations ─────────────────────────────────────

  useEffect(() => {
    if (!availableVoices.length) return;
    availableVoices.forEach(({ language, id }) => {
      if (!voiceLocaleAnims[language]) {
        voiceLocaleAnims[language] = {
          rotation: new Animated.Value(0),
          maxHeight: new Animated.Value(0),
        };
      }
      if (!debugVoiceAnims[id]) {
        debugVoiceAnims[id] = {
          rotation: new Animated.Value(0),
          maxHeight: new Animated.Value(0),
        };
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
  const animateSection = (anim, toExpanded, expandedHeight, duration = 200) => {
    if (!anim) return;
    Animated.timing(anim.rotation, { toValue: toExpanded ? 1 : 0, duration, useNativeDriver: true }).start();
    Animated.timing(anim.maxHeight, { toValue: toExpanded ? expandedHeight : 0, duration, useNativeDriver: false }).start();
  };

  // Collapse every locale sub-section inside the Voice Assistant card.
  const collapseAllLocales = () => {
    Object.values(voiceLocaleAnims).forEach(a => animateSection(a, false, 0, 150));
    setExpandedLocales({});
  };

  // Collapse every individual voice card inside Voice Assistant Metadata.
  const collapseAllDebugVoices = () => {
    Object.values(debugVoiceAnims).forEach(a => animateSection(a, false, 0, 150));
    setExpandedDebugVoices({});
  };

  // Collapse every version block inside Past Releases.
  const collapseAllVersions = () => {
    Object.keys(expandedVersions).forEach(v => {
      if (animations[v]) animateSection(animations[v], false, 0, 150);
    });
    setExpandedVersions({});
  };

  // Collapse everything nested inside the Settings top-level section.
  const collapseSettingsChildren = () => {
    animateSection(animations['expandDefaults'], false, 0, 150);
    setExpandDefaultsExpanded(false);
    animateSection(animations['voiceParent'], false, 0, 150);
    setVoiceParentExpanded(false);
    collapseAllLocales();
  };

  // Collapse everything nested inside the Changelog top-level section.
  const collapseChangelogChildren = () => {
    animateSection(animations[PAST_RELEASES_KEY], false, 0, 150);
    setPastReleasesExpanded(false);
    collapseAllVersions();
  };

  // Collapse everything nested inside the Debug top-level section.
  const collapseDebugChildren = () => {
    animateSection(animations['voiceMeta'], false, 0, 150);
    setVoiceMetaExpanded(false);
    collapseAllDebugVoices();
  };

  // ── Toggle functions ─────────────────────────────────────────────────────

  const toggleAboutSection = (sectionKey) => {
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
    animateSection(voiceLocaleAnims[localeKey], isExpanded, VOICE_SECTION_MAX_HEIGHT);
    setExpandedLocales(prev => ({ ...prev, [localeKey]: isExpanded }));
  };

  const toggleExpandDefaults = () => {
    const isExpanded = !expandDefaultsExpanded;
    animateSection(animations['expandDefaults'], isExpanded, EXPAND_DEFAULTS_MAX_HEIGHT);
    setExpandDefaultsExpanded(isExpanded);
  };

  const toggleVoiceParent = () => {
    const isExpanded = !voiceParentExpanded;
    animateSection(animations['voiceParent'], isExpanded, VOICE_PARENT_MAX_HEIGHT);
    if (!isExpanded) collapseAllLocales();
    setVoiceParentExpanded(isExpanded);
  };

  const toggleVoiceMeta = () => {
    const isExpanded = !voiceMetaExpanded;
    animateSection(animations['voiceMeta'], isExpanded, VOICE_META_MAX_HEIGHT);
    if (!isExpanded) collapseAllDebugVoices();
    setVoiceMetaExpanded(isExpanded);
  };

  const toggleDebugVoice = (voiceId) => {
    const isExpanded = !expandedDebugVoices[voiceId];
    animateSection(debugVoiceAnims[voiceId], isExpanded, DEBUG_VOICE_MAX_HEIGHT);
    setExpandedDebugVoices(prev => ({ ...prev, [voiceId]: isExpanded }));
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
          animations[version.version] = {
            rotation: new Animated.Value(0),
            maxHeight: new Animated.Value(0),
          };
        });
        animations[PAST_RELEASES_KEY] = {
          rotation: new Animated.Value(0),
          maxHeight: new Animated.Value(0),
        };
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
        animations['v1.3.0'] = {
          rotation: new Animated.Value(0),
          maxHeight: new Animated.Value(0),
        };
        animations[PAST_RELEASES_KEY] = {
          rotation: new Animated.Value(0),
          maxHeight: new Animated.Value(0),
        };
      }
    };
    loadReleaseNotes();
  }, []);

  const toggleVersionExpansion = (version) => {
    const isExpanded = !expandedVersions[version];
    animateSection(animations[version], isExpanded, EXPANDED_MAX_HEIGHT);
    setExpandedVersions(prev => ({ ...prev, [version]: isExpanded }));
  };

  const togglePastReleasesExpansion = () => {
    const isExpanded = !pastReleasesExpanded;
    animateSection(animations[PAST_RELEASES_KEY], isExpanded, PAST_RELEASES_MAX_HEIGHT);
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

  const renderVersionBlock = (version, showLatestBadge = false) => (
    <TouchableOpacity
      key={version.version}
      style={styles.versionContainer}
      onPress={() => toggleVersionExpansion(version.version)}
      activeOpacity={0.7}
    >
      <View style={styles.versionHeader}>
        <View style={styles.versionRow}>
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
      <Animated.View
        style={[
          styles.versionContentContainer,
          {
            maxHeight: animations[version.version]?.maxHeight || 0,
            overflow: 'hidden',
          },
        ]}
        pointerEvents={expandedVersions[version.version] ? 'auto' : 'none'}
      >
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
      </Animated.View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[styles.scrollView, contentHeight != null && (Platform.OS === 'ios' ? { minHeight: contentHeight } : { height: contentHeight, minHeight: contentHeight })]}
      contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}
    >
      <View style={[styles.contentContainer, { paddingTop: contentPaddingTop ?? HEADER_HEIGHT }]}>
        <View style={styles.aboutContainer}>
          <Pressable onLongPress={() => setDebugVisible(v => !v)} delayLongPress={800}>
            <Text style={styles.aboutTitle}>About</Text>
          </Pressable>

          <CollapsibleSection
            title="Info"
            icon={<InfoIcon width={24} height={24} />}
            isExpanded={sectionsExpanded[SECTION_KEYS.INFO]}
            onToggle={() => toggleAboutSection(SECTION_KEYS.INFO)}
            styles={styles}
            style={styles.aboutSectionWrapper}
          >
            <View style={styles.versionContainer}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoText}>Rules loaded from official rulebook:</Text>
                <Pressable onPress={() => Linking.openURL(RULEBOOK_REPO_URL)}>
                  <Text style={styles.infoLink}>{RULEBOOK_REPO_URL}</Text>
                </Pressable>
              </View>
              <View style={[styles.infoBlock, styles.infoBlockLast]}>
                <Text style={styles.infoText}>This app's repo:</Text>
                <Pressable onPress={() => Linking.openURL(APP_REPO_URL)}>
                  <Text style={styles.infoLink}>{APP_REPO_URL}</Text>
                </Pressable>
              </View>
            </View>
          </CollapsibleSection>

          <CollapsibleSection
            title="Settings"
            icon={<SettingsIcon width={24} height={24} fill="#C45C26" />}
            isExpanded={sectionsExpanded[SECTION_KEYS.SETTINGS]}
            onToggle={() => toggleAboutSection(SECTION_KEYS.SETTINGS)}
            styles={styles}
            style={styles.aboutSectionWrapper}
          >
            {/* ── Card: Expand all sections by default ── */}
            <TouchableOpacity
              style={styles.versionContainer}
              onPress={toggleExpandDefaults}
              activeOpacity={0.7}
            >
              <View style={styles.versionHeader}>
                <View style={styles.versionRow}>
                  <Text style={styles.versionText}>Expand all sections by default</Text>
                </View>
                <Animated.View style={{ transform: [{ rotate: animations['expandDefaults']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                  <Text style={styles.versionArrow}>▶</Text>
                </Animated.View>
              </View>
              <Animated.View
                style={{ maxHeight: animations['expandDefaults']?.maxHeight || 0, overflow: 'hidden' }}
                pointerEvents={expandDefaultsExpanded ? 'auto' : 'none'}
              >
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
              </Animated.View>
            </TouchableOpacity>

            {/* ── Card: Voice Assistant ── */}
            {isVoiceAssistantSupported && voiceLocaleGroups.length > 0 && (
              <TouchableOpacity
                style={styles.versionContainer}
                onPress={toggleVoiceParent}
                activeOpacity={0.7}
              >
                <View style={styles.versionHeader}>
                  <View style={styles.versionRow}>
                    <Text style={styles.versionText}>Voice Assistant</Text>
                  </View>
                  <Animated.View style={{ transform: [{ rotate: animations['voiceParent']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                    <Text style={styles.versionArrow}>▶</Text>
                  </Animated.View>
                </View>
                <Animated.View
                  style={{ maxHeight: animations['voiceParent']?.maxHeight || 0, overflow: 'hidden' }}
                  pointerEvents={voiceParentExpanded ? 'auto' : 'none'}
                >
                  <View style={styles.versionContent}>
                    {voiceLocaleGroups.map(group => {
                      const groupHasSelection = group.voices.some(v => v.id === selectedVoiceId);
                      const localeAnim = voiceLocaleAnims[group.key];
                      const localeRotation = localeAnim?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
                      return (
                        <TouchableOpacity
                          key={group.key}
                          style={styles.versionContainer}
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
                          <Animated.View
                            style={{ maxHeight: localeAnim?.maxHeight || 0, overflow: 'hidden' }}
                            pointerEvents={expandedLocales[group.key] ? 'auto' : 'none'}
                          >
                            <View style={styles.versionContent}>
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
                          </Animated.View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Animated.View>
              </TouchableOpacity>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Rules last synced"
            icon={<SyncedIcon width={24} height={24} fill="#26C6DA" />}
            isExpanded={sectionsExpanded[SECTION_KEYS.RULES_SYNCED]}
            onToggle={() => toggleAboutSection(SECTION_KEYS.RULES_SYNCED)}
            styles={styles}
            style={styles.aboutSectionWrapper}
          >
            <View style={styles.versionContainer}>
              <Text style={styles.aboutTimestamp}>{lastFetchDate || 'Never'}</Text>
            </View>
          </CollapsibleSection>

          <CollapsibleSection
            title="Changelog"
            icon={<ChangelogIcon width={24} height={24} fill="#2E7D32" />}
            isExpanded={sectionsExpanded[SECTION_KEYS.CHANGELOG]}
            onToggle={() => toggleAboutSection(SECTION_KEYS.CHANGELOG)}
            styles={styles}
            style={styles.aboutSectionWrapper}
          >
            {latestRelease && renderVersionBlock(latestRelease, true)}

            {pastReleases.length > 0 && (
              <TouchableOpacity
                style={styles.versionContainer}
                onPress={togglePastReleasesExpansion}
                activeOpacity={0.7}
              >
                <View style={styles.versionHeader}>
                  <View style={styles.versionRow}>
                    <Text style={styles.versionText}>Past releases</Text>
                  </View>
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
                <Animated.View
                  style={[
                    styles.versionContentContainer,
                    {
                      maxHeight: animations[PAST_RELEASES_KEY]?.maxHeight || 0,
                      overflow: 'hidden',
                    },
                  ]}
                  pointerEvents={pastReleasesExpanded ? 'auto' : 'none'}
                >
                  <View style={styles.versionContent}>
                    {pastReleases.map((version) => renderVersionBlock(version, false))}
                  </View>
                </Animated.View>
              </TouchableOpacity>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Buy me some nails"
            icon={<VenmoIcon width={24} height={24} fill="#E8B923" />}
            isExpanded={sectionsExpanded[SECTION_KEYS.BUY_NAILS]}
            onToggle={() => toggleAboutSection(SECTION_KEYS.BUY_NAILS)}
            styles={styles}
            style={styles.aboutSectionWrapper}
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
                        <Image source={item.image} style={styles.nailImage} resizeMode="contain" />
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
                        <Image source={item.image} style={styles.nailImage} resizeMode="contain" />
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
              onToggle={() => toggleAboutSection(SECTION_KEYS.DEBUG)}
              styles={styles}
              style={styles.aboutSectionWrapper}
            >
              {/* ── Voice Assistant Metadata ── */}
              <TouchableOpacity
                style={styles.versionContainer}
                onPress={toggleVoiceMeta}
                activeOpacity={0.7}
              >
                <View style={styles.versionHeader}>
                  <View style={styles.versionRow}>
                    <Text style={styles.versionText}>Voice Assistant Metadata</Text>
                  </View>
                  <Animated.View style={{ transform: [{ rotate: animations['voiceMeta']?.rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) || '0deg' }] }}>
                    <Text style={styles.versionArrow}>▶</Text>
                  </Animated.View>
                </View>
                <Animated.View
                  style={{ maxHeight: animations['voiceMeta']?.maxHeight || 0, overflow: 'hidden' }}
                  pointerEvents={voiceMetaExpanded ? 'auto' : 'none'}
                >
                  <View style={styles.versionContent}>
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
                        { label: 'Features',         value: Array.isArray(voice.features) ? voice.features.join(', ') || '—' : '—' },
                      ];
                      return (
                        <TouchableOpacity
                          key={voice.id}
                          style={styles.versionContainer}
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
                          <Animated.View
                            style={{ maxHeight: voiceAnim?.maxHeight || 0, overflow: 'hidden' }}
                            pointerEvents={isOpen ? 'auto' : 'none'}
                          >
                            <View style={[styles.versionContent, { paddingTop: 4 }]}>
                              {metaRows.map(row => (
                                <View key={row.label} style={styles.debugMetaRow}>
                                  <Text style={styles.debugMetaLabel}>{row.label}</Text>
                                  <Text style={styles.debugMetaValue}>{row.value}</Text>
                                </View>
                              ))}
                            </View>
                          </Animated.View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Animated.View>
              </TouchableOpacity>
            </CollapsibleSection>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
