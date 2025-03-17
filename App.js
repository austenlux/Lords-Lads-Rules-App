import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Animated, TextInput } from 'react-native';
import Markdown from 'react-native-markdown-display';

// Add a utility function to highlight text matches
const highlightMatches = (text, query) => {
  if (!query || query.length < 2 || !text) {
    return text;
  }
  
  // Escape special regex characters in the query
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
  
  return parts.map((part, i) => 
    part.toLowerCase() === query.toLowerCase() ? 
      `<mark>${part}</mark>` : 
      part
  ).join('');
};

// Utility function to decode HTML entities
const decodeHtmlEntities = (text) => {
  if (!text) return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
};

// Create a simpler highlighted text component
const HighlightedText = ({ text, searchQuery, style }) => {
  if (!text) return null;
  
  // Decode HTML entities in the text
  const decodedText = decodeHtmlEntities(text);
  
  if (!searchQuery || searchQuery.length < 2) {
    return <Text style={style}>{decodedText}</Text>;
  }

  // Escape special regex characters in the query
  const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Split the text by the search query
  const parts = decodedText.split(new RegExp(`(${escapedQuery})`, 'gi'));
  
  // Use a single Text component with nested Text components to maintain line spacing
  return (
    <Text style={[
      style,
      // Ensure line height is explicitly set to prevent spacing issues
      style.lineHeight ? null : { lineHeight: style.fontSize ? style.fontSize * 1.5 : 24 }
    ]}>
      {parts.map((part, index) => 
        part.toLowerCase() === searchQuery.toLowerCase() ? 
          <Text key={index} style={[
            // Preserve all original text styling
            {
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              letterSpacing: style.letterSpacing,
              // Don't include lineHeight here as it's handled by the parent
            },
            styles.highlightedText
          ]}>{part}</Text> : 
          part
      )}
    </Text>
  );
};

// Replace the HighlightedMarkdown component with a version that preserves links
const HighlightedMarkdown = ({ content, searchQuery, style, onLinkPress }) => {
  // If no content, return nothing
  if (!content) {
    return null;
  }

  // For headings, blockquotes, and code blocks, use regular markdown
  if (content.trim().startsWith('#') || 
      content.trim().startsWith('>') || 
      content.startsWith('```')) {
    return (
      <Markdown style={style} onLinkPress={onLinkPress}>
        {content}
      </Markdown>
    );
  }

  // Process the content to find paragraphs
  const paragraphs = content.split('\n\n');
  
  return (
    <View>
      {paragraphs.map((paragraph, index) => {
        // Skip empty paragraphs
        if (!paragraph.trim()) return null;
        
        // Check if this is a markdown heading, list, etc.
        if (paragraph.startsWith('#') || 
            paragraph.startsWith('>') || 
            paragraph.startsWith('```')) {
          // Render as regular markdown for headings, blockquotes, and code blocks
          return (
            <Markdown key={index} style={style} onLinkPress={onLinkPress}>
              {paragraph}
            </Markdown>
          );
        }
        
        // Special handling for lists
        if (paragraph.trim().split('\n').some(line => line.trim().startsWith('*') || line.trim().startsWith('-'))) {
          // For lists, we need to process each line individually
          const lines = paragraph.split('\n');
          
          // Calculate the appropriate line height and spacing
          const listItemLineHeight = style.listItem?.lineHeight || style.body?.lineHeight || 24;
          const listItemMarginBottom = style.listItem?.marginBottom || 4;
          
          return (
            <View key={index} style={[
              style.bullet_list || { marginBottom: 16 },
              // Ensure consistent spacing between list items
              { marginTop: style.bullet_list?.marginTop || 0 }
            ]}>
              {lines.map((line, lineIndex) => {
                if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
                  // Extract the bullet and the text
                  const bulletMatch = line.match(/^(\s*)([\*\-]\s*)(.*)$/);
                  if (bulletMatch) {
                    const [_, indentation, bullet, text] = bulletMatch;
                    
                    // Decode HTML entities in the text
                    const decodedText = decodeHtmlEntities(text);
                    
                    // Calculate indentation level based on leading spaces
                    const indentLevel = indentation.length / 2; // Assuming 2 spaces per level
                    const indentWidth = indentLevel * 16; // 16px per indent level
                    
                    // Check if this list item contains a link
                    const linkMatch = decodedText.match(/\[([^\]]+)\]\(([^)]+)\)/);
                    if (linkMatch) {
                      // This is a list item with a link (like in TOC)
                      const [fullMatch, linkText, linkUrl] = linkMatch;
                      const beforeLink = decodedText.substring(0, decodedText.indexOf(fullMatch));
                      const afterLink = decodedText.substring(decodedText.indexOf(fullMatch) + fullMatch.length);
                      
                      // Decode HTML entities in link text
                      const decodedLinkText = decodeHtmlEntities(linkText);
                      
                      return (
                        <View key={lineIndex} style={{ 
                          flexDirection: 'row', 
                          marginBottom: listItemMarginBottom,
                          alignItems: 'flex-start',
                          marginLeft: indentWidth, // Apply indentation
                        }}>
                          <Text style={{ 
                            color: style.bullet_list_icon?.color || '#BB86FC', 
                            marginRight: 8,
                            fontSize: style.listItem?.fontSize || style.body?.fontSize || 16,
                            lineHeight: listItemLineHeight,
                          }}>
                            {bullet.includes('*') ? '•' : '-'}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{
                              ...style.body,
                              ...style.listItem,
                              color: style.listItem?.color || style.body?.color || '#E1E1E1',
                              fontSize: style.listItem?.fontSize || style.body?.fontSize || 16,
                              lineHeight: listItemLineHeight,
                              marginBottom: 0,
                              marginTop: 0,
                            }}>
                              {beforeLink}
                              {searchQuery && searchQuery.length >= 2 ? (
                                // Render link with potential highlighting
                                <Text 
                                  style={{
                                    ...style.link,
                                    color: style.link?.color || '#03DAC6',
                                    fontSize: style.link?.fontSize || style.body?.fontSize || 16,
                                    textDecorationLine: style.link?.textDecorationLine || 'underline',
                                  }}
                                  onPress={() => onLinkPress && onLinkPress(linkUrl)}
                                >
                                  {decodedLinkText.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) => 
                                    part.toLowerCase() === searchQuery.toLowerCase() ? 
                                      <Text key={i} style={[
                                        {
                                          color: style.link?.color || '#03DAC6',
                                          fontSize: style.link?.fontSize || style.body?.fontSize || 16,
                                          // Don't include lineHeight here as it's handled by the parent
                                          textDecorationLine: style.link?.textDecorationLine || 'underline',
                                        },
                                        styles.highlightedText
                                      ]}>{part}</Text> : 
                                      part
                                  )}
                                </Text>
                              ) : (
                                // Render link without highlighting
                                <Text 
                                  style={{
                                    ...style.link,
                                    color: style.link?.color || '#03DAC6',
                                    fontSize: style.link?.fontSize || style.body?.fontSize || 16,
                                    textDecorationLine: style.link?.textDecorationLine || 'underline',
                                  }}
                                  onPress={() => onLinkPress && onLinkPress(linkUrl)}
                                >
                                  {decodedLinkText}
                                </Text>
                              )}
                              {afterLink}
                            </Text>
                          </View>
                        </View>
                      );
                    }
                    
                    // Regular list item without a link
                    return (
                      <View key={lineIndex} style={{ 
                        flexDirection: 'row', 
                        marginBottom: listItemMarginBottom,
                        alignItems: 'flex-start',
                        marginLeft: indentWidth, // Apply indentation
                      }}>
                        <Text style={{ 
                          color: style.bullet_list_icon?.color || '#BB86FC', 
                          marginRight: 8,
                          fontSize: style.listItem?.fontSize || style.body?.fontSize || 16,
                          lineHeight: listItemLineHeight,
                        }}>
                          {bullet.includes('*') ? '•' : '-'}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{
                            ...style.body,
                            ...style.listItem,
                            color: style.listItem?.color || style.body?.color || '#E1E1E1',
                            fontSize: style.listItem?.fontSize || style.body?.fontSize || 16,
                            lineHeight: listItemLineHeight,
                            marginBottom: 0,
                            marginTop: 0,
                          }}>
                            {searchQuery && searchQuery.length >= 2 ? 
                              decodedText.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) => 
                                part.toLowerCase() === searchQuery.toLowerCase() ? 
                                  <Text key={i} style={[
                                    {
                                      color: style.listItem?.color || style.body?.color || '#E1E1E1',
                                      fontSize: style.listItem?.fontSize || style.body?.fontSize || 16,
                                      // Don't include lineHeight here as it's handled by the parent
                                    },
                                    styles.highlightedText
                                  ]}>{part}</Text> : 
                                  part
                              ) : 
                              decodedText
                            }
                          </Text>
                        </View>
                      </View>
                    );
                  }
                }
                
                // For non-list lines, just render them normally
                return (
                  <Text key={lineIndex} style={{
                    ...style.body,
                    ...style.paragraph,
                    color: style.paragraph?.color || style.body?.color || '#E1E1E1',
                    fontSize: style.paragraph?.fontSize || style.body?.fontSize || 16,
                    lineHeight: style.paragraph?.lineHeight || style.body?.lineHeight || 24,
                    marginBottom: 4,
                  }}>
                    {line}
                  </Text>
                );
              })}
            </View>
          );
        }
        
        // Check if paragraph contains links
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const hasLinks = linkRegex.test(paragraph);
        
        if (hasLinks) {
          // Decode the paragraph text first
          const decodedParagraph = decodeHtmlEntities(paragraph);
          
          // Split the paragraph into segments (links and non-links)
          const segments = [];
          let lastIndex = 0;
          let match;
          
          // Reset regex state
          linkRegex.lastIndex = 0;
          
          while ((match = linkRegex.exec(decodedParagraph)) !== null) {
            // Add text before the link
            if (match.index > lastIndex) {
              segments.push({
                type: 'text',
                content: decodedParagraph.substring(lastIndex, match.index)
              });
            }
            
            // Add the link
            segments.push({
              type: 'link',
              text: match[1],
              url: match[2]
            });
            
            lastIndex = match.index + match[0].length;
          }
          
          // Add any remaining text after the last link
          if (lastIndex < decodedParagraph.length) {
            segments.push({
              type: 'text',
              content: decodedParagraph.substring(lastIndex)
            });
          }
          
          // Render segments with highlighting and preserved links
          return (
            <View key={index} style={{ 
              marginBottom: style.paragraph?.marginBottom || 20,
              // Ensure consistent spacing between paragraphs
              marginTop: style.paragraph?.marginTop || 0
            }}>
              <Text style={{
                ...style.body,
                ...style.paragraph,
                color: style.paragraph?.color || style.body?.color || '#E1E1E1',
                fontSize: style.paragraph?.fontSize || style.body?.fontSize || 16,
                lineHeight: style.paragraph?.lineHeight || style.body?.lineHeight || 24,
                // Remove any margin from the text itself as it's handled by the container
                marginBottom: 0,
                marginTop: 0,
              }}>
                {segments.map((segment, i) => {
                  if (segment.type === 'text') {
                    // Highlight regular text
                    if (searchQuery && searchQuery.length >= 2) {
                      const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                      const parts = segment.content.split(new RegExp(`(${escapedQuery})`, 'gi'));
                      
                      // Return parts directly without wrapping each in a Text component
                      return parts.map((part, j) => 
                        part.toLowerCase() === searchQuery.toLowerCase() ? 
                          <Text key={`${i}-${j}`} style={[
                            // Preserve text styling
                            {
                              color: style.paragraph?.color || style.body?.color || '#E1E1E1',
                              fontSize: style.paragraph?.fontSize || style.body?.fontSize || 16,
                              // Don't include lineHeight here as it's handled by the parent
                            },
                            styles.highlightedText
                          ]}>{part}</Text> : 
                          part
                      );
                    } else {
                      return segment.content;
                    }
                  } else if (segment.type === 'link') {
                    // Decode link text
                    const decodedLinkText = decodeHtmlEntities(segment.text);
                    
                    // Handle links with potential highlighting
                    if (searchQuery && searchQuery.length >= 2) {
                      const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                      const parts = decodedLinkText.split(new RegExp(`(${escapedQuery})`, 'gi'));
                      
                      return (
                        <Text 
                          key={`link-${i}`} 
                          style={{
                            ...style.link,
                            color: style.link?.color || '#03DAC6',
                            fontSize: style.link?.fontSize || style.body?.fontSize || 16,
                            // Don't include lineHeight here as it's handled by the parent
                            textDecorationLine: 'underline',
                          }}
                          onPress={() => onLinkPress && onLinkPress(segment.url)}
                        >
                          {parts.map((part, j) => 
                            part.toLowerCase() === searchQuery.toLowerCase() ? 
                              <Text key={`${i}-${j}`} style={[
                                // Preserve link styling
                                {
                                  color: style.link?.color || '#03DAC6',
                                  fontSize: style.link?.fontSize || style.body?.fontSize || 16,
                                  // Don't include lineHeight here as it's handled by the parent
                                  textDecorationLine: 'underline'
                                },
                                styles.highlightedText
                              ]}>{part}</Text> : 
                              part
                          )}
                        </Text>
                      );
                    } else {
                      return (
                        <Text 
                          key={`link-${i}`} 
                          style={{
                            ...style.link,
                            color: style.link?.color || '#03DAC6',
                            fontSize: style.link?.fontSize || style.body?.fontSize || 16,
                            textDecorationLine: 'underline',
                          }}
                          onPress={() => onLinkPress && onLinkPress(segment.url)}
                        >
                          {decodedLinkText}
                        </Text>
                      );
                    }
                  }
                  return null;
                })}
              </Text>
            </View>
          );
        }
        
        // For regular paragraphs without links, use our custom text rendering
        const decodedParagraph = decodeHtmlEntities(paragraph);
        return (
          <View key={index} style={{ 
            marginBottom: style.paragraph?.marginBottom || 20,
            // Ensure consistent spacing between paragraphs
            marginTop: style.paragraph?.marginTop || 0
          }}>
            <Text style={{
              ...style.body,
              ...style.paragraph,
              color: style.paragraph?.color || style.body?.color || '#E1E1E1',
              fontSize: style.paragraph?.fontSize || style.body?.fontSize || 16,
              lineHeight: style.paragraph?.lineHeight || style.body?.lineHeight || 24,
              // Remove any margin from the text itself as it's handled by the container
              marginBottom: 0,
              marginTop: 0,
            }}>
              {searchQuery && searchQuery.length >= 2 ? 
                decodedParagraph.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) => 
                  part.toLowerCase() === searchQuery.toLowerCase() ? 
                    <Text key={i} style={[
                      {
                        color: style.paragraph?.color || style.body?.color || '#E1E1E1',
                        fontSize: style.paragraph?.fontSize || style.body?.fontSize || 16,
                        // Don't include lineHeight here as it's handled by the parent
                      },
                      styles.highlightedText
                    ]}>{part}</Text> : 
                    part
                ) : 
                decodedParagraph
              }
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const TitleSection = ({ title, content, searchQuery, onNavigate }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Decode HTML entities in the title
  const decodedTitle = decodeHtmlEntities(title);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  // Extract the Table of Contents from the content if it exists
  const extractTableOfContents = () => {
    if (!content) return { mainContent: '', tocContent: '' };
    
    // Look for a pattern that indicates a table of contents
    // Typically a series of bullet points with links
    const lines = content.split('\n');
    const tocLines = [];
    const contentLines = [];
    let isToc = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Check if this line is part of a TOC (bullet point with a link)
      if (line.trim().startsWith('*') && line.includes('[') && line.includes(']') && line.includes('#')) {
        isToc = true;
        tocLines.push(line);
      } else if (isToc && line.trim() === '') {
        // Empty line after TOC
        isToc = false;
      } else {
        contentLines.push(line);
      }
    }
    
    return {
      tocContent: tocLines.join('\n'),
      mainContent: contentLines.join('\n')
    };
  };
  
  const { tocContent, mainContent } = extractTableOfContents();
  
  // Handle link presses in the TOC
  const handleTocLinkPress = (url) => {
    if (url.startsWith('#')) {
      const sectionTitle = decodeURIComponent(url.slice(1));
      if (onNavigate) {
        onNavigate(sectionTitle);
      }
      return false;
    }
    return true;
  };

  return (
  <View style={styles.titleContainer}>
      <View style={styles.titleGlow} />
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        width: '100%',
        alignItems: 'center',
      }}>
        <View style={styles.titleWrapper}>
          <Text style={{
            fontSize: 48,
            textAlign: 'center',
            marginBottom: 24,
            color: '#BB86FC',
            fontWeight: 'bold',
            lineHeight: 56,
            textShadowColor: 'rgba(187, 134, 252, 0.3)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 20,
          }}>
            {searchQuery && searchQuery.length >= 2 ? 
              decodedTitle.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) => 
                part.toLowerCase() === searchQuery.toLowerCase() ? 
                  <Text key={i} style={[
                    // Preserve original title styling
                    {
                      fontSize: 48,
                      fontWeight: 'bold',
                      color: '#BB86FC',
                      // Don't include lineHeight here as it's handled by the parent
                      textShadowColor: 'rgba(187, 134, 252, 0.3)',
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 20,
                    },
                    styles.highlightedText
                  ]}>{part}</Text> : 
                  part
              ) : 
              decodedTitle
            }
          </Text>
        </View>
      </Animated.View>
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        width: '100%',
        alignItems: 'center',
      }}>
        {/* Main content section */}
        {mainContent && (
          <View style={styles.subtitleWrapper}>
            <HighlightedMarkdown
              content={mainContent}
              searchQuery={searchQuery}
              style={{
                ...markdownStyles,
                body: {
                  ...markdownStyles.body,
                  fontSize: 20,
                  textAlign: 'center',
                  color: 'rgba(225, 225, 225, 0.9)',
                  lineHeight: 32,
                  paddingHorizontal: 32,
                  letterSpacing: 0.5,
                },
                paragraph: {
                  marginBottom: 20,
                  color: '#E1E1E1',
                  textAlign: 'center',
                }
              }}
            />
          </View>
        )}
        
        {/* Table of Contents section */}
        {tocContent && (
          <View style={styles.tocWrapper}>
            <HighlightedMarkdown
              content={tocContent}
              searchQuery={searchQuery}
              style={{
                ...markdownStyles,
                body: {
                  ...markdownStyles.body,
                  fontSize: 16,
                  color: '#E1E1E1',
                  lineHeight: 24,
                },
                listItem: {
                  ...markdownStyles.listItem,
                  marginBottom: 8,
                },
                bullet_list: {
                  ...markdownStyles.bullet_list,
                  marginTop: 16,
                },
                link: {
                  ...markdownStyles.link,
                  textDecorationLine: 'none',
                }
              }}
              onLinkPress={handleTocLinkPress}
            />
          </View>
        )}
      </Animated.View>
      <View style={styles.titleDivider} />
  </View>
);
};

const Section = ({ title, level, content, subsections, onPress, isExpanded, path = [], onNavigate, sectionRefs, searchQuery }) => {
  const animatedRotation = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  // Decode HTML entities in the title
  const decodedTitle = decodeHtmlEntities(title);

  useEffect(() => {
    Animated.timing(animatedRotation, {
      toValue: isExpanded ? 1 : 0,
      duration: 200,
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
      ref={ref => {
        if (ref) {
          sectionRefs[title] = ref;
        }
      }}
    >
      <TouchableOpacity 
        onPress={() => onPress(path)}
        style={styles.sectionHeader}
      >
        <Animated.View style={{ transform: [{ rotate }], marginRight: 8, width: 20 }}>
          <Text style={styles.chevron}>▶</Text>
        </Animated.View>
        {searchQuery && searchQuery.length >= 2 ? (
          <Text style={[styles.sectionTitle, { fontSize, color: '#BB86FC' }]}>
            {decodedTitle.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) => 
              part.toLowerCase() === searchQuery.toLowerCase() ? 
                <Text key={i} style={[
                  // Preserve original text styling
                  {
                    fontSize,
                    fontWeight: 'bold',
                    color: '#BB86FC',
                    // Don't include lineHeight here as it's handled by the parent
                  },
                  styles.highlightedText
                ]}>{part}</Text> : 
                part
            )}
          </Text>
        ) : (
          <Text style={[styles.sectionTitle, { fontSize, color: '#BB86FC' }]}>{decodedTitle}</Text>
        )}
      </TouchableOpacity>
      {isExpanded && (
        <View style={[styles.sectionContent, { paddingLeft: 16 }]}>
          {content && (
            <HighlightedMarkdown
              content={content}
              searchQuery={searchQuery}
              style={markdownStyles}
              onLinkPress={handleLinkPress}
            />
          )}
          {subsections?.map((subsection, index) => (
            <Section
              key={index}
              {...subsection}
              level={level + 1}
              path={[...path, 'subsections', index]}
              onPress={onPress}
              onNavigate={onNavigate}
              sectionRefs={sectionRefs}
              searchQuery={searchQuery}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState('');
  const [originalSections, setOriginalSections] = useState([]);
  const [sections, setSections] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchBarAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const sectionRefs = useRef({});
  const searchInputRef = useRef(null);

  // Add effect to handle search input focus
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      // Small delay to ensure the input is mounted
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [showSearch]);

  const findSectionPath = (sections, targetTitle, currentPath = []) => {
    console.log('Searching for:', targetTitle, 'in path:', currentPath);
    
    // Normalize the target title for comparison
    const normalizeTitle = (title) => {
      return title.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
    };

    const normalizedTarget = normalizeTitle(targetTitle);
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const normalizedSection = normalizeTitle(section.title);
      
      // Try exact match first, then normalized match
      if (section.title === targetTitle || normalizedSection === normalizedTarget) {
        const foundPath = [...currentPath, i];
        console.log('Found section at path:', foundPath, 'with title:', section.title);
        return foundPath;
      }
      
      if (section.subsections) {
        const subPath = findSectionPath(
          section.subsections,
          targetTitle,
          [...currentPath, i, 'subsections']
        );
        if (subPath) return subPath;
      }
    }
    return null;
  };

  const collapseAllAndExpandSection = (sectionTitle) => {
    console.log('Navigation requested to:', sectionTitle);
    
    // Try to find the section with exact title first
    let path = findSectionPath(sections, sectionTitle);
    let actualTitle = null;
    
    if (!path) {
      // If no exact match, try with common variations
      const variations = [
        sectionTitle,
        sectionTitle.replace('---', ' - '),  // Handle markdown link format
        `${sectionTitle.toUpperCase()} - ${sectionTitle}`,  // Try with roman numerals
        sectionTitle.replace(/^([iv]+)---/i, '$1 - ')  // Handle roman numerals with dashes
      ];
      
      for (const variation of variations) {
        path = findSectionPath(sections, variation);
        if (path) {
          console.log('Found matching section using variation:', variation);
          break;
        }
      }
    }
    
    if (!path) {
      console.log('Could not find matching section for:', sectionTitle);
      return;
    }

    // Find the actual title of the target section
    let current = sections;
    for (let i = 0; i < path.length; i++) {
      const pathPart = path[i];
      if (pathPart === 'subsections') {
        continue;
      }
      if (current[pathPart]) {
        actualTitle = current[pathPart].title;
        if (i < path.length - 1 && current[pathPart].subsections) {
          current = current[pathPart].subsections;
        }
      }
    }

    setSections(prevSections => {
      const newSections = JSON.parse(JSON.stringify(prevSections));
      
      // First, collapse all sections
      const collapseAll = (sections) => {
        sections.forEach(section => {
          if (!section.isTitle) {
            section.isExpanded = false;
            if (section.subsections) {
              collapseAll(section.subsections);
            }
          }
        });
      };

      collapseAll(newSections);

      // Expand all sections along the path
      let current = newSections;
      for (let i = 0; i < path.length; i++) {
        const pathPart = path[i];
        if (pathPart === 'subsections') {
          continue; // Skip the 'subsections' markers in the path
        }
        
        if (current[pathPart]) {
          current[pathPart].isExpanded = true;
          console.log('Expanded section:', current[pathPart].title);
          
          // Move to next level if there are more path segments
          if (i < path.length - 1 && current[pathPart].subsections) {
            current = current[pathPart].subsections;
          }
        }
      }

      return newSections;
    });

    // Schedule the scroll after the state update and animation
    setTimeout(() => {
      if (!actualTitle) {
        console.log('No actual title found for scrolling');
        return;
      }
      
      console.log('Attempting to scroll to section with title:', actualTitle);
      console.log('Available refs:', Object.keys(sectionRefs.current));
      
      const targetRef = sectionRefs.current[actualTitle];
      if (targetRef && scrollViewRef.current) {
        console.log('Found ref, scrolling...');
        targetRef.measureLayout(
          scrollViewRef.current,
          (x, y) => {
            scrollViewRef.current.scrollTo({ y: y - 20, animated: true });
            console.log('Scrolled to position:', y - 20);
          },
          (error) => console.log('Failed to measure layout:', error)
        );
      } else {
        console.log('Missing ref or scrollView for title:', actualTitle);
      }
    }, 500);
  };

  const handleLinkPress = (url) => {
    if (url.startsWith('#')) {
      const sectionTitle = decodeURIComponent(url.slice(1));
      collapseAllAndExpandSection(sectionTitle);
      return false;
    }
    return true;
  };

  const parseMarkdownSections = (text) => {
    const lines = text.split('\n');
    const sections = [];
    let currentSection = null;
    let currentSubsection = null;
    let currentSubsubsection = null;
    let currentContent = [];
    let isFirstSection = true;

    const finalizeContent = () => {
      const content = currentContent
        .filter(line => !line.match(/!\[.*?\]\(.*?\)/)) // Skip image markdown
        .join('\n')
        .trim();
      currentContent = [];
      return content;
    };

    const assignContent = () => {
      const content = finalizeContent();
      if (currentSubsubsection) {
        currentSubsubsection.content = content;
      } else if (currentSubsection) {
        currentSubsection.content = content;
      } else if (currentSection) {
        currentSection.content = content;
      }
    };

    lines.forEach(line => {
      if (line.startsWith('# ')) {
        if (currentSection) {
          assignContent();
          currentSubsubsection = null;
          currentSubsection = null;
          sections.push(currentSection);
        }
        if (isFirstSection) {
          currentSection = {
            title: line.replace('# ', ''),
            level: 1,
            isTitle: true,
            content: '',
          };
          isFirstSection = false;
        } else {
          currentSection = {
            title: line.replace('# ', ''),
            level: 1,
            isExpanded: false,
            subsections: [],
            content: '',
          };
        }
      } else if (line.startsWith('## ')) {
        assignContent();
        currentSubsubsection = null;
        currentSubsection = {
          title: line.replace('## ', ''),
          level: 2,
          isExpanded: false,
          subsections: [],
          content: '',
        };
        if (currentSection) {
          currentSection.subsections.push(currentSubsection);
        }
      } else if (line.startsWith('### ')) {
        assignContent();
        currentSubsubsection = {
          title: line.replace('### ', ''),
          level: 3,
          isExpanded: false,
          content: '',
        };
        if (currentSubsection) {
          currentSubsection.subsections.push(currentSubsubsection);
        }
      } else {
        currentContent.push(line);
      }
    });

    // Handle final section's content
    if (currentSection) {
      assignContent();
      sections.push(currentSection);
    }

    return sections;
  };

  const toggleSection = (path) => {
    setSections(prevSections => {
      const newSections = JSON.parse(JSON.stringify(prevSections));
      
      // Helper function to toggle nested section
      const toggleNestedSection = (obj, pathParts) => {
        if (pathParts.length === 1) {
          obj[pathParts[0]].isExpanded = !obj[pathParts[0]].isExpanded;
          return;
        }
        
        const [current, ...rest] = pathParts;
        if (current === 'subsections') {
          toggleNestedSection(obj.subsections, rest);
        } else {
          toggleNestedSection(obj[current], rest);
        }
      };

      const pathParts = path.map(String);
      toggleNestedSection(newSections, pathParts);
      return newSections;
    });
  };

  const fetchReadme = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        'https://raw.githubusercontent.com/seanKenkeremath/lords-and-lads/master/README.md'
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch README (Status: ${response.status})`);
      }
      const text = await response.text();
      
      // Store the original content
      setContent(text);
      
      // Parse the sections from the content
      const parsedSections = parseMarkdownSections(text);
      setOriginalSections(parsedSections);
      setSections(parsedSections);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadme();
  }, []);

  // Modify the handleSearchQueryChange function to preserve expansion states
  const handleSearchQueryChange = (newQuery) => {
    setSearchQuery(newQuery);
    
    // If the query is cleared or too short, restore all sections while preserving expansion states
    if (!newQuery || newQuery.length < 2) {
      setSections(prevSections => {
        // Create a map of current expansion states
        const expansionStates = new Map();
        const collectExpansionStates = (sections) => {
          sections.forEach(section => {
            if (!section.isTitle) {
              expansionStates.set(section.title, section.isExpanded);
              if (section.subsections) {
                collectExpansionStates(section.subsections);
              }
            }
          });
        };
        collectExpansionStates(prevSections);

        // Restore sections while applying saved expansion states
        const newSections = JSON.parse(JSON.stringify(originalSections));
        const applyExpansionStates = (sections) => {
          sections.forEach(section => {
            if (!section.isTitle) {
              // Apply saved expansion state if it exists, otherwise keep default
              if (expansionStates.has(section.title)) {
                section.isExpanded = expansionStates.get(section.title);
              }
              if (section.subsections) {
                applyExpansionStates(section.subsections);
              }
            }
          });
        };
        applyExpansionStates(newSections);
        return newSections;
      });
    } else {
      // Apply filtering to the original sections
      const filteredSections = filterSectionsBySearch(JSON.parse(JSON.stringify(originalSections)), newQuery);
      setSections(filteredSections);
    }
  };

  // Modify the filterSectionsBySearch function to handle section expansion
  const filterSectionsBySearch = (sections, searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      return sections;
    }

    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedQuery, 'gi');

    const hasMatch = (text) => {
      if (!text) return false;
      return searchRegex.test(decodeHtmlEntities(text));
    };

    const filterSection = (section) => {
      // Always keep the title section
      if (section.isTitle) {
        return true;
      }

      // Check if this section's title matches
      const titleMatches = hasMatch(section.title);

      // Check if this section's content matches
      const contentMatches = hasMatch(section.content);

      // Check if any subsections match
      let hasMatchingSubsections = false;
      if (section.subsections) {
        section.subsections = section.subsections.filter(subsection => {
          const subsectionMatches = filterSection(subsection);
          if (subsectionMatches) {
            hasMatchingSubsections = true;
          }
          return subsectionMatches;
        });
      }

      // Track if this section was collapsed by filtering
      if (!titleMatches && !contentMatches && !hasMatchingSubsections) {
        section.wasCollapsedByFilter = true;
        section.isExpanded = false;
      } else {
        // If section matches, ensure it's expanded
        section.isExpanded = true;
      }

      // Keep the section if any of these conditions are met:
      // 1. The title matches
      // 2. The content matches
      // 3. It has matching subsections
      return titleMatches || contentMatches || hasMatchingSubsections;
    };

    return sections.filter(filterSection);
  };

  // Modify the renderSection function to use sections directly instead of getFilteredSections
  const renderSection = (section, index, parentPath = []) => {
    const path = [...parentPath, index];
    
    if (section.isTitle) {
      return (
        <TitleSection
          key={index}
          title={section.title}
          content={section.content}
          searchQuery={searchQuery}
          onNavigate={collapseAllAndExpandSection}
        />
      );
    }

    return (
      <View
        key={index}
        ref={ref => {
          if (ref) {
            sectionRefs.current[section.title] = ref;
          }
        }}
      >
        <Section
          {...section}
          path={path}
          onPress={toggleSection}
          onNavigate={collapseAllAndExpandSection}
          sectionRefs={sectionRefs.current}
          searchQuery={searchQuery}
        />
      </View>
    );
  };

  const toggleSearchBar = () => {
    const toValue = showSearch ? 0 : 1;
    
    // If we're closing the search bar, clear the search query
    if (showSearch) {
      // Instead of just setting searchQuery to empty string, use handleSearchQueryChange
      // which will also restore the original sections with proper expansion states
      handleSearchQueryChange('');
    }
    
    setShowSearch(!showSearch);
    
    Animated.timing(searchBarAnim, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#BB86FC" />
          <Text style={styles.loadingText}>Loading Rules...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Unable to Load Rules</Text>
            <View style={styles.centered}>
              <Markdown style={markdownStyles}>
                {"# Error\n\n" + error}
              </Markdown>
            </View>
            <TouchableOpacity style={styles.retryButton} onPress={fetchReadme}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      
      {/* Header with Search Icon/Bar */}
      <View style={styles.headerContainer}>
        {!showSearch ? (
          <>
            <View style={styles.spacer}></View>
            <TouchableOpacity 
              style={styles.searchIconContainer} 
              onPress={toggleSearchBar}
            >
              <Text style={styles.searchIcon}>🔍</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.searchBarWrapper}>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search rules..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={handleSearchQueryChange}
              autoFocus={true}
            />
            <TouchableOpacity 
              style={styles.closeIconContainer} 
              onPress={toggleSearchBar}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.contentContainer}>
          {sections.map((section, index) => renderSection(section, index))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 0,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40,
  },
  errorContainer: {
    backgroundColor: '#2F1515',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#CF6679',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#CF6679',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#E1E1E1',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#BB86FC',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#121212',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#E1E1E1',
  },
  chevron: {
    color: '#BB86FC',
    fontSize: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sectionTitle: {
    fontWeight: 'bold',
    flex: 1,
  },
  sectionContent: {
    paddingLeft: 32,
  },
  titleContainer: {
    marginBottom: 48,
    paddingBottom: 40,
    paddingTop: 60,
    alignItems: 'center',
    position: 'relative',
    borderBottomWidth: 0,
    width: '100%',
  },
  titleGlow: {
    position: 'absolute',
    top: '30%',
    width: 200,
    height: 200,
    backgroundColor: 'rgba(187, 134, 252, 0.05)',
    borderRadius: 100,
    transform: [{ scale: 1.5 }],
    opacity: 0.6,
    zIndex: -1,
  },
  titleDivider: {
    position: 'absolute',
    bottom: 0,
    left: '10%',
    right: '10%',
    height: 1,
    backgroundColor: '#333',
    shadowColor: '#BB86FC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  mainTitle: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#BB86FC',
    marginBottom: 16,
    textAlign: 'center',
  },
  titleSummary: {
    fontSize: 18,
    color: '#E1E1E1',
    textAlign: 'center',
    lineHeight: 24,
  },
  centered: {
    alignItems: 'center',
  },
  titleWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  subtitleWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  tocWrapper: {
    width: '90%',
    marginTop: 24,
    marginBottom: 16,
    padding: 16,
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(187, 134, 252, 0.2)',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  spacer: {
    flex: 1,
  },
  searchIconContainer: {
    padding: 8,
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: {
    fontSize: 20,
  },
  searchBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    borderRadius: 8,
    padding: 4,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#2C2C2C',
    color: '#FFFFFF',
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(187, 134, 252, 0.3)',
  },
  closeIconContainer: {
    padding: 8,
    marginLeft: 8,
  },
  closeIcon: {
    fontSize: 18,
    color: '#E1E1E1',
  },
  highlightedText: {
    backgroundColor: 'rgba(187, 134, 252, 0.3)',
    color: '#ffffff',
  },
});

const markdownStyles = {
  body: {
    color: '#E1E1E1',
    fontSize: 16,
    lineHeight: 24,
  },
  heading1: {
    color: '#BB86FC',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 24,
    marginTop: 32,
    lineHeight: 40,
  },
  heading2: {
    color: '#BB86FC',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 28,
    lineHeight: 34,
  },
  heading3: {
    color: '#BB86FC',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 24,
    lineHeight: 30,
  },
  link: {
    color: '#03DAC6',
  },
  listItem: {
    marginBottom: 4,
    color: '#E1E1E1',
  },
  paragraph: {
    marginBottom: 20,
    color: '#E1E1E1',
  },
  bullet_list: {
    marginBottom: 16,
  },
  ordered_list: {
    marginBottom: 16,
  },
  bullet_list_icon: {
    color: '#BB86FC',
  },
  ordered_list_icon: {
    color: '#BB86FC',
  },
  code_inline: {
    color: '#03DAC6',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  code_block: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginVertical: 12,
  },
  fence: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginVertical: 12,
  },
  blockquote: {
    backgroundColor: '#1E1E1E',
    borderLeftColor: '#BB86FC',
    borderLeftWidth: 4,
    padding: 16,
    marginVertical: 12,
  },
  table: {
    borderColor: '#333',
    marginVertical: 16,
  },
  tr: {
    borderBottomColor: '#333',
  },
  th: {
    padding: 12,
    backgroundColor: '#1E1E1E',
    color: '#BB86FC',
  },
  td: {
    padding: 12,
    borderColor: '#333',
  },
  mark: {
    backgroundColor: 'rgba(187, 134, 252, 0.3)',
    color: '#ffffff',
    borderRadius: 2,
  },
};