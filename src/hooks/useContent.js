/**
 * Hook that owns all content/sections state, cache fetch, search, and section navigation.
 * Returns state, refs, handlers, and renderSection for use by App.
 */
import { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
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
  const sectionRefs = useRef({});
  const searchInputRef = useRef(null);

  const loadCachedContent = async () => {
    try {
      const { rulesMarkdown, expansionTexts, lastFetchDate: cachedDate } = await getCachedContent();
      if (cachedDate) setLastFetchDate(cachedDate);
      let hasCachedData = false;
      if (rulesMarkdown) {
        setContent(rulesMarkdown);
        const parsed = parseMarkdownSections(rulesMarkdown);
        setOriginalSections(parsed);
        setSections(parsed);
        hasCachedData = true;
      }
      if (expansionTexts) {
        const allExpansionTexts = JSON.parse(expansionTexts);
        const { mainContent, sections: expSections } = buildExpansionSections(allExpansionTexts);
        setExpansionsContent(mainContent);
        const sectionsCopy = JSON.parse(JSON.stringify(expSections));
        setExpansionSections(expSections);
        setOriginalExpansionSections(sectionsCopy);
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
    setSections(result.sections);
    return true;
  };

  const fetchExpansions = async () => {
    const result = await fetchExpansionsFromService();
    if (!result.success || result.sections == null) return false;
    setExpansionsContent(result.mainContent);
    const sectionsCopy = JSON.parse(JSON.stringify(result.sections));
    setExpansionSections(result.sections);
    setOriginalExpansionSections(sectionsCopy);
    return true;
  };

  useEffect(() => {
    if (originalExpansionSections.length > 0 && (!searchQuery || searchQuery.length < 2)) {
      setExpansionSections(JSON.parse(JSON.stringify(originalExpansionSections)));
    }
  }, []);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 10);
    }
  }, [showSearch]);

  useEffect(() => {
    if (activeTab === 'expansions' && originalExpansionSections.length > 0 && (!searchQuery || searchQuery.length < 2)) {
      setExpansionSections(JSON.parse(JSON.stringify(originalExpansionSections)));
    } else if (activeTab === 'rules' && originalSections.length > 0 && (!searchQuery || searchQuery.length < 2)) {
      setSections(JSON.parse(JSON.stringify(originalSections)));
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    if (searchQuery && searchQuery.length >= 2) {
      if (activeTab === 'rules' && originalSections.length > 0) {
        setSections(filterSectionsBySearch(JSON.parse(JSON.stringify(originalSections)), searchQuery));
      } else if (activeTab === 'expansions' && originalExpansionSections.length > 0) {
        setExpansionSections(filterSectionsBySearch(JSON.parse(JSON.stringify(originalExpansionSections)), searchQuery));
      }
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    if (expansionSections.length > 0 && (!searchQuery || searchQuery.length < 2)) {
      const currentJSON = JSON.stringify(expansionSections);
      const originalJSON = JSON.stringify(originalExpansionSections);
      if (originalExpansionSections.length === 0 || currentJSON !== originalJSON) {
        setOriginalExpansionSections(JSON.parse(JSON.stringify(expansionSections)));
      }
    }
  }, [expansionSections, searchQuery]);

  useEffect(() => {
    if (activeTab !== 'expansions') return;
    if (expansionSections.length === 0 && (!searchQuery || searchQuery.length < 2)) {
      if (originalExpansionSections.length > 0) {
        setExpansionSections(JSON.parse(JSON.stringify(originalExpansionSections)));
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

    setTimeout(() => {
      if (!actualTitle) return;
      const ref = sectionRefs.current[actualTitle];
      if (ref && scrollViewRef.current) {
        ref.measureLayout(scrollViewRef.current, (x, y) => {
          scrollViewRef.current?.scrollTo({ y: y - 20, animated: true });
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
    scrollViewRef,
    sectionRefs,
    searchInputRef,
    fetchExpansions,
    filterSectionsBySearch,
    handleSearchQueryChange,
    toggleSearchBar,
    renderSection,
  };
}
