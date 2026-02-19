/**
 * Content service: cache read/write, GitHub fetch, and markdown parsing for
 * rules and expansions. No UI state; callers use returned data to update state.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CONTENT_URL,
  EXPANSIONS_URL,
  EXPANSIONS_BASE_URL,
  GITHUB_API_URL,
  CACHE_KEYS,
} from '../constants';

const FETCH_TIMEOUT_MS = 10000;

/**
 * Build expansion sections from an array of raw markdown texts.
 * First element is the main expansions README; rest are individual expansion READMEs.
 */
export function buildExpansionSections(allExpansionTexts) {
  const [mainReadme, ...expansionReadmes] = allExpansionTexts;
  const mainContent = mainReadme || '# Expansions\n\nNo content available.';
  const sections = [];

  sections.push({
    title: 'Expansions',
    level: 1,
    isTitle: true,
    content: mainReadme ? mainReadme.split('\n').slice(2).join('\n') : 'No content available.',
  });

  expansionReadmes
    .filter((text) => text !== null)
    .forEach((text) => {
      const lines = text.split('\n');
      let currentMainSection = null;
      let currentSubSection = null;
      let currentContent = [];

      const finalizeContent = () => currentContent.join('\n').trim();

      lines.forEach((line, index) => {
        if (line.startsWith('# ')) {
          if (currentMainSection) {
            if (currentSubSection) {
              currentSubSection.content = finalizeContent();
              currentMainSection.subsections.push(currentSubSection);
              currentSubSection = null;
            }
            sections.push(currentMainSection);
          }
          currentMainSection = {
            title: line.replace('# ', ''),
            content: '',
            level: 1,
            isExpanded: false,
            subsections: [],
          };
          currentContent = [];
        } else if (line.startsWith('## ')) {
          if (currentSubSection) {
            currentSubSection.content = finalizeContent();
            if (currentMainSection) {
              currentMainSection.subsections.push(currentSubSection);
            }
          }
          currentSubSection = {
            title: line.replace('## ', ''),
            content: '',
            level: 2,
            isExpanded: false,
            subsections: [],
          };
          currentContent = [];
        } else if (line.startsWith('### ')) {
          if (currentContent.length > 0 && currentSubSection) {
            currentSubSection.content = finalizeContent();
          }
          if (currentSubSection) {
            currentSubSection.subsections.push({
              title: line.replace('### ', ''),
              content: '',
              level: 3,
              isExpanded: false,
            });
          }
          currentContent = [];
        } else {
          currentContent.push(line);
        }

        if (index === lines.length - 1) {
          if (currentSubSection) {
            currentSubSection.content = finalizeContent();
            if (currentMainSection) {
              currentMainSection.subsections.push(currentSubSection);
            }
          } else if (currentMainSection) {
            currentMainSection.content = finalizeContent();
          }
          if (currentMainSection) {
            sections.push(currentMainSection);
          }
        }
      });
    });

  return { mainContent, sections };
}

/**
 * Parse rules markdown into a tree of sections (h1, h2, h3).
 */
export function parseMarkdownSections(text) {
  if (!text) return [];

  const lines = text.split('\n');
  const sections = [];
  let currentSection = null;
  let currentSubsection = null;
  let currentSubsubsection = null;
  let currentContent = [];
  let isFirstSection = true;

  const finalizeContent = () => {
    const content = currentContent
      .filter((line) => !line.match(/!\[.*?\]\(.*?\)/))
      .map((line) => line.replace(/`([^`]+)`/g, '`$1`'))
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

  lines.forEach((line) => {
    if (line.startsWith('# ')) {
      if (currentSection) {
        assignContent();
        sections.push(currentSection);
      }
      currentSubsubsection = null;
      currentSubsection = null;
      currentSection = {
        title: line.replace('# ', ''),
        level: 1,
        isTitle: isFirstSection,
        content: '',
        ...(isFirstSection ? {} : { isExpanded: false, subsections: [] }),
      };
      isFirstSection = false;
    } else if (line.startsWith('## ')) {
      assignContent();
      currentSubsubsection = null;
      if (currentSection && !currentSection.subsections) {
        currentSection.subsections = [];
      }
      currentSubsection = {
        title: line.replace('## ', ''),
        level: 2,
        isExpanded: false,
        subsections: [],
        content: '',
      };
      if (currentSection?.subsections) {
        currentSection.subsections.push(currentSubsection);
      }
    } else if (line.startsWith('### ')) {
      assignContent();
      if (currentSubsection && !currentSubsection.subsections) {
        currentSubsection.subsections = [];
      }
      currentSubsubsection = {
        title: line.replace('### ', ''),
        level: 3,
        isExpanded: false,
        content: '',
      };
      if (currentSubsection?.subsections) {
        currentSubsection.subsections.push(currentSubsubsection);
      }
    } else {
      currentContent.push(line);
    }
  });

  if (currentSection) {
    assignContent();
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Load cached rules markdown, expansion texts, and last fetch date.
 * @returns {Promise<{ rulesMarkdown: string|null, expansionTexts: string|null, lastFetchDate: string|null }>}
 */
export async function getCachedContent() {
  const [rulesMarkdown, expansionTexts, lastFetchDate] = await Promise.all([
    AsyncStorage.getItem(CACHE_KEYS.RULES_MARKDOWN),
    AsyncStorage.getItem(CACHE_KEYS.EXPANSION_TEXTS),
    AsyncStorage.getItem(CACHE_KEYS.LAST_FETCH_DATE),
  ]);
  return { rulesMarkdown, expansionTexts, lastFetchDate };
}

/**
 * Fetch rules README from network, persist to cache.
 * @returns {Promise<{ success: boolean, rulesText?: string, sections?: Array }>}
 */
export async function fetchRules() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(CONTENT_URL, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`Failed to fetch rules (Status: ${response.status})`);
      }
      const rulesText = await response.text();
      await AsyncStorage.setItem(CACHE_KEYS.RULES_MARKDOWN, rulesText);
      const sections = parseMarkdownSections(rulesText);
      return { success: true, rulesText, sections };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  } catch (err) {
    console.error('Error fetching rules:', err);
    return { success: false };
  }
}

/**
 * Fetch expansions directory and all expansion READMEs, persist to cache.
 * @returns {Promise<{ success: boolean, mainContent?: string, sections?: Array, allExpansionTexts?: Array }>}
 */
export async function fetchExpansions() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const directoryResponse = await fetch(GITHUB_API_URL, { signal: controller.signal });
      if (!directoryResponse.ok) {
        throw new Error(`Failed to fetch expansions directory (Status: ${directoryResponse.status})`);
      }
      const directoryContents = await directoryResponse.json();
      const expansionFolders = directoryContents
        .filter((item) => item.type === 'dir')
        .map((item) => item.name);

      const expansionPromises = expansionFolders.map((folder) =>
        fetch(`${EXPANSIONS_BASE_URL}/${folder}/README.md`, { signal: controller.signal })
          .then((res) => (res.ok ? res.text() : null))
          .catch(() => null)
      );

      expansionPromises.unshift(
        fetch(EXPANSIONS_URL, { signal: controller.signal })
          .then((res) =>
            res.ok ? res.text() : '# Expansions\n\nExpansion content unavailable.'
          )
          .catch(() => '# Expansions\n\nExpansion content unavailable.')
      );

      const allExpansionTexts = await Promise.all(expansionPromises);
      clearTimeout(timeoutId);

      const { mainContent, sections } = buildExpansionSections(allExpansionTexts);
      const cacheData = [
        allExpansionTexts[0],
        ...allExpansionTexts.slice(1).filter((t) => t !== null),
      ];
      await AsyncStorage.setItem(CACHE_KEYS.EXPANSION_TEXTS, JSON.stringify(cacheData));

      return { success: true, mainContent, sections, allExpansionTexts };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  } catch (err) {
    console.error('Error fetching expansions:', err);
    return { success: false };
  }
}

/**
 * Persist last fetch date to cache.
 */
export async function saveLastFetchDate(dateString) {
  await AsyncStorage.setItem(CACHE_KEYS.LAST_FETCH_DATE, dateString);
}
