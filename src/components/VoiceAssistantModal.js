/**
 * VoiceAssistantModal
 *
 * A semi-transparent conversation panel that floats above the FAB.
 * Renders a live message list:
 *   user     – speech-to-text transcript, updating in real-time
 *   assistant – AI response, streaming in chunk-by-chunk with Markdown rendering
 *
 * Visible whenever there are messages (i.e. a session is active).
 * Dismissed via the FAB's X button, which calls stopAssistant() and clears messages.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WifiIcon from '../../assets/icons/wifi.svg';
import NoWifiIcon from './NoWifiIcon';
import { useTheme } from '../context/ThemeContext';

const BANNER_MAP = {
  light_male: require('../../assets/clinks/banners/light_male_banner.png'),
  tan_male: require('../../assets/clinks/banners/tan_male_banner.png'),
  dark_male: require('../../assets/clinks/banners/dark_male_banner.png'),
  light_female: require('../../assets/clinks/banners/light_female_banner.png'),
  tan_female: require('../../assets/clinks/banners/tan_female_banner.png'),
  dark_female: require('../../assets/clinks/banners/dark_female_banner.png'),
};

// ─────────────────────────────────────────────────── Constants ──

const BUBBLE_RADIUS = 16;

const BASE_MODAL_COLORS = {
  backdrop:        'rgba(18, 18, 18, 0.92)',
  assistantBubble: '#1E1E1E',
  assistantBorder: 'rgba(255, 255, 255, 0.08)',
  assistantText:   '#E0E0E0',
  userText:        '#E8DCFF',
  roleLabelAI:     '#888888',
};

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

const BASE_MD_STYLES = {
  body:       { color: BASE_MODAL_COLORS.assistantText, fontSize: 14, lineHeight: 22 },
  heading1:   { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  heading2:   { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  strong:     { fontWeight: '700', color: '#FFFFFF' },
  em:         { fontStyle: 'italic' },
  code_inline: { backgroundColor: '#2A2A2A', color: '#CF6679', borderRadius: 4, paddingHorizontal: 4 },
};

// ──────────────────────────────────────────────────── Helpers ──

const DOT_SEQUENCE = [1, 2, 3, 2]; // bounce: . .. ... .. . .. ...
const DOT_INTERVAL_MS = 400;

function ThinkingText({ style }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame(f => (f + 1) % DOT_SEQUENCE.length), DOT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  return <Text style={style}>{'Thinking' + '.'.repeat(DOT_SEQUENCE[frame])}</Text>;
}

function UserBubble({ text, bodyFontStyle, colors }) {
  const isEmpty = !text?.trim();
  return (
    <View style={styles.bubbleRow}>
      <View style={[styles.bubble, styles.userBubble, { backgroundColor: colors.userBubble, borderColor: colors.userBorder }]}>
        <Text style={[styles.roleLabel, { color: colors.roleLabelUser }, bodyFontStyle]}>You</Text>
        {isEmpty
          ? <Text style={[styles.listeningText, bodyFontStyle]}>Listening…</Text>
          : <Text style={[styles.userText, bodyFontStyle]}>{text}</Text>
        }
      </View>
    </View>
  );
}


function SourceIcon({ source, accent }) {
  if (!source || source === 'error') return null;
  if (source === 'cloud') {
    return <WifiIcon width={12} height={12} fill={accent} />;
  }
  return <NoWifiIcon width={12} height={12} wifiColor="#666666" xColor="#666666" />;
}

function AssistantBubble({ text, source, accent, bodyFontStyle, mdStyles }) {
  const isError = source === 'error';
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
      <View style={[styles.bubble, styles.assistantBubble, isError && styles.errorBubble]}>
        <View style={styles.assistantHeader}>
          <Text style={[styles.roleLabelAI, bodyFontStyle]}>Clinks</Text>
          <SourceIcon source={source} accent={accent} />
        </View>
        {text ? (
          isError ? (
            <Text style={[{ fontSize: 13, color: '#CF6679', lineHeight: 18 }, bodyFontStyle]}>{text}</Text>
          ) : (
            <Markdown style={mdStyles}>{text}</Markdown>
          )
        ) : (
          <ThinkingText style={[styles.thinkingText, bodyFontStyle]} />
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────── Component ──

// FAB height (60) + gap between FAB top edge and panel bottom
const FAB_SIZE    = 60;
const FAB_GAP     = 10;
// Small gap between panel top and the status bar
const TOP_MARGIN  = 8;
const STATUS_BAR  = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

export default function VoiceAssistantModal({ messages, isOpen, fabBottom = 96 }) {
  const [clinksAppearance, setClinksAppearance] = useState('light_male');
  const [panelWidth, setPanelWidth] = useState(0);
  useEffect(() => {
    AsyncStorage.getItem('@lnl_clinks_appearance').then(val => {
      if (val) setClinksAppearance(val);
    });
  }, [isOpen]);

  const { accent, titleFontStyle, bodyFontStyle } = useTheme();
  const rgb = hexToRgb(accent);
  const COLORS = {
    ...BASE_MODAL_COLORS,
    border:         `rgba(${rgb}, 0.25)`,
    userBubble:     `rgba(${rgb}, 0.12)`,
    userBorder:     `rgba(${rgb}, 0.5)`,
    roleLabelUser:  accent,
    cursor:         accent,
  };
  const mdStyles = {
    ...BASE_MD_STYLES,
    body: { ...BASE_MD_STYLES.body, ...bodyFontStyle },
    heading1: { ...BASE_MD_STYLES.heading1, color: accent, ...titleFontStyle },
    heading2: { ...BASE_MD_STYLES.heading2, color: accent, ...titleFontStyle },
    bullet_list_icon: { color: accent },
  };

  const listRef           = useRef(null);
  const mountOpacity      = useRef(new Animated.Value(0)).current;
  // Tracks whether the modal is mounted (visible or fading). Set to true
  // immediately when opening, and only set to false after the fade-out
  // animation fully completes — avoiding the _value internal API.
  const isMounted         = useRef(false);
  // Tracks the true pixel height of all rendered content so we can scroll to
  // the absolute bottom (past bottom padding) rather than just to the last item.
  const contentHeightRef  = useRef(0);

  // Fade in/out driven by isOpen, not by message count.
  useEffect(() => {
    if (isOpen) {
      isMounted.current = true;
      Animated.timing(mountOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      isMounted.current = false;
      Animated.timing(mountOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isOpen, mountOpacity]);

  // Scrolls to the absolute bottom of the content area, including any
  // bottom padding.  scrollToEnd() only targets the last *item*, so it stops
  // short of the padding.  scrollToOffset with the tracked content height
  // reliably reaches the final pixel.
  const scrollToBottom = () => {
    if (!listRef.current) return;
    const offset = contentHeightRef.current;
    if (offset > 0) {
      listRef.current.scrollToOffset({ offset, animated: false });
    } else {
      listRef.current.scrollToEnd({ animated: false });
    }
  };

  // Auto-scroll whenever messages change or the panel opens.
  // Three-pass to handle Markdown blocks that re-measure asynchronously.
  useEffect(() => {
    if (!isOpen) return;

    const raf = requestAnimationFrame(scrollToBottom);
    const t1  = setTimeout(scrollToBottom, 200);
    const t2  = setTimeout(scrollToBottom, 500);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isOpen, messages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Panel bottom anchored just above the FAB.
  // maxHeight caps growth so it never overflows above the status bar.
  const panelBottom = fabBottom + FAB_SIZE + FAB_GAP;
  const screenHeight = Dimensions.get('window').height;
  const maxPanelHeight = screenHeight - panelBottom - STATUS_BAR - TOP_MARGIN;

  return (
    <Animated.View
      style={[styles.container, { opacity: mountOpacity, bottom: panelBottom }]}
      pointerEvents={isOpen || isMounted.current ? 'box-none' : 'none'}
    >
      <View
        style={[styles.panel, { maxHeight: maxPanelHeight, borderColor: COLORS.border }]}
        pointerEvents={isOpen ? 'auto' : 'none'}
        onLayout={(e) => setPanelWidth(e.nativeEvent.layout.width)}
      >
        {panelWidth > 0 && (
          <Image
            source={BANNER_MAP[clinksAppearance] || BANNER_MAP.light_male}
            style={{
              width: panelWidth - 8,
              height: (panelWidth - 8) * (1152 / 3712),
              marginHorizontal: 4,
              borderTopLeftRadius: 19,
              borderTopRightRadius: 19,
            }}
            resizeMode="cover"
          />
        )}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={isOpen}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) =>
            item.role === 'user' ? (
              <UserBubble text={item.text} bodyFontStyle={bodyFontStyle} colors={COLORS} />
            ) : (
              <AssistantBubble text={item.text} source={item.source} accent={accent} bodyFontStyle={bodyFontStyle} mdStyles={mdStyles} />
            )
          }
          onContentSizeChange={(_, h) => {
            contentHeightRef.current = h;
            scrollToBottom();
          }}
        />
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────── Styles ──

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    // bottom set dynamically; grows upward to maxHeight
  },
  panel: {
    marginHorizontal: 12,
    backgroundColor: BASE_MODAL_COLORS.backdrop,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  listContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  bubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: BUBBLE_RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: BASE_MODAL_COLORS.assistantBubble,
    borderColor: BASE_MODAL_COLORS.assistantBorder,
    borderBottomLeftRadius: 4,
    minWidth: '70%',
    flexShrink: 0,
  },
  errorBubble: {
    borderColor: 'rgba(207,102,121,0.3)',
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  roleLabelAI: {
    fontSize: 11,
    fontWeight: '600',
    color: BASE_MODAL_COLORS.roleLabelAI,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  userText: {
    fontSize: 14,
    lineHeight: 22,
    color: BASE_MODAL_COLORS.userText,
  },
  thinkingText: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
  },
  listeningText: {
    fontSize: 14,
    color: '#888888',
    fontStyle: 'italic',
  },
});
