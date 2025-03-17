import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Animated, TextInput } from 'react-native';
import Markdown from 'react-native-markdown-display';

const TitleSection = ({ title, content }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

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
          <Markdown style={{
            ...markdownStyles,
            heading1: {
              ...markdownStyles.heading1,
              fontSize: 48,
              textAlign: 'center',
              marginBottom: 24,
              color: '#BB86FC',
              fontWeight: 'bold',
              lineHeight: 56,
              textShadowColor: 'rgba(187, 134, 252, 0.3)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 20,
            },
            body: {
              ...markdownStyles.body,
              textAlign: 'center',
            }
          }}>
            {`# ${title}`}
          </Markdown>
        </View>
      </Animated.View>
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        width: '100%',
        alignItems: 'center',
      }}>
        <View style={styles.subtitleWrapper}>
          <Markdown style={{
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
          }}>
            {content}
          </Markdown>
        </View>
      </Animated.View>
      <View style={styles.titleDivider} />
    </View>
  );
};

const Section = ({ title, level, content, subsections, onPress, isExpanded, path = [], onNavigate, sectionRefs }) => {
  const animatedRotation = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

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
        <Text style={[styles.sectionTitle, { fontSize, color: '#BB86FC' }]}>{title}</Text>
      </TouchableOpacity>
      {isExpanded && (
        <View style={[styles.sectionContent, { paddingLeft: 16 }]}>
          {content && (
            <Markdown 
              style={markdownStyles}
              onLinkPress={handleLinkPress}
            >
              {content}
            </Markdown>
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
  const [sections, setSections] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchBarAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const sectionRefs = useRef({});

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
      setContent(text);
      setSections(parseMarkdownSections(text));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadme();
  }, []);

  const renderSection = (section, index, parentPath = []) => {
    const path = [...parentPath, index];
    
    if (section.isTitle) {
      return (
        <TitleSection
          key={index}
          title={section.title}
          content={section.content}
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
        />
      </View>
    );
  };

  const toggleSearchBar = () => {
    const toValue = showSearch ? 0 : 1;
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
              style={styles.searchInput}
              placeholder="Search rules..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
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
    marginBottom: 12,
    color: '#E1E1E1',
  },
  paragraph: {
    marginBottom: 20,
    color: '#E1E1E1',
  },
  bullet_list: {
    marginBottom: 20,
  },
  ordered_list: {
    marginBottom: 20,
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
};