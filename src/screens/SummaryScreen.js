/**
 * Summary screen: displays AI-generated summaries of Rules and Expansions
 * content with a segmented control to switch between them. Uses the same
 * collapsible section UI as the Rules/Expansions tabs.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { parseMarkdownSections } from '../services/contentService';
import { useTheme } from '../context/ThemeContext';
import { TitleSection, Section } from '../components';

const SEGMENTS = [
  { key: 'rules', label: 'Rules' },
  { key: 'expansions', label: 'Expansions' },
];

export default function SummaryScreen({
  rulesSummary,
  expansionsSummary,
  summaryStatus,
  styles,
  markdownStyles,
  contentHeight,
  contentPaddingTop,
}) {
  const { accent, titleFontStyle, bodyFontStyle } = useTheme();
  const [activeSegment, setActiveSegment] = useState('rules');
  const scrollViewRef = useRef(null);
  const sectionRefs = useRef({});

  const [rulesSections, setRulesSections] = useState([]);
  const [expansionsSections, setExpansionsSections] = useState([]);

  useEffect(() => {
    setRulesSections(rulesSummary ? parseMarkdownSections(rulesSummary) : []);
  }, [rulesSummary]);

  useEffect(() => {
    setExpansionsSections(expansionsSummary ? parseMarkdownSections(expansionsSummary) : []);
  }, [expansionsSummary]);

  const sections = activeSegment === 'rules' ? rulesSections : expansionsSections;
  const status = activeSegment === 'rules' ? summaryStatus.rules : summaryStatus.expansions;

  const toggleSection = useCallback((path) => {
    const setter = activeSegment === 'rules' ? setRulesSections : setExpansionsSections;
    setter(prev => {
      if (!prev?.length) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      function toggle(obj, pathParts) {
        if (!obj || !pathParts?.length) return;
        if (pathParts.length === 1) {
          if (obj[pathParts[0]]) obj[pathParts[0]].isExpanded = !obj[pathParts[0]].isExpanded;
          return;
        }
        const [cur, ...rest] = pathParts;
        if (cur === 'subsections' && obj.subsections) toggle(obj.subsections, rest);
        else if (obj[cur]) toggle(obj[cur], rest);
      }
      toggle(next, path.map(String));
      return next;
    });
  }, [activeSegment]);

  const noopNavigate = useCallback(() => {}, []);

  const renderSection = useCallback((section, index, parentPath = []) => {
    const path = [...parentPath, index];
    if (section.isTitle) {
      return (
        <TitleSection
          key={index}
          title={section.title}
          content={section.content}
          styles={styles}
          markdownStyles={markdownStyles}
        />
      );
    }
    return (
      <View key={index}>
        <Section
          {...section}
          path={path}
          onPress={toggleSection}
          onNavigate={noopNavigate}
          sectionRefs={sectionRefs.current}
          styles={styles}
          markdownStyles={markdownStyles}
        />
      </View>
    );
  }, [toggleSection, noopNavigate, styles, markdownStyles]);

  const isLoading = status?.status === 'generating';
  const isError = status?.status === 'error';
  const isNotAvailable = status?.status === 'not_available';
  const hasContent = sections.length > 0;

  const handleSegmentChange = useCallback((segment) => {
    setActiveSegment(segment);
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  return (
    <ScrollView
      ref={scrollViewRef}
      style={[
        styles.scrollView,
        contentHeight != null && (
          Platform.OS === 'ios'
            ? { minHeight: contentHeight }
            : { height: contentHeight, minHeight: contentHeight }
        ),
      ]}
      contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}
    >
      <View style={[styles.contentContainer, contentPaddingTop != null && { paddingTop: contentPaddingTop }]}>
        {/* Segmented control */}
        <View style={[segmentedStyles.container, { borderColor: `${accent}40` }]}>
          {SEGMENTS.map(({ key, label }) => {
            const isActive = activeSegment === key;
            return (
              <TouchableOpacity
                key={key}
                style={[segmentedStyles.button, isActive && [segmentedStyles.activeButton, { backgroundColor: accent }]]}
                onPress={() => handleSegmentChange(key)}
                activeOpacity={0.7}
              >
                <Text style={[segmentedStyles.buttonText, bodyFontStyle, isActive && segmentedStyles.activeButtonText]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content area */}
        {isLoading && !hasContent ? (
          <View style={styles.emptyStateContainer}>
            <ActivityIndicator size="large" color={accent} />
            <Text style={[styles.emptyStateTitle, { color: accent, marginTop: 20 }, titleFontStyle]}>
              Generating summary…
            </Text>
            {status?.progress && (
              <Text style={[styles.emptyStateText, bodyFontStyle]}>
                Section {status.progress.current} of {status.progress.total}
                {status.progress.section ? `\n${status.progress.section}` : ''}
              </Text>
            )}
          </View>
        ) : isError ? (
          <View style={styles.emptyStateContainer}>
            <Text style={[styles.emptyStateTitle, { color: '#CF6679' }, titleFontStyle]}>
              Summary generation failed
            </Text>
            <Text style={[styles.emptyStateText, bodyFontStyle]}>
              The AI summary could not be generated. Check the Debug menu for details.
            </Text>
          </View>
        ) : isNotAvailable && !hasContent ? (
          <View style={styles.emptyStateContainer}>
            <Text style={[styles.emptyStateTitle, { color: accent }, titleFontStyle]}>
              Summary not available
            </Text>
            <Text style={[styles.emptyStateText, bodyFontStyle]}>
              AI summaries require the voice assistant model to be available. Check the Debug menu for status.
            </Text>
          </View>
        ) : hasContent ? (
          sections.map((section, index) => renderSection(section, index))
        ) : null}
      </View>
    </ScrollView>
  );
}

const segmentedStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    borderRadius: 0,
  },
  buttonText: {
    fontSize: 15,
    color: '#888',
    fontWeight: '600',
  },
  activeButtonText: {
    color: '#121212',
    fontWeight: '700',
  },
});
