/**
 * Collapsible section with optional subsections and search highlighting.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { decodeHtmlEntities, normalizeSearchQuery } from '../utils/searchUtils';
import HighlightedMarkdown from './HighlightedMarkdown';

export default function Section({
  title,
  level,
  content,
  subsections,
  onPress,
  isExpanded,
  path = [],
  onNavigate,
  sectionRefs,
  searchQuery,
  styles,
  markdownStyles,
}) {
  const animatedRotation = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const trimmedSearchQuery = normalizeSearchQuery(searchQuery);
  const decodedTitle = decodeHtmlEntities(title);

  useEffect(() => {
    Animated.timing(animatedRotation, {
      toValue: isExpanded ? 1 : 0,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [isExpanded]);

  const rotate = animatedRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const marginLeft = (level - 1) * 12;
  const fontSize = 32 - (level - 1) * 4;

  const handleLinkPress = (url) => {
    if (url.startsWith('#')) {
      const sectionTitle = decodeURIComponent(url.slice(1));
      onNavigate(sectionTitle);
      return false;
    }
    return true;
  };

  return (
    <View
      ref={(ref) => {
        if (ref) sectionRefs[title] = ref;
      }}
      style={{ marginLeft }}
    >
      <TouchableOpacity onPress={() => onPress(path)} style={styles.sectionHeader}>
        <Animated.View style={{ transform: [{ rotate }], marginRight: 8, width: 20 }}>
          <Text style={styles.chevron}>▶</Text>
        </Animated.View>
        {trimmedSearchQuery.length >= 2 ? (
          <Text style={[styles.sectionTitle, { fontSize, color: '#BB86FC' }]}>
            {decodedTitle
              .split(new RegExp(`(${trimmedSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
              .map((part, i) =>
                part.toLowerCase() === trimmedSearchQuery.toLowerCase() ? (
                  <Text key={i} style={[{ fontSize, fontWeight: 'bold', color: '#BB86FC' }, styles.highlightedText]}>
                    {part}
                  </Text>
                ) : (
                  part
                )
              )}
          </Text>
        ) : (
          <Text style={[styles.sectionTitle, { fontSize, color: '#BB86FC' }]}>{decodedTitle}</Text>
        )}
      </TouchableOpacity>
      {isExpanded && (
        <View style={styles.sectionContent}>
          {content && (
            <HighlightedMarkdown
              content={content}
              searchQuery={searchQuery}
              style={markdownStyles}
              onLinkPress={handleLinkPress}
            />
          )}
          {subsections &&
            subsections.map((subsection, index) => (
              <Section
                key={index}
                {...subsection}
                level={level + 1}
                path={[...path, 'subsections', index]}
                onPress={onPress}
                onNavigate={onNavigate}
                sectionRefs={sectionRefs}
                searchQuery={searchQuery}
                subsections={subsection.subsections}
                isExpanded={subsection.isExpanded}
                styles={styles}
                markdownStyles={markdownStyles}
              />
            ))}
        </View>
      )}
    </View>
  );
}
