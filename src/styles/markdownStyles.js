/**
 * Styles for react-native-markdown-display (headings, links, code, tables, etc.).
 */
import { Platform } from 'react-native';

const monospace = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const createMarkdownStyles = (ACCENT_COLOR, titleFont, bodyFont) => ({
  body: {
    color: '#E1E1E1',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: bodyFont,
  },
  heading1: {
    color: ACCENT_COLOR,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 0,
    marginTop: 0,
    lineHeight: 40,
    fontFamily: titleFont,
  },
  heading2: {
    color: ACCENT_COLOR,
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 0,
    marginTop: 0,
    lineHeight: 34,
    fontFamily: titleFont,
  },
  heading3: {
    color: ACCENT_COLOR,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 0,
    marginTop: 0,
    lineHeight: 30,
    fontFamily: titleFont,
  },
  link: {
    color: '#03DAC6',
    fontFamily: bodyFont,
  },
  listItem: {
    marginBottom: 12,
    marginTop: 12,
    color: '#E1E1E1',
    fontFamily: bodyFont,
  },
  paragraph: {
    marginBottom: 8,
    color: '#E1E1E1',
    fontFamily: bodyFont,
  },
  bullet_list: {
    marginBottom: 0,
    marginTop: 0,
    paddingLeft: 0,
  },
  ordered_list: {
    marginBottom: 0,
    marginTop: 0,
    paddingLeft: 0,
  },
  bullet_list_icon: {
    color: ACCENT_COLOR,
    marginRight: 8,
  },
  ordered_list_icon: {
    color: ACCENT_COLOR,
    marginRight: 8,
  },
  code_inline: {
    color: '#03DAC6',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: monospace,
  },
  code_block: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginVertical: 0,
    fontFamily: monospace,
  },
  fence: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginVertical: 0,
    fontFamily: monospace,
  },
  blockquote: {
    backgroundColor: '#1E1E1E',
    borderLeftColor: ACCENT_COLOR,
    borderLeftWidth: 4,
    padding: 16,
    marginVertical: 0,
    fontFamily: bodyFont,
  },
  table: {
    borderColor: '#333',
    marginVertical: 0,
  },
  tr: {
    borderBottomColor: '#333',
  },
  th: {
    padding: 12,
    backgroundColor: '#1E1E1E',
    color: ACCENT_COLOR,
    fontFamily: bodyFont,
  },
  td: {
    padding: 12,
    borderColor: '#333',
    fontFamily: bodyFont,
  },
  mark: {
    backgroundColor: 'rgba(187, 134, 252, 0.3)',
    color: '#ffffff',
    borderRadius: 2,
  },
});

export default createMarkdownStyles;
