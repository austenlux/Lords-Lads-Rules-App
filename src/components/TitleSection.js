/**
 * Title section with optional TOC and search-highlighted title.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { decodeHtmlEntities, normalizeSearchQuery } from '../utils/searchUtils';
import HighlightedMarkdown from './HighlightedMarkdown';

export default function TitleSection({ title, content, searchQuery, onNavigate, styles, markdownStyles }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const decodedTitle = decodeHtmlEntities(title);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  function extractTableOfContents() {
    if (!content) return { mainContent: '', tocContent: '' };
    const lines = content.split('\n');
    const tocLines = [];
    const contentLines = [];
    let isToc = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('*') && line.includes('[') && line.includes(']') && line.includes('#')) {
        isToc = true;
        tocLines.push(line);
      } else if (isToc && !line.trim().startsWith('*')) {
        isToc = false;
        contentLines.push(...lines.slice(i));
        break;
      } else if (!isToc) {
        contentLines.push(line);
      }
    }
    return { tocContent: tocLines.join('\n'), mainContent: contentLines.join('\n') };
  }

  const { tocContent, mainContent } = extractTableOfContents();
  const trimmedSearchQuery = normalizeSearchQuery(searchQuery);

  const handleTocLinkPress = (url) => {
    if (url.startsWith('#')) {
      const sectionTitle = decodeURIComponent(url.slice(1));
      if (onNavigate) onNavigate(sectionTitle);
      return false;
    }
    return true;
  };

  const titleStyle = {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 24,
    color: '#BB86FC',
    fontWeight: 'bold',
    lineHeight: 56,
    textShadowColor: 'rgba(187, 134, 252, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  };

  return (
    <View style={styles.titleContainer}>
      <View style={styles.titleGlow} />
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], width: '100%', alignItems: 'center' }}>
        <View style={styles.titleWrapper}>
          <TouchableOpacity activeOpacity={1}>
            <Text style={titleStyle}>
              {trimmedSearchQuery.length >= 2
                ? decodedTitle
                    .split(new RegExp(`(${trimmedSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
                    .map((part, i) =>
                      part.toLowerCase() === trimmedSearchQuery.toLowerCase() ? (
                        <Text
                          key={i}
                          style={[{ fontSize: 48, fontWeight: 'bold', color: '#BB86FC', textShadowColor: 'rgba(187, 134, 252, 0.3)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 }, styles.highlightedText]}
                        >
                          {part}
                        </Text>
                      ) : (
                        part
                      )
                    )
                : decodedTitle}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], width: '100%', alignItems: 'center' }}>
        {mainContent && (
          <View style={styles.subtitleWrapper}>
            <HighlightedMarkdown
              content={mainContent}
              searchQuery={searchQuery}
              style={{
                ...markdownStyles,
                body: { ...markdownStyles.body, fontSize: 20, textAlign: 'center', color: 'rgba(225, 225, 225, 0.9)', lineHeight: 32, paddingHorizontal: 32, letterSpacing: 0.5 },
                paragraph: { marginBottom: 20, color: '#E1E1E1', textAlign: 'center' },
              }}
            />
          </View>
        )}
        {tocContent && (
          <View style={styles.tocWrapper}>
            <HighlightedMarkdown
              content={tocContent}
              searchQuery={searchQuery}
              style={{
                ...markdownStyles,
                body: { ...markdownStyles.body, fontSize: 16, color: '#E1E1E1', lineHeight: 24 },
                listItem: { ...markdownStyles.listItem, marginBottom: 12, marginTop: 12 },
                bullet_list: { ...markdownStyles.bullet_list, marginTop: 16 },
                link: { ...markdownStyles.link, textDecorationLine: 'none' },
              }}
              onLinkPress={handleTocLinkPress}
            />
          </View>
        )}
      </Animated.View>
      <View style={styles.titleDivider} />
    </View>
  );
}
