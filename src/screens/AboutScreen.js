/**
 * About screen: last sync date, support (Venmo), changelog from release_notes.md.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Animated,
  Linking,
  Image,
} from 'react-native';
import RNFS from 'react-native-fs';
import { HEADER_HEIGHT } from '../styles';
import { getVenmoPayUrl } from '../constants';
import CollapsibleSection, { DEFAULT_SECTION_EXPANDED } from '../components/CollapsibleSection';
import SyncedIcon from '../../assets/images/synced.svg';
import VenmoIcon from '../../assets/images/venmo.svg';
import ChangelogIcon from '../../assets/images/changelog.svg';

const PAST_RELEASES_KEY = 'pastReleases';
const SECTION_KEYS = { RULES_SYNCED: 'rulesSynced', BUY_NAILS: 'buyNails', CHANGELOG: 'changelog' };

const VENMO_OPTIONS = [
  { amount: 1, label: '$1', image: require('../../assets/images/nail1.png') },
  { amount: 5, label: '$5', image: require('../../assets/images/nail2.png') },
  { amount: 20, label: '$20', image: require('../../assets/images/nail3.png') },
  { amount: 50, label: '$50', image: require('../../assets/images/nail4.png') },
  { amount: 100, label: '$100', image: require('../../assets/images/nail5.png') },
  { amount: 250, label: '$250', image: require('../../assets/images/nail6.png') },
];

export default function AboutScreen({ lastFetchDate, styles }) {
  const [releaseNotes, setReleaseNotes] = useState([]);
  const [expandedVersions, setExpandedVersions] = useState({});
  const [pastReleasesExpanded, setPastReleasesExpanded] = useState(false);
  const [sectionsExpanded, setSectionsExpanded] = useState({
    [SECTION_KEYS.RULES_SYNCED]: DEFAULT_SECTION_EXPANDED,
    [SECTION_KEYS.BUY_NAILS]: DEFAULT_SECTION_EXPANDED,
    [SECTION_KEYS.CHANGELOG]: DEFAULT_SECTION_EXPANDED,
  });
  const animations = useRef({}).current;

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
        const content = await RNFS.readFileAssets('release_notes.md', 'utf8');
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
    <ScrollView style={styles.scrollView}>
      <View style={[styles.contentContainer, { paddingTop: HEADER_HEIGHT }]}>
        <View style={styles.aboutContainer}>
          <Text style={styles.aboutTitle}>About</Text>

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
        </View>
      </View>
    </ScrollView>
  );
}
