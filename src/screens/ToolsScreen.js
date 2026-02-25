/**
 * Tools tab: expandable sections for calculators and utilities.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, Platform } from 'react-native';
import { HEADER_HEIGHT } from '../styles';
import CollapsibleSection, { DEFAULT_SECTION_EXPANDED } from '../components/CollapsibleSection';
import CrownIcon from '../../assets/images/crown.svg';
import PlayersIcon from '../../assets/images/players.svg';
import NailsIcon from '../../assets/images/about.svg';
import UprisingIcon from '../../assets/images/uprising.svg';
import StatsIcon from '../../assets/images/stats.svg';

const SECTION_KEYS = { NAIL_CALC: 'nailCalc', GAME_STAT_TRACKER: 'gameStatTracker' };

/** Icon color matching About tab Info icon (info.svg stroke). */
const INFO_BLUE = '#5C7CFA';

/** Zero-width space: keeps one "character" in the field so the cursor shows when empty. */
const ZWSP = '\u200B';

/** Rulebook: number of center (Lord) nails = ceil(n/2 - 1) where n = players. */
function lordNailCount(players) {
  if (players == null || !Number.isInteger(players) || players < 3) return null;
  return Math.ceil(players / 2 - 1);
}

/** Raw formula for any n (e.g. Quick Reference table). */
function lordNailFormula(n) {
  return Math.ceil(n / 2 - 1);
}

/** Rulebook: number of Uprising nails = ceil(n/7) where n = players. */
function uprisingNailCount(players) {
  if (players == null || !Number.isInteger(players) || players < 3) return null;
  return Math.ceil(players / 7);
}

function uprisingNailFormula(n) {
  return Math.ceil(n / 7);
}

const QUICK_REF_COLUMNS = 8;
const QUICK_REF_PLAYERS_START = 3;

const PLAYERS_COLOR = '#3D7DD8';
const NAILS_COLOR = '#2E7D32';
const UPRISING_COLOR = '#CC4400';

export default function ToolsScreen({ styles, contentHeight, contentPaddingTop }) {
  const [sectionsExpanded, setSectionsExpanded] = useState({
    [SECTION_KEYS.NAIL_CALC]: DEFAULT_SECTION_EXPANDED,
    [SECTION_KEYS.GAME_STAT_TRACKER]: DEFAULT_SECTION_EXPANDED,
  });
  const [playerCountInput, setPlayerCountInput] = useState(ZWSP);

  const toggleSection = (key) => {
    setSectionsExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const rawInput = playerCountInput.replace(/\u200B/g, '');
  const lordNails = useMemo(() => {
    const n = parseInt(rawInput.trim(), 10);
    return lordNailCount(Number.isNaN(n) ? null : n);
  }, [rawInput]);

  const uprisingNails = useMemo(() => {
    const n = parseInt(rawInput.trim(), 10);
    return uprisingNailCount(Number.isNaN(n) ? null : n);
  }, [rawInput]);

  const handlePlayerCountChange = (text) => {
    setPlayerCountInput(text === '' ? ZWSP : text.replace(/\u200B/g, ''));
  };


  return (
    <ScrollView
      style={[styles.scrollView, contentHeight != null && (Platform.OS === 'ios' ? { minHeight: contentHeight } : { height: contentHeight, minHeight: contentHeight })]}
      contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}
    >
      <View style={[styles.contentContainer, { paddingTop: contentPaddingTop ?? HEADER_HEIGHT }]}>
        <View style={styles.aboutContainer}>
          <Text style={styles.aboutTitle}>Tools</Text>

          <CollapsibleSection
            title="Nail Calculator"
            icon={<CrownIcon width={24} height={24} fill="#E8B923" />}
            isExpanded={sectionsExpanded[SECTION_KEYS.NAIL_CALC]}
            onToggle={() => toggleSection(SECTION_KEYS.NAIL_CALC)}
            styles={styles}
            style={styles.aboutSectionWrapper}
          >
            <View style={styles.versionContainer}>
              <Text style={styles.toolDescription}>
                Number of Lord Nails = <Text style={styles.toolDescriptionCode}> ceil(n/2 − 1) </Text>
                {'\n'}
                Number of Uprising Nails = <Text style={styles.toolDescriptionCode}> ceil(n/7) </Text>
                {'\n'}
                <Text style={styles.toolDescriptionCode}> n </Text> = Number of players.
              </Text>
              <View style={styles.toolInputOutputRow}>
                <View style={styles.toolInputBlock}>
                  <View style={styles.toolLabelWithIcon}>
                    <PlayersIcon width={22} height={22} fill={PLAYERS_COLOR} style={styles.toolLabelIcon} />
                    <Text style={styles.toolInputLabel}>Players</Text>
                  </View>
                  <View style={styles.toolInputContainer}>
                    <TextInput
                      style={styles.toolInput}
                      value={playerCountInput}
                      onChangeText={handlePlayerCountChange}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    {playerCountInput === ZWSP && (
                      <View style={styles.toolInputPlaceholder} pointerEvents="none">
                        <Text style={styles.toolInputPlaceholderText}>e.g. 6</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.toolOutputBlock}>
                  <View style={styles.toolLabelWithIcon}>
                    <NailsIcon width={22} height={22} fill={NAILS_COLOR} style={styles.toolLabelIcon} />
                    <Text style={styles.toolOutputLabel}>Lord nails</Text>
                  </View>
                  <View style={styles.toolOutputBox} pointerEvents="none">
                    <Text style={styles.toolOutputValue}>
                      {lordNails != null ? lordNails : '—'}
                    </Text>
                  </View>
                </View>
                <View style={styles.toolOutputBlock}>
                  <View style={styles.toolLabelWithIcon}>
                    <UprisingIcon width={22} height={22} fill={UPRISING_COLOR} style={styles.toolLabelIcon} />
                    <Text style={styles.toolOutputLabel}>Uprising nails</Text>
                  </View>
                  <View style={styles.toolOutputBox} pointerEvents="none">
                    <Text style={styles.toolOutputValueUprising}>
                      {uprisingNails != null ? uprisingNails : '—'}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.toolQuickRefTitle}>Quick Reference</Text>
              <View style={styles.toolTableWrap}>
                <View style={styles.toolTableRow}>
                  <View style={styles.toolTableLabelCell}>
                    <PlayersIcon width={22} height={22} fill={PLAYERS_COLOR} />
                  </View>
                  {Array.from({ length: QUICK_REF_COLUMNS }, (_, i) => i + QUICK_REF_PLAYERS_START).map((n) => (
                    <View key={`p-${n}`} style={styles.toolTableDataCell}>
                      <Text style={styles.toolTableDataTextPlayers}>{n}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.toolTableRow}>
                  <View style={styles.toolTableLabelCell}>
                    <NailsIcon width={22} height={22} fill={NAILS_COLOR} />
                  </View>
                  {Array.from({ length: QUICK_REF_COLUMNS }, (_, i) => i + QUICK_REF_PLAYERS_START).map((n) => (
                    <View key={`l-${n}`} style={styles.toolTableDataCell}>
                      <Text style={styles.toolTableDataTextNails}>{lordNailFormula(n)}</Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.toolTableRow, styles.toolTableRowLast]}>
                  <View style={styles.toolTableLabelCell}>
                    <UprisingIcon width={22} height={22} fill={UPRISING_COLOR} />
                  </View>
                  {Array.from({ length: QUICK_REF_COLUMNS }, (_, i) => i + QUICK_REF_PLAYERS_START).map((n) => (
                    <View key={`u-${n}`} style={styles.toolTableDataCell}>
                      <Text style={styles.toolTableDataTextUprising}>{uprisingNailFormula(n)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </CollapsibleSection>

          <CollapsibleSection
            title="Game Stat Tracker"
            icon={<StatsIcon width={24} height={24} fill={INFO_BLUE} />}
            isExpanded={sectionsExpanded[SECTION_KEYS.GAME_STAT_TRACKER]}
            onToggle={() => toggleSection(SECTION_KEYS.GAME_STAT_TRACKER)}
            styles={styles}
            style={styles.aboutSectionWrapper}
          >
            <View style={styles.versionContainer}>
              <Text style={styles.toolDescription}>Coming soon.</Text>
            </View>
          </CollapsibleSection>
        </View>
      </View>
    </ScrollView>
  );
}
