import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, TextInput, Animated, Platform, NativeModules } from 'react-native';
import Markdown from 'react-native-markdown-display';
import RNFS from 'react-native-fs';
import Svg, { Path } from 'react-native-svg';

// Constants
const CONTENT_URL = 'https://raw.githubusercontent.com/seanKenkeremath/lords-and-lads/master/README.md';

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
        
        // For regular paragraphs, ensure inline code is properly formatted
        const processedParagraph = paragraph.replace(/`([^`]+)`/g, '`$1`');
        
        return (
          <Markdown key={index} style={style} onLinkPress={onLinkPress}>
            {processedParagraph}
          </Markdown>
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
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
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
    let lastLineWasEmpty = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this line is part of a TOC (bullet point with a link)
      if (line.startsWith('*') && line.includes('[') && line.includes(']') && line.includes('#')) {
        isToc = true;
        tocLines.push(line);
        lastLineWasEmpty = false;
      } else if (isToc && line === '') {
        // Only add empty line if it's not consecutive
        if (!lastLineWasEmpty) {
          tocLines.push('');
          lastLineWasEmpty = true;
        }
      } else if (isToc) {
        // End of TOC
        isToc = false;
        contentLines.push(...lines.slice(i));
        break;
      } else {
        contentLines.push(lines[i]);
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
          <TouchableOpacity 
            activeOpacity={1} 
          >
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
          </TouchableOpacity>
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

// Add this component for the empty search results state
const EmptySearchResults = ({ query }) => {
  return (
    <View style={styles.emptyStateContainer}>
      <Text style={styles.emptyStateIcon}>🔍</Text>
      <Text style={styles.emptyStateTitle}>No matching rules found</Text>
      <Text style={styles.emptyStateText}>
        We couldn't find any rules matching "{query}".
      </Text>
      <Text style={styles.emptyStateText}>
        Try using different keywords or check your spelling.
      </Text>
    </View>
  );
};

// Create a Rules screen component
const RulesScreen = ({ content, sections, searchQuery, showSearch, toggleSearchBar, handleSearchQueryChange, searchInputRef, renderSection, scrollViewRef }) => {
  return (
    <View style={{ flex: 1 }}>
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
          {sections.length === 0 && searchQuery && searchQuery.length >= 2 ? (
            <EmptySearchResults query={searchQuery} />
          ) : (
            sections.map((section, index) => renderSection(section, index))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// Create an Info/Settings screen component
const InfoSettingsScreen = ({ lastFetchDate }) => {
  const [releaseNotes, setReleaseNotes] = useState([]);
  const [expandedVersions, setExpandedVersions] = useState({});
  const animations = useRef({}).current;
  const contentHeights = useRef({}).current;

  const parseReleaseNotes = (content) => {
    const versions = [];
    let currentVersion = null;
    let currentSection = null;
    
    content.split('\n').forEach(line => {
      // Skip the title and description
      if (line.startsWith('# ') || line.trim() === '' || line.startsWith('A comprehensive')) {
        return;
      }
      
      // Version line
      if (line.startsWith('## ')) {
        const match = line.match(/## (v[\d.]+) \((.*?)\)/);
        if (match) {
          currentVersion = {
            version: match[1],
            date: match[2],
            sections: []
          };
          versions.push(currentVersion);
        }
        return;
      }
      
      // Section title
      if (line.startsWith('### ')) {
        currentSection = {
          title: line.replace('### ', ''),
          items: []
        };
        if (currentVersion) {
          currentVersion.sections.push(currentSection);
        }
        return;
      }
      
      // Note line
      if (line.startsWith('Note: ')) {
        if (currentVersion) {
          currentVersion.note = line.replace('Note: ', '');
        }
        return;
      }
      
      // List item
      if (line.startsWith('* ')) {
        const item = line.replace('* ', '');
        if (currentSection) {
          currentSection.items.push(item);
        }
      }
    });
    
    return versions;
  };

  useEffect(() => {
    const loadReleaseNotes = async () => {
      try {
        const content = await RNFS.readFileAssets('release_notes.md', 'utf8');
        const versions = parseReleaseNotes(content);
        
        // Initialize state for each version
        const initialExpanded = {};
        versions.forEach(version => {
          initialExpanded[version.version] = false;
          animations[version.version] = {
            rotation: new Animated.Value(0),
            height: new Animated.Value(0)
          };
          // Calculate dynamic height based on content
          const baseHeight = 100; // Base height for version header and padding
          const sectionHeight = version.sections.reduce((acc, section) => {
            return acc + 30 + (section.items.length * 20); // 30px for section title, 20px per item
          }, 0);
          const noteHeight = version.note ? 30 : 0;
          const padding = 20;
          contentHeights[version.version] = baseHeight + sectionHeight + noteHeight + padding;
        });
        
        setReleaseNotes(versions);
        setExpandedVersions(initialExpanded);
      } catch (error) {
        console.error('Error loading release notes:', error);
        // Fallback to hardcoded data if file reading fails
        const fallbackVersions = [
          {
            version: 'v1.3.0',
            date: '2025-04-04',
            sections: [
              {
                title: 'iOS Support and UI Improvements',
                items: [
                  'Added iOS simulator support',
                  'Enhanced UI with transparent status bar and updated icons',
                  'Improved build configurations for both platforms',
                  'Updated documentation with platform-specific guidance'
                ]
              }
            ],
            note: 'iOS build is for simulator only. For physical devices, build locally with your Apple Developer account.'
          }
        ];
        setReleaseNotes(fallbackVersions);
        setExpandedVersions({ 'v1.3.0': false });
        animations['v1.3.0'] = {
          rotation: new Animated.Value(0),
          height: new Animated.Value(0)
        };
        const baseHeight = 100;
        const sectionHeight = fallbackVersions[0].sections.reduce((acc, section) => {
          return acc + 30 + (section.items.length * 20);
        }, 0);
        const noteHeight = fallbackVersions[0].note ? 30 : 0;
        const padding = 20;
        contentHeights['v1.3.0'] = baseHeight + sectionHeight + noteHeight + padding;
      }
    };
    
    loadReleaseNotes();
  }, []);

  const toggleVersionExpansion = (version) => {
    const isExpanded = !expandedVersions[version];
    
    // Animate the arrow rotation
    Animated.timing(animations[version].rotation, {
      toValue: isExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true
    }).start();
    
    // Animate the content height
    Animated.timing(animations[version].height, {
      toValue: isExpanded ? contentHeights[version] : 0,
      duration: 200,
      useNativeDriver: false
    }).start();
    
    setExpandedVersions(prev => ({
      ...prev,
      [version]: isExpanded
    }));
  };

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.contentContainer}>
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Lords & Lads</Text>
          
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Rules Last Synced</Text>
            <Text style={styles.infoValue}>{lastFetchDate || 'Never'}</Text>
          </View>
          
          <View style={styles.changelogContainer}>
            <Text style={styles.changelogTitle}>Changelog</Text>
            
            {releaseNotes.map((version, index) => (
              <View key={version.version} style={styles.versionContainer}>
                <TouchableOpacity 
                  style={styles.versionHeader} 
                  onPress={() => toggleVersionExpansion(version.version)}
                  activeOpacity={0.7}
                >
                  <View style={styles.versionRow}>
                    <Text style={styles.versionText}>{version.version}</Text>
                    <Text style={styles.versionDate}>{version.date}</Text>
                    {index === 0 && (
                      <View style={styles.latestBadge}>
                        <Text style={styles.latestBadgeText}>Latest</Text>
                      </View>
                    )}
                  </View>
                  <Animated.View 
                    style={{ 
                      transform: [{
                        rotate: animations[version.version]?.rotation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '90deg']
                        }) || '0deg'
                      }]
                    }}
                  >
                    <Text style={styles.versionArrow}>▶</Text>
                  </Animated.View>
                </TouchableOpacity>
                
                <Animated.View 
                  style={[
                    styles.versionContentContainer,
                    { 
                      height: animations[version.version]?.height || 0,
                      overflow: 'hidden'
                    }
                  ]}
                >
                  <View style={styles.versionContent}>
                    {version.sections.map((section, sectionIndex) => (
                      <View key={sectionIndex}>
                        <Text style={styles.changelogSubtitle}>{section.title}:</Text>
                        {section.items.map((item, itemIndex) => (
                          <Text key={itemIndex} style={styles.changelogItem}>• {item}</Text>
                        ))}
                      </View>
                    ))}
                    {version.note && (
                      <Text style={[styles.changelogItem, { marginTop: 8, fontStyle: 'italic' }]}>{version.note}</Text>
                    )}
                  </View>
                </Animated.View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
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
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' or 'info'
  const [lastFetchDate, setLastFetchDate] = useState(null); // Track when content was last fetched
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
      }, 10);
    }
  }, [showSearch]);

  const findSectionPath = (sections, targetTitle, currentPath = []) => {
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
          break;
        }
      }
    }
    
    if (!path) {
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
        return;
      }
      
      const targetRef = sectionRefs.current[actualTitle];
      if (targetRef && scrollViewRef.current) {
        targetRef.measureLayout(
          scrollViewRef.current,
          (x, y) => {
            scrollViewRef.current.scrollTo({ y: y - 20, animated: true });
          },
          (error) => {}
        );
      }
    }, 100);
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
    let lastLineWasEmpty = false;
    let isInToc = false;

    const finalizeContent = () => {
      const content = currentContent
        .filter(line => !line.match(/!\[.*?\]\(.*?\)/)) // Skip image markdown
        .map(line => {
          // Ensure text within backticks is properly formatted as code
          return line.replace(/`([^`]+)`/g, '`$1`');
        })
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
    try {
      // Set a timeout to prevent hanging on slow connections
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout
      
      const response = await fetch(CONTENT_URL, { 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch content (Status: ${response.status})`);
      }
      
      const text = await response.text();
      
      // Update last fetch date
      setLastFetchDate(new Date().toLocaleString());
      
      // Parse and display content
      setContent(text);
      const parsedSections = parseMarkdownSections(text);
      setOriginalSections(parsedSections);
      setSections(parsedSections);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching content:', err);
      setError(err.message || 'Unable to load content. Please check your internet connection.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadme();
  }, []);

  // Add a useEffect to update originalSections when needed
  useEffect(() => {
    // Only update if we have sections and we're not searching
    if (sections.length > 0 && (!searchQuery || searchQuery.length < 2)) {
      // Keep track of expansion states in originalSections, but only when not searching
      const updateOriginalWithExpansionStates = () => {
        // Create helper function to copy expansion states
        const copyExpansionStates = (source, target) => {
          if (!source || !target) return;
          
          for (let i = 0; i < source.length && i < target.length; i++) {
            if (source[i].title === target[i].title) {
              // Only copy isExpanded property
              target[i].isExpanded = source[i].isExpanded;
              
              // Recursively update subsections
              if (source[i].subsections && target[i].subsections) {
                copyExpansionStates(source[i].subsections, target[i].subsections);
              }
            }
          }
        };
        
        // Make a deep copy of originalSections
        const updatedOriginalSections = JSON.parse(JSON.stringify(originalSections));
        
        // Copy expansion states from sections to updatedOriginalSections
        copyExpansionStates(sections, updatedOriginalSections);
        
        // Update the state only if there are actual changes
        setOriginalSections(updatedOriginalSections);
      };
      
      // Call the update function
      updateOriginalWithExpansionStates();
    }
  }, [sections]);  // Only depend on sections to avoid unnecessary updates

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

    // First, save original expansion states for ALL sections (both matching and non-matching)
    // This is critical for restoring the correct state later
    const saveOriginalStates = (sectionsArray) => {
      sectionsArray.forEach(section => {
        if (!section.isTitle) {
          section._originalExpanded = section.isExpanded;
          
          if (section.subsections) {
            saveOriginalStates(section.subsections);
          }
        }
      });
    };
    
    // Make a deep copy of sections to avoid mutating the original
    const sectionsCopy = JSON.parse(JSON.stringify(sections));
    
    // Save expansion states before filtering
    saveOriginalStates(sectionsCopy);

    // Filter non-title sections
    const filteredSections = sectionsCopy.filter(section => {
      // Always keep title sections, but they don't count as matches for empty state check
      if (section.isTitle) {
        return true;
      }

      return filterSection(section);
    });
    
    // Check if we have any actual content sections (non-title) after filtering
    const hasContentSections = filteredSections.some(section => !section.isTitle);
    
    // If we only have title sections but no content sections, return an empty array
    // This will trigger the empty state
    if (!hasContentSections) {
      return [];
    }
    
    return filteredSections;

    function filterSection(section) {
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

      // If section matches the search criteria
      if (titleMatches || contentMatches || hasMatchingSubsections) {
        // Force this section to be expanded for better UX
        section.isExpanded = true;
        return true;
      }
      
      // Section doesn't match, it will be filtered out
      return false;
    }
  };

  // Modify the handleSearchQueryChange function to preserve expansion states
  const handleSearchQueryChange = (newQuery) => {
    setSearchQuery(newQuery);
    
    // If the query is cleared or too short, restore all sections while preserving expansion states
    if (!newQuery || newQuery.length < 2) {
      setSections(prevSections => {
        // Create a map to store expansion states from both current sections 
        // and their stored original states
        const expansionStatesMap = new Map();
        
        // Collect expansion states from current sections
        const collectExpansionStates = (sections) => {
          sections.forEach(section => {
            if (!section.isTitle) {
              // Use _originalExpanded if available, otherwise use current state
              const expansionState = section._originalExpanded !== undefined ? 
                section._originalExpanded : section.isExpanded;
              
              expansionStatesMap.set(section.title, expansionState);
              
              if (section.subsections) {
                collectExpansionStates(section.subsections);
              }
            }
          });
        };
        
        collectExpansionStates(prevSections);

        // Restore original sections structure
        const newSections = JSON.parse(JSON.stringify(originalSections));
        
        // Apply saved expansion states to restored sections
        const applyExpansionStates = (sections) => {
          sections.forEach(section => {
            if (!section.isTitle && expansionStatesMap.has(section.title)) {
              const originalState = expansionStatesMap.get(section.title);
              section.isExpanded = originalState;
            }
            
            if (section.subsections) {
              applyExpansionStates(section.subsections);
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

  // Update TitleSection component to include a long press handler
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
    if (showSearch) {
      handleSearchQueryChange('');
    }
    setShowSearch(!showSearch);
  };

  // If still loading, return null to keep native splash screen visible
  if (loading) {
    return null;
  }

  // Only render app content once loading is complete
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Unable to Load Rules</Text>
            <View style={styles.centered}>
              <Markdown style={markdownStyles}>
                {"# Error\n\n" + error}
              </Markdown>
            </View>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchReadme()}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      {/* Main Content Area */}
      <View style={styles.mainContainer}>
        {activeTab === 'rules' ? (
          <RulesScreen 
            content={content}
            sections={sections}
            searchQuery={searchQuery}
            showSearch={showSearch}
            toggleSearchBar={toggleSearchBar}
            handleSearchQueryChange={handleSearchQueryChange}
            searchInputRef={searchInputRef}
            renderSection={renderSection}
            scrollViewRef={scrollViewRef}
          />
        ) : (
          <InfoSettingsScreen lastFetchDate={lastFetchDate} />
        )}
      </View>
      
      {/* Bottom Tab Navigation - Always visible */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'rules' && styles.activeTabButton]} 
          onPress={() => setActiveTab('rules')}
        >
          <View style={[styles.tabIconContainer, activeTab === 'rules' && styles.activeTabIconContainer]}>
            <Svg width="32" height="32" viewBox="0 -960 960 960" style={styles.tabIcon}>
              <Path
                d="M320-160q-33 0-56.5-23.5T240-240v-120h120v-90q-35-2-66.5-15.5T236-506v-44h-46L60-680q36-46 89-65t107-19q27 0 52.5 4t51.5 15v-55h480v520q0 50-35 85t-85 35H320Zm120-200h240v80q0 17 11.5 28.5T720-240q17 0 28.5-11.5T760-280v-440H440v24l240 240v56h-56L510-514l-8 8q-14 14-29.5 25T440-464v104ZM224-630h92v86q12 8 25 11t27 3q23 0 41.5-7t36.5-25l8-8-56-56q-29-29-65-43.5T256-684q-20 0-38 3t-36 9l42 42Zm376 350H320v40h286q-3-9-4.5-19t-1.5-21Zm-280 40v-40 40Z"
                fill={activeTab === 'rules' ? '#121212' : '#E1E1E1'}
              />
            </Svg>
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'info' && styles.activeTabButton]} 
          onPress={() => setActiveTab('info')}
        >
          <View style={[styles.tabIconContainer, activeTab === 'info' && styles.activeTabIconContainer]}>
            <Svg width="32" height="32" viewBox="0 -960 960 960" style={styles.tabIcon}>
              <Path
                d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"
                fill={activeTab === 'info' ? '#121212' : '#E1E1E1'}
              />
            </Svg>
          </View>
        </TouchableOpacity>
      </View>
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
    paddingTop: StatusBar.currentHeight,
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
    paddingTop: 80,
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
    paddingTop: StatusBar.currentHeight,
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
    fontWeight: 'bold',
  },
  emptyStateContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  emptyStateIcon: {
    fontSize: 50,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 10,
    textAlign: 'center',
  },
  mainContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 60,
    paddingBottom: 8,
    backgroundColor: '#121212',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  activeTabButton: {
    backgroundColor: 'transparent',
  },
  tabIconContainer: {
    width: 80,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  activeTabIconContainer: {
    backgroundColor: '#BB86FC',
    borderRadius: 16,
  },
  tabIcon: {
    width: 32,
    height: 32,
  },
  activeTabIcon: {
    backgroundColor: 'transparent',
  },
  tabButtonText: {
    fontSize: 10,
    color: '#E1E1E1',
    marginTop: 2,
  },
  activeTabButtonText: {
    color: '#121212',
    fontWeight: '600',
  },
  infoContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  infoTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#BB86FC',
    marginBottom: 30,
    textAlign: 'center',
    textShadowColor: 'rgba(187, 134, 252, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  infoCard: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(187, 134, 252, 0.3)',
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    width: '100%',
    shadowColor: '#BB86FC',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#BB86FC',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.9,
  },
  infoValue: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  changelogContainer: {
    marginTop: 20,
  },
  changelogTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#BB86FC',
    marginBottom: 16,
  },
  versionContainer: {
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(187, 134, 252, 0.3)',
    borderRadius: 8,
    marginBottom: 8,
  },
  versionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  versionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#BB86FC',
    marginRight: 12,
  },
  versionDate: {
    fontSize: 16,
    color: '#E1E1E1',
    marginRight: 12,
  },
  versionArrow: {
    color: '#BB86FC',
    fontSize: 16,
  },
  versionContentContainer: {
    overflow: 'hidden',
  },
  versionContent: {
    paddingTop: 12,
    paddingLeft: 12,
    paddingRight: 12,
    paddingBottom: 12,
  },
  changelogSubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#BB86FC',
    marginBottom: 8,
  },
  changelogItem: {
    fontSize: 16,
    color: '#E1E1E1',
  },
  currentVersionBadge: {
    backgroundColor: '#03DAC6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 4,
  },
  currentVersionText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#121212',
  },
  latestBadge: {
    borderWidth: 1,
    borderColor: '#2E7D32',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  latestBadgeText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: 'bold',
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  code_block: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginVertical: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fence: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginVertical: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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

// Add AppRegistry registration
import { AppRegistry } from 'react-native';
AppRegistry.registerComponent('LordsAndLadsRulesApp', () => App);