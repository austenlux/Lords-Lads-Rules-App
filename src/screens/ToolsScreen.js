/**
 * Tools tab: placeholder for future tools (e.g. calculators, utilities).
 */
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { HEADER_HEIGHT } from '../styles';

export default function ToolsScreen({ styles }) {
  return (
    <ScrollView style={styles.scrollView}>
      <View style={[styles.contentContainer, { paddingTop: HEADER_HEIGHT }]}>
        <View style={styles.aboutContainer}>
          <Text style={styles.aboutTitle}>Tools</Text>
          <Text style={styles.aboutTimestamp}>Coming soon.</Text>
        </View>
      </View>
    </ScrollView>
  );
}
