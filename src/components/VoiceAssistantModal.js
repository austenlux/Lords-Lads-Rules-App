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
  FlatList,
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
  const displayText = text.trim() || '…';
  return (
    <View style={styles.bubbleRow}>
      <View style={[styles.bubble, styles.userBubble]}>
        <Text style={styles.roleLabel}>You</Text>
        <Text style={styles.userText}>{displayText}</Text>
      </View>
    </View>
  );
}

function AssistantBubble({ text, isStreaming }) {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
      <View style={[styles.bubble, styles.assistantBubble]}>
        <Text style={styles.roleLabelAI}>Assistant</Text>
        {text ? (
          <Markdown style={markdownStyles}>{text}</Markdown>
        ) : (
          <Text style={styles.thinkingText}>Thinking…</Text>
        )}
        {isStreaming && <Text style={styles.streamCursor}>▌</Text>}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────── Component ──

// FAB height (60) + gap above it (12)
const FAB_SIZE = 60;
const FAB_GAP  = 12;

export default function VoiceAssistantModal({ messages, isThinking, fabBottom = 96 }) {
  const listRef = useRef(null);
  const mountOpacity = useRef(new Animated.Value(0)).current;

  // Fade in when first message appears, fade out when messages clear.
  const visible = messages.length > 0;

  useEffect(() => {
    Animated.timing(mountOpacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, mountOpacity]);

  // Auto-scroll to bottom whenever messages or their text updates.
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay lets the layout settle before scrolling.
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages]);

  if (!visible && mountOpacity._value === 0) return null;

  const lastMsg = messages[messages.length - 1];
  const isLastStreaming = isThinking && lastMsg?.role === 'assistant';

  const panelBottom = fabBottom + FAB_SIZE + FAB_GAP;

  return (
    <Animated.View
      style={[styles.container, { opacity: mountOpacity, bottom: panelBottom }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={styles.panel}>
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
              <AssistantBubble
                text={item.text}
                isStreaming={isLastStreaming && item.id === lastMsg?.id}
              />
            )
          }
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
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
    top: 0,
    // bottom is set dynamically via fabBottom prop
  },
  panel: {
    marginHorizontal: 12,
    maxHeight: 420,
    backgroundColor: COLORS.backdrop,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  listContent: {
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
  streamCursor: {
    color: COLORS.cursor,
    fontSize: 14,
    marginTop: 2,
  },
});
