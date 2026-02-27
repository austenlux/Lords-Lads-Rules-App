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

import React, { useRef, useEffect } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';

// ─────────────────────────────────────────────────── Constants ──

const BUBBLE_RADIUS = 16;

const COLORS = {
  backdrop:        'rgba(18, 18, 18, 0.92)',
  border:          'rgba(187, 134, 252, 0.25)',
  userBubble:      '#2D1F47',
  userBorder:      'rgba(187, 134, 252, 0.5)',
  userText:        '#E8DCFF',
  assistantBubble: '#1E1E1E',
  assistantBorder: 'rgba(255, 255, 255, 0.08)',
  assistantText:   '#E0E0E0',
  roleLabelUser:   '#BB86FC',
  roleLabelAI:     '#888888',
  cursor:          '#BB86FC',
};

// Markdown styles for the assistant bubble — matches the app's dark theme.
const markdownStyles = {
  body:       { color: COLORS.assistantText, fontSize: 14, lineHeight: 22 },
  heading1:   { color: '#BB86FC', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  heading2:   { color: '#BB86FC', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  strong:     { fontWeight: '700', color: '#FFFFFF' },
  em:         { fontStyle: 'italic' },
  bullet_list_icon: { color: '#BB86FC' },
  code_inline: { backgroundColor: '#2A2A2A', color: '#CF6679', borderRadius: 4, paddingHorizontal: 4 },
};

// ──────────────────────────────────────────────────── Helpers ──

function UserBubble({ text }) {
  const isEmpty = !text?.trim();
  return (
    <View style={styles.bubbleRow}>
      <View style={[styles.bubble, styles.userBubble]}>
        <Text style={styles.roleLabel}>You</Text>
        {isEmpty
          ? <Text style={styles.listeningText}>Listening…</Text>
          : <Text style={styles.userText}>{text}</Text>
        }
      </View>
    </View>
  );
}


function AssistantBubble({ text }) {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
      <View style={[styles.bubble, styles.assistantBubble]}>
        <Text style={styles.roleLabelAI}>Assistant</Text>
        {text ? (
          <Markdown style={markdownStyles}>{text}</Markdown>
        ) : (
          <Text style={styles.thinkingText}>Thinking…</Text>
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
  const listRef = useRef(null);
  const mountOpacity = useRef(new Animated.Value(0)).current;

  // Fade in/out driven by isOpen, not by message count.
  useEffect(() => {
    Animated.timing(mountOpacity, {
      toValue: isOpen ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isOpen, mountOpacity]);

  // Auto-scroll to bottom whenever messages change or the panel opens.
  // Two-phase: immediate smooth scroll + a delayed follow-up to catch any
  // Markdown content that re-measures its height after the first render.
  useEffect(() => {
    if (!isOpen) return;
    listRef.current?.scrollToEnd({ animated: true });
    const delayed = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: false }),
      150,
    );
    return () => clearTimeout(delayed);
  }, [isOpen, messages]);

  if (!isOpen && mountOpacity._value === 0) return null;

  // Panel bottom anchored just above the FAB.
  // maxHeight caps growth so it never overflows above the status bar.
  const panelBottom = fabBottom + FAB_SIZE + FAB_GAP;
  const screenHeight = Dimensions.get('window').height;
  const maxPanelHeight = screenHeight - panelBottom - STATUS_BAR - TOP_MARGIN;

  return (
    <Animated.View
      style={[styles.container, { opacity: mountOpacity, bottom: panelBottom }]}
      pointerEvents={isOpen ? 'box-none' : 'none'}
    >
      <View style={[styles.panel, { maxHeight: maxPanelHeight }]}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) =>
            item.role === 'user' ? (
              <UserBubble text={item.text} />
            ) : (
              <AssistantBubble text={item.text} />
            )
          }
          onContentSizeChange={() =>
            // animated: false here so streaming text snaps instantly to the
            // true bottom instead of launching an animation that undershoots
            // when the Markdown hasn't finished re-measuring yet.
            listRef.current?.scrollToEnd({ animated: false })
          }
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
    backgroundColor: COLORS.backdrop,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.userBubble,
    borderColor: COLORS.userBorder,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: COLORS.assistantBubble,
    borderColor: COLORS.assistantBorder,
    borderBottomLeftRadius: 4,
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.roleLabelUser,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  roleLabelAI: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.roleLabelAI,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  userText: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.userText,
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
