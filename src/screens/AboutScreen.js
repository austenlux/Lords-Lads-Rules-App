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
import MaleIcon from '../../assets/images/male.svg';
import FemaleIcon from '../../assets/images/female.svg';

const PAST_RELEASES_KEY = 'pastReleases';
const SECTION_KEYS = { RULES_SYNCED: 'rulesSynced', BUY_NAILS: 'buyNails', CHANGELOG: 'changelog', SETTINGS: 'settings', INFO: 'info' };

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
  });
  const [expandRulesDefault, setExpandRulesDefault] = useState(false);
  const [expandExpansionsDefault, setExpandExpansionsDefault] = useState(false);
  const animations = useRef({}).current;
  const voiceLocaleAnims = useRef({}).current;
  const [expandedLocales, setExpandedLocales] = useState({});
  const [expandDefaultsExpanded, setExpandDefaultsExpanded] = useState(false);
  const [voiceParentExpanded, setVoiceParentExpanded] = useState(false);

  const VOICE_SECTION_MAX_HEIGHT = 1500;
  const EXPAND_DEFAULTS_MAX_HEIGHT = 300;
  const VOICE_PARENT_MAX_HEIGHT = 8000;

  // Initialise animation pairs for the two inner settings cards.
  useEffect(() => {
    if (!animations['expandDefaults']) {
      animations['expandDefaults'] = { rotation: new Animated.Value(0), maxHeight: new Animated.Value(0) };
    }
    if (!animations['voiceParent']) {
      animations['voiceParent'] = { rotation: new Animated.Value(0), maxHeight: new Animated.Value(0) };
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
    availableVoices.forEach(({ language }) => {
      if (!voiceLocaleAnims[language]) {
        voiceLocaleAnims[language] = {
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
  }, [availableVoices]);

  const toggleVoiceLocale = (localeKey) => {
    const isExpanded = !expandedLocales[localeKey];
    const anim = voiceLocaleAnims[localeKey];
    if (anim) {
      Animated.timing(anim.rotation, { toValue: isExpanded ? 1 : 0, duration: 200, useNativeDriver: true }).start();
      Animated.timing(anim.maxHeight, { toValue: isExpanded ? VOICE_SECTION_MAX_HEIGHT : 0, duration: 200, useNativeDriver: false }).start();
    }
    setExpandedLocales(prev => ({ ...prev, [localeKey]: isExpanded }));
  };

  const toggleExpandDefaults = () => {
    const isExpanded = !expandDefaultsExpanded;
    const anim = animations['expandDefaults'];
    if (anim) {
      Animated.timing(anim.rotation, { toValue: isExpanded ? 1 : 0, duration: 200, useNativeDriver: true }).start();
      Animated.timing(anim.maxHeight, { toValue: isExpanded ? EXPAND_DEFAULTS_MAX_HEIGHT : 0, duration: 200, useNativeDriver: false }).start();
    }
    setExpandDefaultsExpanded(isExpanded);
  };

  const toggleVoiceParent = () => {
    const isExpanded = !voiceParentExpanded;
    const anim = animations['voiceParent'];
    if (anim) {
      Animated.timing(anim.rotation, { toValue: isExpanded ? 1 : 0, duration: 200, useNativeDriver: true }).start();
      Animated.timing(anim.maxHeight, { toValue: isExpanded ? VOICE_PARENT_MAX_HEIGHT : 0, duration: 200, useNativeDriver: false }).start();
    }
    setVoiceParentExpanded(isExpanded);
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
    Animated.timing(animations[version].rotation, {
      toValue: isExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    Animated.timing(animations[version].maxHeight, {
      toValue: isExpanded ? EXPANDED_MAX_HEIGHT : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    setExpandedVersions((prev) => ({ ...prev, [version]: isExpanded }));
  };

  const toggleAboutSection = (sectionKey) => {
    setSectionsExpanded((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  const togglePastReleasesExpansion = () => {
    const isExpanded = !pastReleasesExpanded;
    const anim = animations[PAST_RELEASES_KEY];
    if (anim) {
      Animated.timing(anim.rotation, {
        toValue: isExpanded ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      Animated.timing(anim.maxHeight, {
        toValue: isExpanded ? PAST_RELEASES_MAX_HEIGHT : 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
    setPastReleasesExpanded(isExpanded);
  };

  const latestRelease = releaseNotes.length > 0 ? releaseNotes[0] : null;
  const pastReleases = releaseNotes.length > 1 ? releaseNotes.slice(1) : [];

  const voiceLocaleGroups = useMemo(() => {
    if (!availableVoices.length) return [];
    const map = {};
    availableVoices.forEach(v => {
      if (!map[v.language]) {
        map[v.language] = { key: v.language, display: v.localeDisplay, male: [], female: [], unknown: [] };
      }
      const gender = v.gender ?? 'unknown';
      map[v.language][gender]?.push(v) ?? map[v.language].unknown.push(v);
    });
    return Object.values(map).sort((a, b) => a.display.localeCompare(b.display));
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
          <Text style={styles.aboutTitle}>About</Text>

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
                      const allGroupVoices = [...(group.male ?? []), ...(group.female ?? []), ...(group.unknown ?? [])];
                      const groupHasSelection = allGroupVoices.some(v => v.id === selectedVoiceId);
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
                              {[
                                { key: 'male',    label: 'Male',   voices: group.male,    icon: <MaleIcon width={18} height={18} fill="#4FC3F7" /> },
                                { key: 'female',  label: 'Female', voices: group.female,  icon: <FemaleIcon width={18} height={18} fill="#F48FB1" /> },
                                { key: 'unknown', label: 'Other',  voices: group.unknown, icon: null },
                              ].map(section => {
                                if (!section.voices?.length) return null;
                                return (
                                  <View key={section.key}>
                                    <View style={styles.voiceGenderHeader}>
                                      {section.key === 'unknown' ? (
                                        <>
                                          <MaleIcon width={18} height={18} fill="#4FC3F7" style={{ marginRight: 2 }} />
                                          <FemaleIcon width={18} height={18} fill="#F48FB1" style={{ marginRight: 8 }} />
                                        </>
                                      ) : (
                                        <View style={{ marginRight: 8 }}>{section.icon}</View>
                                      )}
                                      <Text style={styles.voiceGenderLabel}>{section.label}</Text>
                                    </View>
                                    {section.voices.map((voice, index) => {
                                      const isSelected = voice.id === selectedVoiceId;
                                      const isLast = index === section.voices.length - 1;
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
        </View>
      </View>
    </ScrollView>
  );
}
