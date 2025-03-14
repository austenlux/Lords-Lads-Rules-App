import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, ActivityIndicator, AppRegistry } from 'react-native';
import Markdown from 'react-native-markdown-display';

function App() {
  const [readme, setReadme] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReadme();
  }, []);

  const fetchReadme = async () => {
    try {
      const response = await fetch('https://raw.githubusercontent.com/seanKenkeremath/lords-and-lads/master/README.md');
      const text = await response.text();
      setReadme(text);
      setLoading(false);
    } catch (err) {
      setError('Failed to load rules. Please check your internet connection.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF5722" />
        <Text style={styles.loadingText}>Loading Lords & Lads Rules...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Markdown style={markdownStyles}>
            {readme}
          </Markdown>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    color: '#FF5722',
    fontSize: 16,
    textAlign: 'center',
  },
});

const markdownStyles = {
  heading1: {
    fontSize: 24,
    color: '#333',
    fontWeight: 'bold',
    marginVertical: 16,
  },
  heading2: {
    fontSize: 20,
    color: '#444',
    fontWeight: 'bold',
    marginVertical: 12,
  },
  heading3: {
    fontSize: 18,
    color: '#555',
    fontWeight: 'bold',
    marginVertical: 8,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginVertical: 8,
  },
  list_item: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  bullet_list: {
    marginLeft: 20,
  },
};

AppRegistry.registerComponent('lords-and-lads-rules', () => App);

export default App; 