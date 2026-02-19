/**
 * Info / Settings screen: app info, last sync date, changelog from release_notes.md.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
} from 'react-native';
import RNFS from 'react-native-fs';

export default function InfoSettingsScreen({ lastFetchDate, styles }) {
  const [releaseNotes, setReleaseNotes] = useState([]);
  const [expandedVersions, setExpandedVersions] = useState({});
  const animations = useRef({}).current;
  const contentHeights = useRef({}).current;

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
            height: new Animated.Value(0),
          };
          const baseHeight = 100;
          const sectionHeight = version.sections.reduce(
            (acc, section) => acc + 30 + section.items.length * 20,
            0
          );
          const noteHeight = version.note ? 30 : 0;
          const padding = 20;
          contentHeights[version.version] = baseHeight + sectionHeight + noteHeight + padding;
        });
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
          height: new Animated.Value(0),
        };
        const baseHeight = 100;
        const sectionHeight = fallbackVersions[0].sections.reduce(
          (acc, section) => acc + 30 + section.items.length * 20,
          0
        );
        const noteHeight = fallbackVersions[0].note ? 30 : 0;
        const padding = 20;
        contentHeights['v1.3.0'] = baseHeight + sectionHeight + noteHeight + padding;
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
    Animated.timing(animations[version].height, {
      toValue: isExpanded ? contentHeights[version] : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    setExpandedVersions((prev) => ({ ...prev, [version]: isExpanded }));
  };

  return (
    <ScrollView style={styles.scrollView}>
      <View style={[styles.contentContainer, { paddingTop: StatusBar.currentHeight }]}>
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Lords & Lads</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Rules Last Synced</Text>
            <Text style={styles.infoValue}>{lastFetchDate || 'Never'}</Text>
          </View>
          <View style={styles.changelogContainer}>
            <Text style={styles.changelogTitle}>Changelog</Text>
            {releaseNotes.map((version, index) => (
              <View key={version.version} style={styles.versionContainer}>
                <TouchableOpacity
                  style={styles.versionHeader}
                  onPress={() => toggleVersionExpansion(version.version)}
                  activeOpacity={0.7}
                >
                  <View style={styles.versionRow}>
                    <Text style={styles.versionText}>{version.version}</Text>
                    <Text style={styles.versionDate}>{version.date}</Text>
                    {index === 0 && (
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
                </TouchableOpacity>
                <Animated.View
                  style={[
                    styles.versionContentContainer,
                    {
                      height: animations[version.version]?.height || 0,
                      overflow: 'hidden',
                    },
                  ]}
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
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
