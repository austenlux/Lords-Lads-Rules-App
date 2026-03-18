/**
 * Tools tab: expandable sections for calculators and utilities.
 */
import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Pressable, Platform, LayoutAnimation, UIManager, Keyboard, Animated, Easing, KeyboardAvoidingView, Dimensions } from 'react-native';
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
import CloseIcon from '../../assets/icons/close.svg';
import EditIcon from '../../assets/icons/edit.svg';
import SaveIcon from '../../assets/icons/save.svg';
import FirstIcon from '../../assets/icons/first.svg';
import SecondIcon from '../../assets/icons/second.svg';
import ThirdIcon from '../../assets/icons/third.svg';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const GOLDEN_NAIL_ROW_HEIGHT = 72;
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
  const [selectedPlayerIdForDelete, setSelectedPlayerIdForDelete] = useState(null);
  const [editingPlayerId, setEditingPlayerId] = useState(null); // null | 'new' | player id
  const [editingPlayerName, setEditingPlayerName] = useState('');
  const previousOrderRef = useRef([]);
  const reorderAnimRef = useRef({});
  const scrollViewRef = useRef(null);
  const editingRowRefs = useRef({});
  const editingInputRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(GOLDEN_NAILS_PLAYERS_KEY).then((raw) => {
      if (raw != null) {
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return;
          const normalized = parsed.map((item, index) => {
            const base = Date.now() + index;
            if (typeof item === 'string') return { id: base, name: item, goldNails: 0 };
            if (item != null && typeof item.name === 'string') return { id: item.id ?? base, name: item.name, goldNails: Number(item.goldNails) || 0 };
            return null;
          }).filter(Boolean);
          setGoldenNailPlayers(normalized);
        } catch (_) {}
      }
    });
  }, []);

  useEffect(() => {
    if (goldenNailPlayers.length === 0) return;
    AsyncStorage.setItem(GOLDEN_NAILS_PLAYERS_KEY, JSON.stringify(goldenNailPlayers));
  }, [goldenNailPlayers]);

  // Focus the input once when editing starts — avoids autoFocus re-triggering on re-renders
  useEffect(() => {
    if (!editingPlayerId) return;
    const timer = setTimeout(() => editingInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [editingPlayerId]);

  // Scroll so the entire editing row (name + nails + buttons) clears the keyboard
  useEffect(() => {
    if (!editingPlayerId) return;
    const scrollToEditing = (e) => {
      if (editingPlayerId === 'new') {
        scrollViewRef.current?.scrollToEnd({ animated: true });
        return;
      }
      const rowRef = editingRowRefs.current[editingPlayerId];
      if (!rowRef || !scrollViewRef.current) return;
      const keyboardHeight = e?.endCoordinates?.height ?? 300;
      const screenHeight = Dimensions.get('window').height;
      // Available visible area above the keyboard (header already accounts for top)
      const visibleHeight = screenHeight - keyboardHeight - HEADER_HEIGHT;
      rowRef.measureLayout(
        scrollViewRef.current,
        (_x, rowY, _w, rowH) => {
          // Scroll so the row bottom + padding sits just above the keyboard
          const scrollY = Math.max(0, rowY + rowH + 24 - visibleHeight);
          scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
        },
        () => {}
      );
    };
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, scrollToEditing);
    return () => sub.remove();
  }, [editingPlayerId]);

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

  const handleStartAddPlayer = () => {
    setSelectedPlayerIdForDelete(null);
    setEditingPlayerId('new');
    setEditingPlayerName('');
  };

  const handleStartEditPlayer = (p) => {
    // Keep selectedPlayerIdForDelete so the long-press menu stays visible (Edit → Save)
    setEditingPlayerId(p.id);
    setEditingPlayerName(p.name);
  };

  const handleSavePlayer = () => {
    const name = editingPlayerName.trim();
    if (!name) return;
    if (editingPlayerId === 'new') {
      setGoldenNailPlayers((prev) => [...prev, { id: Date.now(), name, goldNails: 0 }]);
    } else {
      setGoldenNailPlayers((prev) =>
        prev.map((p) => (p.id === editingPlayerId ? { ...p, name } : p))
      );
    }
    setEditingPlayerId(null);
    setEditingPlayerName('');
    setSelectedPlayerIdForDelete(null);
    Keyboard.dismiss();
  };

  const handleCancelEdit = () => {
    setEditingPlayerId(null);
    setEditingPlayerName('');
    setSelectedPlayerIdForDelete(null);
    Keyboard.dismiss();
  };

  const handleGoldenNailChange = (playerId, delta) => {
    if (Platform.OS === 'android') {
      previousOrderRef.current = sortedPlayers.map((p) => p.id);
      setGoldenNailPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, goldNails: Math.max(0, p.goldNails + delta) } : p))
      );
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setGoldenNailPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, goldNails: Math.max(0, p.goldNails + delta) } : p))
      );
    }
  };

  const handleClearGoldenNailPlayers = () => {
    setGoldenNailPlayers([]);
    setEditingPlayerId(null);
    setEditingPlayerName('');
    setSelectedPlayerIdForDelete(null);
    AsyncStorage.removeItem(GOLDEN_NAILS_PLAYERS_KEY);
  };

  const handleDeleteGoldenNailPlayer = (playerId) => {
    setGoldenNailPlayers((prev) => prev.filter((p) => p.id !== playerId));
    setSelectedPlayerIdForDelete(null);
    if (editingPlayerId === playerId) {
      setEditingPlayerId(null);
      setEditingPlayerName('');
    }
  };

  const sortedPlayers = useMemo(
    () =>
      [...goldenNailPlayers].sort((a, b) => {
        const byNails = b.goldNails - a.goldNails;
        return byNails !== 0 ? byNails : a.name.localeCompare(b.name);
      }),
    [goldenNailPlayers]
  );

  // Must be after sortedPlayers declaration — dependency array is evaluated immediately
  useLayoutEffect(() => {
    if (Platform.OS !== 'android') return;
    if (sortedPlayers.length === 0) return;
    if (previousOrderRef.current.length === 0) {
      previousOrderRef.current = sortedPlayers.map((p) => p.id);
      return;
    }
    sortedPlayers.forEach((p, newIndex) => {
      const oldIndex = previousOrderRef.current.indexOf(p.id);
      if (oldIndex === -1 || oldIndex === newIndex) return;
      const anim = reorderAnimRef.current[p.id] ?? new Animated.Value(0);
      reorderAnimRef.current[p.id] = anim;
      anim.setValue((oldIndex - newIndex) * GOLDEN_NAIL_ROW_HEIGHT);
      Animated.timing(anim, {
        toValue: 0,
        duration: 280,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    });
    previousOrderRef.current = sortedPlayers.map((p) => p.id);
  }, [sortedPlayers]);

  const accentButtonStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: accent,
    backgroundColor: `${accent}1A`,
  };

  const accentFilledButtonStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: accent,
    backgroundColor: accent,
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={HEADER_HEIGHT}
    >
    <ScrollView
      ref={scrollViewRef}
      style={[styles.scrollView, contentHeight != null && { minHeight: contentHeight }]}
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
                  onPress={handleStartAddPlayer}
                >
                  <PlusIcon width={15} height={15} fill={accent} />
                  <Text style={[{ color: accent, fontSize: 12 }, bodyFontStyle]}>Player</Text>
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
              {goldenNailPlayers.length === 0 && editingPlayerId !== 'new' ? (
                <Text style={[styles.toolDescription, bodyFontStyle, { marginTop: 12 }]}>Add a player to begin</Text>
              ) : (
                <View style={{ marginTop: 14 }}>
                  {sortedPlayers.map((p, i) => {
                    const isEditing = editingPlayerId === p.id;
                    const saveDisabled = editingPlayerName.trim() === '' || editingPlayerName.trim() === p.name;
                    const rowContent = (
                      <>
                        {i > 0 && (
                          <View style={{ height: 1, backgroundColor: `${accent}30`, marginVertical: 8 }} />
                        )}
                        <View>
                          {/* Name row — TextInput when editing, Text otherwise */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
                            {i === 0 && <FirstIcon width={22} height={22} />}
                            {i === 1 && <SecondIcon width={22} height={22} />}
                            {i === 2 && <ThirdIcon width={22} height={22} />}
                            {isEditing ? (
                              <TextInput
                                ref={editingInputRef}
                                value={editingPlayerName}
                                onChangeText={setEditingPlayerName}
                                returnKeyType="done"
                                onSubmitEditing={saveDisabled ? undefined : handleSavePlayer}
                                style={[titleFontStyle, { fontSize: 22, color: accent, flex: 1, textAlign: 'center', padding: 0 }]}
                              />
                            ) : (
                              <Text style={[titleFontStyle, { fontSize: 22, color: accent }]} numberOfLines={1}>
                                {p.name}
                              </Text>
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={[bodyFontStyle, { fontSize: 16, color: '#FFFFFF', ...(Platform.OS === 'android' && { includeFontPadding: false }) }]}>
                              {p.goldNails} Gold Nails
                            </Text>
                          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
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
                                onPress={() => handleGoldenNailChange(p.id, -1)}
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
                              onPress={() => handleGoldenNailChange(p.id, 1)}
                            >
                              <PlusIcon width={14} height={14} fill={accent} />
                              <NailIcon width={14} height={14} fill="#E8B923" />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', alignItems: 'flex-start', gap: 4 }}>
                          {Array.from({ length: p.goldNails }, (_, k) => (
                            <NailIcon key={`nail-${p.id}-${k}`} width={20} height={20} fill="#E8B923" />
                          ))}
                        </View>
                      </View>
                    </>
                    );
                    const key = p.id;
                    // Long-press menu: Cancel | Edit | Delete (normal) or Cancel | Save (editing)
                    const longPressMenu = selectedPlayerIdForDelete === p.id ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <TouchableOpacity
                          style={accentButtonStyle}
                          onPress={handleCancelEdit}
                        >
                          <CloseIcon width={14} height={14} fill={accent} />
                          <Text style={[{ color: accent, fontSize: 12 }, bodyFontStyle]}>Cancel</Text>
                        </TouchableOpacity>
                        {isEditing ? (
                          <TouchableOpacity
                            style={[accentFilledButtonStyle, saveDisabled && { opacity: 0.4 }]}
                            onPress={handleSavePlayer}
                            disabled={saveDisabled}
                          >
                            <SaveIcon width={14} height={14} fill="#fff" />
                            <Text style={[{ color: '#fff', fontSize: 12 }, bodyFontStyle]}>Save</Text>
                          </TouchableOpacity>
                        ) : (
                          <>
                            <TouchableOpacity
                              style={accentButtonStyle}
                              onPress={() => handleStartEditPlayer(p)}
                            >
                              <EditIcon width={14} height={14} fill={accent} />
                              <Text style={[{ color: accent, fontSize: 12 }, bodyFontStyle]}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                paddingVertical: 6,
                                paddingHorizontal: 10,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: '#E53935',
                                backgroundColor: '#E539351A',
                              }}
                              onPress={() => handleDeleteGoldenNailPlayer(p.id)}
                            >
                              <TrashIcon width={14} height={14} fill="#E53935" />
                              <Text style={[{ color: '#E53935', fontSize: 12 }, bodyFontStyle]}>Delete</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    ) : null;
                    const rowWithLongPress = (
                      <Pressable onLongPress={editingPlayerId !== null ? undefined : () => setSelectedPlayerIdForDelete(p.id)}>
                        {rowContent}
                        {longPressMenu}
                      </Pressable>
                    );
                    if (Platform.OS === 'android') {
                      reorderAnimRef.current[p.id] = reorderAnimRef.current[p.id] ?? new Animated.Value(0);
                    }
                    return Platform.OS === 'android' ? (
                      <Animated.View
                        key={key}
                        ref={(r) => { editingRowRefs.current[p.id] = r; }}
                        style={{ transform: [{ translateY: reorderAnimRef.current[p.id] }] }}
                      >
                        {rowWithLongPress}
                      </Animated.View>
                    ) : (
                      <View
                        key={key}
                        ref={(r) => { editingRowRefs.current[p.id] = r; }}
                      >
                        {rowWithLongPress}
                      </View>
                    );
                  })}
                  {/* Inline new player row */}
                  {editingPlayerId === 'new' && (() => {
                    const saveDisabled = editingPlayerName.trim() === '';
                    return (
                      <View>
                        {sortedPlayers.length > 0 && (
                          <View style={{ height: 1, backgroundColor: `${accent}30`, marginVertical: 8 }} />
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                          <TextInput
                            ref={editingInputRef}
                            value={editingPlayerName}
                            onChangeText={setEditingPlayerName}
                            placeholder="Player name"
                            placeholderTextColor={`${accent}99`}
                            returnKeyType="done"
                            onSubmitEditing={saveDisabled ? undefined : handleSavePlayer}
                            style={[titleFontStyle, { fontSize: 22, color: accent, flex: 1, textAlign: 'center', padding: 0 }]}
                          />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                          <TouchableOpacity style={accentButtonStyle} onPress={handleCancelEdit}>
                            <CloseIcon width={14} height={14} fill={accent} />
                            <Text style={[{ color: accent, fontSize: 12 }, bodyFontStyle]}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[accentFilledButtonStyle, saveDisabled && { opacity: 0.4 }]}
                            onPress={handleSavePlayer}
                            disabled={saveDisabled}
                          >
                            <SaveIcon width={14} height={14} fill="#fff" />
                            <Text style={[{ color: '#fff', fontSize: 12 }, bodyFontStyle]}>Save</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })()}
                </View>
              )}
            </View>
          </CollapsibleSection>
        </View>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
