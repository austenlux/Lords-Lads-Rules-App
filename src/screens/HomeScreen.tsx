import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Markdown from 'react-native-markdown-package';
import { decode } from 'html-entities';

type RootStackParamList = {
  Home: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReadme();
  }, []);

  const fetchReadme = async () => {
    try {
      const response = await fetch('https://raw.githubusercontent.com/seanKenkeremath/lords-and-lads/master/README.md');
      if (!response.ok) {
        throw new Error('Failed to fetch README');
      }
      const text = await response.text();
      // Log the raw text for debugging
      console.log('Raw text:', text.substring(0, 200));
      const decodedText = decode(text);
      // Log the decoded text for debugging
      console.log('Decoded text:', decodedText.substring(0, 200));
      setMarkdown(decodedText);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f4511e" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Markdown styles={markdownStyles}>
            {"# Error\n\n" + error}
          </Markdown>
        </View>
      ) : (
        <Markdown 
          styles={markdownStyles}
          enableLightBox={false}
          useAnchor={false}
        >
          {markdown}
        </Markdown>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
});

const markdownStyles = {
  body: {
    color: '#333',
  },
  heading1: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#222',
  },
  heading2: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  heading3: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#444',
  },
  link: {
    color: '#f4511e',
  },
  listItem: {
    marginBottom: 8,
  },
  text: {
    marginBottom: 16,
    lineHeight: 22,
  },
}; 