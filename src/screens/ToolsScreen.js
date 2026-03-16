/**
 * Tools tab: expandable sections for calculators and utilities.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TextInput, Modal, TouchableOpacity, Platform, Keyboard, InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HEADER_HEIGHT } from '../styles';
import { useTheme } from '../context/ThemeContext';
import CollapsibleSection, { DEFAULT_SECTION_EXPANDED } from '../components/CollapsibleSection';
import CrownIcon from '../../assets/icons/crown.svg';
import PlayersIcon from '../../assets/icons/players.svg';
import NailsIcon from '../../assets/icons/about.svg';
import UprisingIcon from '../../assets/icons/uprising.svg';
import StatsIcon from '../../assets/icons/stats.svg';
import NailIcon from '../../assets/icons/nail.svg';
import MinusIcon from '../../assets/icons/minus.svg';
import PlusIcon from '../../assets/icons/plus.svg';
import TrashIcon from '../../assets/icons/trash.svg';

const SECTION_KEYS = { NAIL_CALC: 'nailCalc', GAME_STAT_TRACKER: 'gameStatTracker' };
const GOLDEN_NAILS_PLAYERS_KEY = '@lnl_golden_nails_players';

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
  const { accent, titleFontStyle, bodyFontStyle } = useTheme();
  const [sectionsExpanded, setSectionsExpanded] = useState({
    [SECTION_KEYS.NAIL_CALC]: DEFAULT_SECTION_EXPANDED,
    [SECTION_KEYS.GAME_STAT_TRACKER]: DEFAULT_SECTION_EXPANDED,
  });
  const [playerCountInput, setPlayerCountInput] = useState(ZWSP);
  const [goldenNailPlayers, setGoldenNailPlayers] = useState([]);
  const [addPlayerModalVisible, setAddPlayerModalVisible] = useState(false);
  const [addPlayerName, setAddPlayerName] = useState('');
  const addPlayerInputRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(GOLDEN_NAILS_PLAYERS_KEY).then((raw) => {
      if (raw != null) {
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return;
          const normalized = parsed.map((item) => {
            if (typeof item === 'string') return { name: item, goldNails: 0 };
            if (item != null && typeof item.name === 'string') return { name: item.name, goldNails: Number(item.goldNails) || 0 };
            return null;
          }).filter(Boolean);
          setGoldenNailPlayers(normalized);
        } catch (_) {}
      }
    });
  }, []);

  useEffect(() => {
    if (!addPlayerModalVisible || Platform.OS !== 'android') return;
    let timeoutId;
    const task = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => addPlayerInputRef.current?.focus(), 150);
    });
    return () => {
      task.cancel();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [addPlayerModalVisible]);

  useEffect(() => {
    if (goldenNailPlayers.length === 0) return;
    AsyncStorage.setItem(GOLDEN_NAILS_PLAYERS_KEY, JSON.stringify(goldenNailPlayers));
  }, [goldenNailPlayers]);

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

  const openAddPlayerModal = () => {
    setAddPlayerName('');
    setAddPlayerModalVisible(true);
  };

  const closeAddPlayerModal = () => {
    setAddPlayerModalVisible(false);
    setAddPlayerName('');
  };

  const handleAddPlayerDone = () => {
    Keyboard.dismiss();
    const trimmed = addPlayerName.trim();
    if (trimmed !== '') {
      setGoldenNailPlayers((prev) => [...prev, { name: trimmed, goldNails: 0 }]);
    }
    closeAddPlayerModal();
  };

  const handleGoldenNailChange = (playerIndex, delta) => {
    setGoldenNailPlayers((prev) =>
      prev.map((p, i) => (i === playerIndex ? { ...p, goldNails: Math.max(0, p.goldNails + delta) } : p))
    );
  };

  const handleClearGoldenNailPlayers = () => {
    setGoldenNailPlayers([]);
    AsyncStorage.removeItem(GOLDEN_NAILS_PLAYERS_KEY);
  };

  return (
    <ScrollView
      style={[styles.scrollView, contentHeight != null && (Platform.OS === 'ios' ? { minHeight: contentHeight } : { height: contentHeight, minHeight: contentHeight })]}
      contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}
    >
      <View style={[styles.contentContainer, { paddingTop: contentPaddingTop ?? HEADER_HEIGHT }]}>
        <View style={Platform.OS === 'ios' ? styles.moreContainer : styles.aboutContainer}>
          <Text style={[styles.aboutTitle, titleFontStyle]} numberOfLines={1} adjustsFontSizeToFit>Tools</Text>

          <CollapsibleSection
            title="Nail Calculator"
            icon={<CrownIcon width={24} height={24} fill={INFO_BLUE} />}
            isExpanded={sectionsExpanded[SECTION_KEYS.NAIL_CALC]}
            onToggle={() => toggleSection(SECTION_KEYS.NAIL_CALC)}
            styles={styles}
            style={styles.aboutSectionWrapper}
          >
            <View style={styles.versionContainer}>
              <Text style={[styles.toolDescription, bodyFontStyle]}>
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
                    <Text style={[styles.toolInputLabel, bodyFontStyle]}>Players</Text>
                  </View>
                  <View style={styles.toolInputContainer}>
                    <TextInput
                      style={[styles.toolInput, bodyFontStyle]}
                      value={playerCountInput}
                      onChangeText={handlePlayerCountChange}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    {playerCountInput === ZWSP && (
                      <View style={styles.toolInputPlaceholder} pointerEvents="none">
                        <Text style={[styles.toolInputPlaceholderText, bodyFontStyle]}>e.g. 6</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.toolOutputBlock}>
                  <View style={styles.toolLabelWithIcon}>
                    <NailsIcon width={22} height={22} fill={NAILS_COLOR} style={styles.toolLabelIcon} />
                    <Text style={[styles.toolOutputLabel, bodyFontStyle]}>Lord nails</Text>
                  </View>
                  <View style={styles.toolOutputBox} pointerEvents="none">
                    <Text style={[styles.toolOutputValue, bodyFontStyle]}>
                      {lordNails != null ? lordNails : '—'}
                    </Text>
                  </View>
                </View>
                <View style={styles.toolOutputBlock}>
                  <View style={styles.toolLabelWithIcon}>
                    <UprisingIcon width={22} height={22} fill={UPRISING_COLOR} style={styles.toolLabelIcon} />
                    <Text style={[styles.toolOutputLabel, bodyFontStyle]}>Uprising nails</Text>
                  </View>
                  <View style={styles.toolOutputBox} pointerEvents="none">
                    <Text style={[styles.toolOutputValueUprising, bodyFontStyle]}>
                      {uprisingNails != null ? uprisingNails : '—'}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={[styles.toolQuickRefTitle, titleFontStyle]}>Quick Reference</Text>
              <View style={styles.toolTableWrap}>
                <View style={styles.toolTableRow}>
                  <View style={styles.toolTableLabelCell}>
                    <PlayersIcon width={22} height={22} fill={PLAYERS_COLOR} />
                  </View>
                  {Array.from({ length: QUICK_REF_COLUMNS }, (_, i) => i + QUICK_REF_PLAYERS_START).map((n) => (
                    <View key={`p-${n}`} style={styles.toolTableDataCell}>
                      <Text style={[styles.toolTableDataTextPlayers, bodyFontStyle]}>{n}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.toolTableRow}>
                  <View style={styles.toolTableLabelCell}>
                    <NailsIcon width={22} height={22} fill={NAILS_COLOR} />
                  </View>
                  {Array.from({ length: QUICK_REF_COLUMNS }, (_, i) => i + QUICK_REF_PLAYERS_START).map((n) => (
                    <View key={`l-${n}`} style={styles.toolTableDataCell}>
                      <Text style={[styles.toolTableDataTextNails, bodyFontStyle]}>{lordNailFormula(n)}</Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.toolTableRow, styles.toolTableRowLast]}>
                  <View style={styles.toolTableLabelCell}>
                    <UprisingIcon width={22} height={22} fill={UPRISING_COLOR} />
                  </View>
                  {Array.from({ length: QUICK_REF_COLUMNS }, (_, i) => i + QUICK_REF_PLAYERS_START).map((n) => (
                    <View key={`u-${n}`} style={styles.toolTableDataCell}>
                      <Text style={[styles.toolTableDataTextUprising, bodyFontStyle]}>{uprisingNailFormula(n)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </CollapsibleSection>

          <CollapsibleSection
            title="Golden Nails"
            icon={<NailIcon width={24} height={24} fill="#E8B923" />}
            isExpanded={sectionsExpanded[SECTION_KEYS.GAME_STAT_TRACKER]}
            onToggle={() => toggleSection(SECTION_KEYS.GAME_STAT_TRACKER)}
            styles={styles}
            style={styles.aboutSectionWrapper}
          >
            <View style={styles.versionContainer}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: accent,
                    backgroundColor: `${accent}1A`,
                  }}
                  onPress={openAddPlayerModal}
                >
                  <PlusIcon width={15} height={15} fill={accent} />
                  <Text style={[{ color: accent, fontSize: 12 }, bodyFontStyle]}>Add Player</Text>
                </TouchableOpacity>
                {goldenNailPlayers.length > 0 && (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: accent,
                      backgroundColor: `${accent}1A`,
                    }}
                    onPress={handleClearGoldenNailPlayers}
                  >
                    <TrashIcon width={15} height={15} fill={accent} />
                    <Text style={[{ color: accent, fontSize: 12 }, bodyFontStyle]}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.toolQuickRefTitle, titleFontStyle, { marginTop: 12 }]}>Players</Text>
              {goldenNailPlayers.length === 0 ? (
                <Text style={[styles.toolDescription, bodyFontStyle]}>No players added yet. Tap Add Player to add names.</Text>
              ) : (
                goldenNailPlayers.map((p, i) => (
                  <React.Fragment key={`player-${i}-${p.name}`}>
                    {i > 0 && (
                      <View style={{ height: 1, backgroundColor: `${accent}30`, marginVertical: 8 }} />
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 36 }}>
                      <Text style={[styles.toolDescription, bodyFontStyle, { flexShrink: 0, maxWidth: '35%' }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={[styles.toolDescription, bodyFontStyle, { flex: 1, textAlign: 'center' }]}>
                        {p.goldNails} Gold Nails
                      </Text>
                      <View style={{ flexDirection: 'row', flexShrink: 0, gap: 6, alignItems: 'center' }}>
                        {p.goldNails > 0 && (
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: accent,
                              backgroundColor: `${accent}1A`,
                            }}
                            onPress={() => handleGoldenNailChange(i, -1)}
                          >
                            <MinusIcon width={14} height={14} fill={accent} />
                            <NailIcon width={14} height={14} fill="#E8B923" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: accent,
                            backgroundColor: `${accent}1A`,
                          }}
                          onPress={() => handleGoldenNailChange(i, 1)}
                        >
                          <PlusIcon width={14} height={14} fill={accent} />
                          <NailIcon width={14} height={14} fill="#E8B923" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </React.Fragment>
                ))
              )}
            </View>
          </CollapsibleSection>
          <Modal
            visible={addPlayerModalVisible}
            transparent
            animationType="fade"
            onRequestClose={closeAddPlayerModal}
          >
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(18, 18, 18, 0.92)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
              activeOpacity={1}
              onPress={closeAddPlayerModal}
            >
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} scrollEnabled={false}>
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={{ backgroundColor: '#1E1E1E', borderRadius: 12, padding: 20, width: '100%', maxWidth: 320, borderWidth: 1, borderColor: `${accent}40` }}>
                  <Text style={[titleFontStyle, { fontSize: 18, marginBottom: 12, color: accent }]}>Enter Player's Name</Text>
                  <TextInput
                    ref={addPlayerInputRef}
                    style={[bodyFontStyle, { borderWidth: 1, borderColor: `${accent}50`, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, fontSize: 16, backgroundColor: '#2A2A2A', color: accent }]}
                    value={addPlayerName}
                    onChangeText={setAddPlayerName}
                    placeholder="Name"
                    placeholderTextColor={`${accent}99`}
                    autoFocus={Platform.OS === 'ios'}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: accent,
                      backgroundColor: `${accent}1A`,
                    }}
                    onPress={closeAddPlayerModal}
                  >
                    <Text style={[{ color: accent, fontSize: 12 }, bodyFontStyle]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: accent,
                      backgroundColor: accent,
                    }}
                    onPress={handleAddPlayerDone}
                  >
                    <Text style={[{ color: '#fff', fontSize: 12 }, bodyFontStyle]}>Done</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
              </ScrollView>
            </TouchableOpacity>
          </Modal>
        </View>
      </View>
    </ScrollView>
  );
}
