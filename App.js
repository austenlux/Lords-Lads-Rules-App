import React, { useState, useEffect } from 'react';
import { 
  SafeAreaView, 
  ScrollView, 
  View, 
  Text, 
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Pressable
} from 'react-native';
import axios from 'axios';
import Markdown from 'react-native-markdown-display';

const TableOfContents = ({ sections, onSelectSection }) => (
  <View style={styles.tocContainer}>
    <Text style={styles.tocTitle}>Table of Contents</Text>
    {sections.map((section, index) => (
      <TouchableOpacity 
        key={index}
        style={styles.tocItem}
        onPress={() => onSelectSection(section)}
      >
        <Text style={styles.tocText}>{section}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const Header = () => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>Lords & Lads Rules</Text>
  </View>
);

const App = () => {
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sections, setSections] = useState([]);
  const scrollViewRef = React.useRef(null);

  const fetchReadme = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(
        'https://raw.githubusercontent.com/seanKenkeremath/lords-and-lads/master/README.md'
      );
      setMarkdown(response.data);
      
      // Extract sections from markdown
      const sectionMatches = response.data.match(/^#{1,2} .*$/gm) || [];
      const extractedSections = sectionMatches.map(section => 
        section.replace(/^#{1,2} /, '').trim()
      );
      setSections(extractedSections);
    } catch (err) {
      setError('Failed to load README. Pull down to refresh.');
      console.error('Error fetching README:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReadme();
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchReadme();
  }, []);

  const onSelectSection = (section) => {
    // Find the section in the markdown and scroll to it
    const lines = markdown.split('\n');
    let lineIndex = lines.findIndex(line => 
      line.replace(/^#{1,2} /, '').trim() === section
    );
    
    if (lineIndex !== -1) {
      // Approximate scroll position based on line number and average line height
      scrollViewRef.current?.scrollTo({
        y: lineIndex * 24, // Approximate line height
        animated: true
      });
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF5722" />
        <Text style={styles.loadingText}>Loading Rules...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchReadme}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header />
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <TableOfContents sections={sections} onSelectSection={onSelectSection} />
        <View style={styles.contentContainer}>
          <Markdown style={markdownStyles}>
            {markdown}
          </Markdown>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FF5722',
    padding: 16,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    color: '#FF5722',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  tocContainer: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  tocTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  tocItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tocText: {
    fontSize: 16,
    color: '#FF5722',
  },
});

const markdownStyles = {
  heading1: {
    fontSize: 24,
    color: '#FF5722',
    marginVertical: 16,
    fontWeight: 'bold',
  },
  heading2: {
    fontSize: 20,
    color: '#333',
    marginVertical: 12,
    fontWeight: 'bold',
  },
  heading3: {
    fontSize: 18,
    color: '#444',
    marginVertical: 8,
    fontWeight: 'bold',
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginVertical: 8,
  },
  list_item: {
    marginVertical: 4,
  },
  bullet_list: {
    marginVertical: 8,
  },
  ordered_list: {
    marginVertical: 8,
  },
  link: {
    color: '#FF5722',
  },
};

export default App; 