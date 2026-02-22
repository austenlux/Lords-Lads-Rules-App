/**
 * Hook that owns all content/sections state, cache fetch, search, and section navigation.
 * Returns state, refs, handlers, and renderSection for use by App.
 */
import { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCachedContent,
  fetchRules,
  fetchExpansions as fetchExpansionsFromService,
  saveLastFetchDate,
  buildExpansionSections,
  parseMarkdownSections,
} from '../services/contentService';
import { normalizeSearchQuery } from '../utils/searchUtils';
import { TitleSection, Section } from '../components';

const EXPAND_SETTINGS_KEYS = {
  RULES: '@lnl_expand_rules_default',
  EXPANSIONS: '@lnl_expand_expansions_default',
};

function applyExpandPreference(sections, expandAll) {
  if (!sections || !expandAll) return sections;
  const out = JSON.parse(JSON.stringify(sections));
  const setExpanded = (list) => {
    (list || []).forEach((s) => {
      if (s.hasOwnProperty('isExpanded')) s.isExpanded = true;
      if (s.subsections?.length) setExpanded(s.subsections);
    });
  };
  setExpanded(out);
  return out;
}

export function useContent(styles, markdownStyles) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState('');
  const [expansionsContent, setExpansionsContent] = useState('');
  const [expansionSections, setExpansionSections] = useState([]);
  const [originalExpansionSections, setOriginalExpansionSections] = useState([]);
  const [originalSections, setOriginalSections] = useState([]);
  const [sections, setSections] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState('rules');
  const [lastFetchDate, setLastFetchDate] = useState(null);

  const scrollViewRef = useRef(null);
  const rulesScrollViewRef = useRef(null);
  const expansionsScrollViewRef = useRef(null);
  const scrollYByTab = useRef({ rules: 0, expansions: 0 });
  const prevSearchQueryLen = useRef(0);
  const sectionRefs = useRef({});
  const searchInputRef = useRef(null);

  const loadCachedContent = async () => {
    try {
      const [expandRules, expandExpansions] = await Promise.all([
        AsyncStorage.getItem(EXPAND_SETTINGS_KEYS.RULES),
        AsyncStorage.getItem(EXPAND_SETTINGS_KEYS.EXPANSIONS),
      ]);
      const expandRulesDefault = expandRules === 'true';
      const expandExpansionsDefault = expandExpansions === 'true';

      const { rulesMarkdown, expansionTexts, lastFetchDate: cachedDate } = await getCachedContent();
      if (cachedDate) setLastFetchDate(cachedDate);
      let hasCachedData = false;
      if (rulesMarkdown) {
        setContent(rulesMarkdown);
        const parsed = parseMarkdownSections(rulesMarkdown);
        setOriginalSections(parsed);
        setSections(applyExpandPreference(parsed, expandRulesDefault));
        hasCachedData = true;
      }
      if (expansionTexts) {
        const allExpansionTexts = JSON.parse(expansionTexts);
        const { mainContent, sections: expSections } = buildExpansionSections(allExpansionTexts);
        setExpansionsContent(mainContent);
        const sectionsCopy = JSON.parse(JSON.stringify(expSections));
        setOriginalExpansionSections(sectionsCopy);
        setExpansionSections(applyExpandPreference(expSections, expandExpansionsDefault));
        hasCachedData = true;
      }
      return hasCachedData;
    } catch (err) {
      console.error('Error loading cached content:', err);
      return false;
    }
  };

  const fetchReadme = async () => {
    const result = await fetchRules();
    if (!result.success || !result.rulesText) return false;
    setContent(result.rulesText);
    setOriginalSections(result.sections);
    const expandRules = await AsyncStorage.getItem(EXPAND_SETTINGS_KEYS.RULES);
    setSections(applyExpandPreference(result.sections, expandRules === 'true'));
    return true;
  };

  const fetchExpansions = async () => {
    const result = await fetchExpansionsFromService();
    if (!result.success || result.sections == null) return false;
    setExpansionsContent(result.mainContent);
    const sectionsCopy = JSON.parse(JSON.stringify(result.sections));
    setOriginalExpansionSections(sectionsCopy);
    const expandExpansions = await AsyncStorage.getItem(EXPAND_SETTINGS_KEYS.EXPANSIONS);
    setExpansionSections(applyExpandPreference(result.sections, expandExpansions === 'true'));
    return true;
  };

  useEffect(() => {
    if (originalExpansionSections.length === 0 || (searchQuery && searchQuery.length >= 2)) return;
    const apply = async () => {
      const expand = await AsyncStorage.getItem(EXPAND_SETTINGS_KEYS.EXPANSIONS);
      setExpansionSections(applyExpandPreference(JSON.parse(JSON.stringify(originalExpansionSections)), expand === 'true'));
    };
    apply();
  }, [originalExpansionSections.length]);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 10);
    }
  }, [showSearch]);

  // When switching to About tab, cancel search (close bar, dismiss keyboard, clear query) so search isn't active while hidden.
  // Clearing searchQuery triggers the "search cleared" effect below to restore unfiltered sections and remove highlighting.
  useEffect(() => {
    if (activeTab === 'about') {
      setShowSearch(false);
      setSearchQuery('');
      searchInputRef.current?.blur();
    }
  }, [activeTab]);

  // When search is cleared (user tapped X), restore both tabs to full content (with expand preference).
  useEffect(() => {
    const queryLen = searchQuery?.length ?? 0;
    const hadSearch = prevSearchQueryLen.current >= 2;
    prevSearchQueryLen.current = queryLen;
    if (!hadSearch || queryLen >= 2) return;
    const apply = async () => {
      const [expandRules, expandExpansions] = await Promise.all([
        AsyncStorage.getItem(EXPAND_SETTINGS_KEYS.RULES),
        AsyncStorage.getItem(EXPAND_SETTINGS_KEYS.EXPANSIONS),
      ]);
      if (originalSections.length > 0) {
        setSections(applyExpandPreference(JSON.parse(JSON.stringify(originalSections)), expandRules === 'true'));
      }
      if (originalExpansionSections.length > 0) {
        setExpansionSections(applyExpandPreference(JSON.parse(JSON.stringify(originalExpansionSections)), expandExpansions === 'true'));
      }
    };
    apply();
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery && searchQuery.length >= 2) {
      if (activeTab === 'rules' && originalSections.length > 0) {
        setSections(filterSectionsBySearch(JSON.parse(JSON.stringify(originalSections)), searchQuery));
      } else if (activeTab === 'expansions' && originalExpansionSections.length > 0) {
        setExpansionSections(filterSectionsBySearch(JSON.parse(JSON.stringify(originalExpansionSections)), searchQuery));
      }
    }
  }, [activeTab, searchQuery]);

  // Only backfill originalExpansionSections when still empty (e.g. after first load).
  // Do not overwrite with expansionSections when they differ, or we'd replace the full
  // original with a filtered list when user clears search while on another tab.
  useEffect(() => {
    if (originalExpansionSections.length === 0 && expansionSections.length > 0 && (!searchQuery || searchQuery.length < 2)) {
      setOriginalExpansionSections(JSON.parse(JSON.stringify(expansionSections)));
    }
  }, [expansionSections, searchQuery, originalExpansionSections.length]);

  useEffect(() => {
    if (activeTab !== 'expansions') return;
    if (expansionSections.length === 0 && (!searchQuery || searchQuery.length < 2)) {
      if (originalExpansionSections.length > 0) {
        (async () => {
          const expand = await AsyncStorage.getItem(EXPAND_SETTINGS_KEYS.EXPANSIONS);
          setExpansionSections(applyExpandPreference(JSON.parse(JSON.stringify(originalExpansionSections)), expand === 'true'));
        })();
      } else {
        fetchExpansions();
      }
    }
  }, [activeTab, expansionSections.length, originalExpansionSections.length, searchQuery]);

  useEffect(() => {
    const init = async () => {
      const hasCachedData = await loadCachedContent();
      if (hasCachedData) setLoading(false);
      const [rulesOk, expansionsOk] = await Promise.all([fetchReadme(), fetchExpansions()]);
      if (rulesOk || expansionsOk) {
        const now = new Date().toLocaleString();
        setLastFetchDate(now);
        await saveLastFetchDate(now);
      }
      if (!hasCachedData && !rulesOk && !expansionsOk) {
        setError('Unable to load content. Please check your internet connection.');
      }
      setLoading(false);
    };
    init();
  }, []);

  function findSectionPath(sectionsList, targetTitle, currentPath = []) {
    if (!sectionsList || !targetTitle) return null;
    const normalizeTitle = (t) => (t || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    const normalizedTarget = normalizeTitle(targetTitle);
    for (let i = 0; i < sectionsList.length; i++) {
      const section = sectionsList[i];
      if (!section?.title) continue;
      if (section.title === targetTitle || normalizeTitle(section.title) === normalizedTarget) {
        return [...currentPath, i];
      }
      if (section.subsections?.length > 0) {
        const sub = findSectionPath(section.subsections, targetTitle, [...currentPath, i, 'subsections']);
        if (sub) return sub;
      }
    }
    return null;
  }

  function filterSectionsBySearch(sectionsList, query) {
    const q = normalizeSearchQuery(query);
    if (!q || q.length < 2) return sectionsList;
    const copy = JSON.parse(JSON.stringify(sectionsList));
    const queryLower = q.toLowerCase();

    function process(section) {
      if (!section) return false;
      const titleMatch = section.title?.toLowerCase().includes(queryLower);
      const contentMatch = section.content?.toLowerCase().includes(queryLower);
      let hasSub = false;
      if (section.subsections?.length > 0) {
        section.subsections = section.subsections.filter((s) => process(s));
        hasSub = section.subsections.length > 0;
      }
      if (titleMatch || contentMatch || hasSub) {
        section.isExpanded = true;
        return true;
      }
      return false;
    }

    const filtered = copy.filter((s) => s.isTitle || process(s));
    const hasContent = filtered.some((s) => !s.isTitle);
    return hasContent ? filtered : [];
  }

  const collapseAllAndExpandSection = (sectionTitle) => {
    if (!sectionTitle || !sections?.length) return;
    let path = findSectionPath(sections, sectionTitle);
    if (!path) {
      const variations = [
        sectionTitle,
        sectionTitle.replace('---', ' - '),
        `${sectionTitle.toUpperCase()} - ${sectionTitle}`,
        sectionTitle.replace(/^([iv]+)---/i, '$1 - '),
      ];
      for (const v of variations) {
        path = findSectionPath(sections, v);
        if (path) break;
      }
    }
    if (!path) return;

    let actualTitle = null;
    let current = sections;
    for (let i = 0; i < path.length; i++) {
      const part = path[i];
      if (part === 'subsections') continue;
      if (current[part]) {
        actualTitle = current[part].title;
        if (i < path.length - 1 && current[part].subsections) current = current[part].subsections;
      }
    }

    setSections((prev) => {
      if (!prev?.length) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      function collapseAll(list) {
        list?.forEach((s) => {
          if (!s?.isTitle) {
            s.isExpanded = false;
            if (s.subsections) collapseAll(s.subsections);
          }
        });
      }
      collapseAll(next);
      let cur = next;
      for (let i = 0; i < path.length; i++) {
        if (path[i] === 'subsections') continue;
        if (cur?.[path[i]]) {
          cur[path[i]].isExpanded = true;
          if (i < path.length - 1 && cur[path[i]].subsections) cur = cur[path[i]].subsections;
        }
      }
      return next;
    });

    const scrollRef = activeTab === 'rules' ? rulesScrollViewRef : expansionsScrollViewRef;
    setTimeout(() => {
      if (!actualTitle) return;
      const ref = sectionRefs.current[actualTitle];
      if (ref && scrollRef.current) {
        ref.measureLayout(scrollRef.current, (x, y) => {
          scrollRef.current?.scrollTo({ y: y - 20, animated: true });
        }, () => {});
      }
    }, 100);
  };

  const toggleSection = (path) => {
    if (!path) return;
    setSections((prev) => {
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
  };

  const toggleExpansionSection = (path) => {
    if (!path) return;
    setExpansionSections((prev) => {
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
  };

  const handleSearchQueryChange = (newQuery) => {
    setSearchQuery(newQuery);
    const normalized = normalizeSearchQuery(newQuery);
    if (normalized.length >= 2) {
      if (activeTab === 'rules') {
        setSections(filterSectionsBySearch(JSON.parse(JSON.stringify(originalSections)), normalized));
      } else if (activeTab === 'expansions') {
        setExpansionSections(filterSectionsBySearch(JSON.parse(JSON.stringify(originalExpansionSections)), normalized));
      }
    } else if (searchQuery && normalizeSearchQuery(searchQuery).length >= 2) {
      if (activeTab === 'rules') setSections(JSON.parse(JSON.stringify(originalSections)));
      else if (activeTab === 'expansions') setExpansionSections(JSON.parse(JSON.stringify(originalExpansionSections)));
    }
  };

  const toggleSearchBar = () => {
    if (showSearch && searchQuery?.length >= 2) {
      setSearchQuery('');
      if (activeTab === 'rules') setSections(JSON.parse(JSON.stringify(originalSections)));
      else if (activeTab === 'expansions') {
        if (originalExpansionSections.length > 0) {
          setExpansionSections(JSON.parse(JSON.stringify(originalExpansionSections)));
        } else {
          fetchExpansions();
        }
      }
    }
    setShowSearch((s) => !s);
  };

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
          styles={styles}
          markdownStyles={markdownStyles}
        />
      );
    }
    return (
      <View
        key={index}
        ref={(ref) => {
          if (ref) sectionRefs.current[section.title] = ref;
        }}
      >
        <Section
          {...section}
          path={path}
          onPress={activeTab === 'expansions' ? toggleExpansionSection : toggleSection}
          onNavigate={collapseAllAndExpandSection}
          sectionRefs={sectionRefs.current}
          searchQuery={searchQuery}
          styles={styles}
          markdownStyles={markdownStyles}
        />
      </View>
    );
  };

  const saveScrollY = (tab) => (e) => {
    scrollYByTab.current[tab] = e.nativeEvent.contentOffset.y;
  };

  useEffect(() => {
    const y = scrollYByTab.current[activeTab];
    const ref = activeTab === 'rules' ? rulesScrollViewRef : activeTab === 'expansions' ? expansionsScrollViewRef : null;
    if (ref?.current != null && typeof y === 'number') {
      const id = requestAnimationFrame(() => {
        ref.current?.scrollTo({ y, animated: false });
      });
      return () => cancelAnimationFrame(id);
    }
  }, [activeTab]);

  return {
    loading,
    error,
    content,
    expansionsContent,
    expansionSections,
    originalExpansionSections,
    originalSections,
    sections,
    searchQuery,
    showSearch,
    activeTab,
    setActiveTab,
    lastFetchDate,
    scrollViewRef: activeTab === 'rules' ? rulesScrollViewRef : expansionsScrollViewRef,
    rulesScrollViewRef,
    expansionsScrollViewRef,
    saveScrollY,
    sectionRefs,
    searchInputRef,
    fetchExpansions,
    filterSectionsBySearch,
    handleSearchQueryChange,
    toggleSearchBar,
    renderSection,
  };
}
