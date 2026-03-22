/**
 * Reusable expand/collapse section: header row (chevron + optional icon + title) and content when expanded.
 * Used by Section (Rules/Expansions) and MoreScreen so layout and behavior stay identical.
 * Sections default to collapsed (same as Rules/Expansions); pass isExpanded from parent state.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { scaleFontSize, scaleSize } from '../utils/scaleFontSize';
import { useTheme } from '../context/ThemeContext';

/** Default expanded state for a section; false = collapsed, matching Rules/Expansions. */
export const DEFAULT_SECTION_EXPANDED = false;

export default function CollapsibleSection({
  title,
  titleNode,
  icon,
  isExpanded,
  onToggle,
  level = 1,
  children,
  styles,
  style,
  sectionRef,
}) {
  const { accent, titleFontStyle } = useTheme();
  const animatedRotation = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedRotation, {
      toValue: isExpanded ? 1 : 0,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [isExpanded, animatedRotation]);

  const rotate = animatedRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const marginLeft = (level - 1) * 12;
  const fontSize = scaleFontSize(28 - (level - 1) * 4);

  return (
    <View ref={sectionRef} style={[style, { marginLeft }]}>
      <TouchableOpacity onPress={onToggle} style={styles.sectionHeader}>
        <Animated.View style={{ transform: [{ rotate }], marginRight: scaleSize(8), width: 20 }}>
          <Text style={styles.chevron}>▶</Text>
        </Animated.View>
        {icon != null ? <View style={{ marginRight: scaleSize(8) }}>{React.cloneElement(icon, { width: scaleSize(24), height: scaleSize(24) })}</View> : null}
        {titleNode != null ? (
          titleNode
        ) : (
          <Text style={[styles.sectionTitle, { fontSize, color: accent }, titleFontStyle]}>{title}</Text>
        )}
      </TouchableOpacity>
      {isExpanded && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
}
