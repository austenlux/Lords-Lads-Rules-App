/**
 * VoiceAssistantFAB
 *
 * Floating action button that triggers the voice-to-AI-to-voice loop.
 * Only rendered by App.js when useGameAssistant.isSupported is true, so it
 * is invisible on devices that cannot run Gemini Nano.
 *
 * Fades in on first mount to avoid popping in after the hardware check.
 *
 * Visual states
 * ─────────────
 *  idle      – purple, mic icon
 *  listening – red, pulsing ring, mic icon
 *  thinking  – dimmed purple, animated rotation on icon
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import MicIcon from '../../assets/images/mic.svg';

// ─────────────────────────────────────────────── Constants ──

const FAB_SIZE      = 60;
const PULSE_SIZE    = FAB_SIZE + 24;
const FAB_RADIUS    = FAB_SIZE / 2;
const PULSE_RADIUS  = PULSE_SIZE / 2;

const COLORS = {
  idle:      '#BB86FC',   // app purple accent
  listening: '#CF6679',   // app red / error accent
  thinking:  '#7B57B0',   // dimmed purple while generating
  icon:      '#121212',   // dark background colour for icon
  shadow:    '#000',
};

// ─────────────────────────────────────────────── Component ──

export default function VoiceAssistantFAB({ isListening, isThinking, isActive, onPress }) {
  // ── Fade-in on mount ──────────────────────────────────────────────────
  const mountOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(mountOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [mountOpacity]);

  // ── Listening pulse ring ──────────────────────────────────────────────
  const pulseScale  = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isListening) {
      pulseOpacity.setValue(0);
      pulseScale.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1.5,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.4,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isListening, pulseScale, pulseOpacity]);

  // ── Thinking spin ────────────────────────────────────────────────────
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isThinking) {
      spinValue.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [isThinking, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ── Derived visuals ───────────────────────────────────────────────────
  const fabColor = isListening
    ? COLORS.listening
    : isThinking
    ? COLORS.thinking
    : COLORS.idle;

  return (
    <Animated.View style={[styles.wrapper, { opacity: mountOpacity }]}>
      {/* Pulse ring — only visible while listening */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            backgroundColor: COLORS.listening,
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
        pointerEvents="none"
      />

      <Pressable
        onPress={onPress}
        disabled={isActive}
        android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: FAB_RADIUS }}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: fabColor },
          pressed && styles.fabPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          isListening ? 'Listening…' : isThinking ? 'Thinking…' : 'Ask the rules'
        }
      >
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <MicIcon
            width={28}
            height={28}
            fill={COLORS.icon}
            color={COLORS.icon}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────── Styles ──

const styles = StyleSheet.create({
  wrapper: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  fabPressed: {
    opacity: 0.85,
  },
  pulseRing: {
    position: 'absolute',
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_RADIUS,
  },
});
