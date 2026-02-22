/**
 * Tools tab: expandable sections for calculators and utilities.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TextInput } from 'react-native';
import { HEADER_HEIGHT } from '../styles';
import CollapsibleSection, { DEFAULT_SECTION_EXPANDED } from '../components/CollapsibleSection';
import CrownIcon from '../../assets/images/crown.svg';
import PlayersIcon from '../../assets/images/players.svg';
import NailsIcon from '../../assets/images/about.svg';

const SECTION_KEYS = { LORD_NAIL_CALC: 'lordNailCalc' };

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

const QUICK_REF_COLUMNS = 9;
const QUICK_REF_PLAYERS_START = 2;

export default function ToolsScreen({ styles }) {
  const [sectionsExpanded, setSectionsExpanded] = useState({
    [SECTION_KEYS.LORD_NAIL_CALC]: DEFAULT_SECTION_EXPANDED,
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

  const handlePlayerCountChange = (text) => {
    setPlayerCountInput(text === '' ? ZWSP : text.replace(/\u200B/g, ''));
  };


  return (
    <ScrollView style={styles.scrollView}>
      <View style={[styles.contentContainer, { paddingTop: HEADER_HEIGHT }]}>
        <View style={styles.aboutContainer}>
          <Text style={styles.aboutTitle}>Tools</Text>

          <CollapsibleSection
            title="Lord Nail Calculator"
            icon={<CrownIcon width={24} height={24} fill="#E8B923" />}
            isExpanded={sectionsExpanded[SECTION_KEYS.LORD_NAIL_CALC]}
            onToggle={() => toggleSection(SECTION_KEYS.LORD_NAIL_CALC)}
            styles={styles}
            style={styles.aboutSectionWrapper}
          >
            <View style={styles.versionContainer}>
              <Text style={styles.toolDescription}>
                Number of Lord Nails = <Text style={styles.toolDescriptionCode}> ceil(n/2 − 1) </Text>
                {'\n'}
                <Text style={styles.toolDescriptionCode}> n </Text> = Number of players.
              </Text>
              <View style={styles.toolInputOutputRow}>
                <View style={styles.toolInputBlock}>
                  <View style={styles.toolLabelWithIcon}>
                    <PlayersIcon width={18} height={18} fill="#E1E1E1" style={styles.toolLabelIcon} />
                    <Text style={styles.toolInputLabel}>Number of players</Text>
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
                    <NailsIcon width={18} height={18} fill="#E1E1E1" style={styles.toolLabelIcon} />
                    <Text style={styles.toolOutputLabel}>Lord nails</Text>
                  </View>
                  <Text style={styles.toolOutputValue}>
                    {lordNails != null ? lordNails : '—'}
                  </Text>
                </View>
              </View>

              <Text style={styles.toolQuickRefTitle}>Quick Reference</Text>
              <View style={styles.toolTableWrap}>
                <View style={styles.toolTableRow}>
                  <View style={styles.toolTableLabelCell}>
                    <PlayersIcon width={22} height={22} fill="#E1E1E1" />
                  </View>
                  {Array.from({ length: QUICK_REF_COLUMNS }, (_, i) => i + QUICK_REF_PLAYERS_START).map((n) => (
                    <View key={`p-${n}`} style={styles.toolTableDataCell}>
                      <Text style={styles.toolTableDataText}>{n}</Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.toolTableRow, styles.toolTableRowLast]}>
                  <View style={styles.toolTableLabelCell}>
                    <NailsIcon width={22} height={22} fill="#E1E1E1" />
                  </View>
                  {Array.from({ length: QUICK_REF_COLUMNS }, (_, i) => i + QUICK_REF_PLAYERS_START).map((n) => (
                    <View key={`l-${n}`} style={styles.toolTableDataCell}>
                      <Text style={styles.toolTableDataText}>{lordNailFormula(n)}</Text>
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
