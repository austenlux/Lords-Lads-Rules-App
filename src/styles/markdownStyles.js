/**
 * Styles for react-native-markdown-display (headings, links, code, tables, etc.).
 */
import { Platform } from 'react-native';

const monospace = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default {
  body: {
    color: '#E1E1E1',
    fontSize: 16,
    lineHeight: 24,
  },
  heading1: {
    color: '#BB86FC',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 0,
    marginTop: 0,
    lineHeight: 40,
  },
  heading2: {
    color: '#BB86FC',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 0,
    marginTop: 0,
    lineHeight: 34,
  },
  heading3: {
    color: '#BB86FC',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 0,
    marginTop: 0,
    lineHeight: 30,
  },
  link: {
    color: '#03DAC6',
  },
  listItem: {
    marginBottom: 12,
    marginTop: 12,
    color: '#E1E1E1',
  },
  paragraph: {
    marginBottom: 8,
    color: '#E1E1E1',
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
    color: '#BB86FC',
    marginRight: 8,
  },
  ordered_list_icon: {
    color: '#BB86FC',
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
    borderLeftColor: '#BB86FC',
    borderLeftWidth: 4,
    padding: 16,
    marginVertical: 0,
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
    color: '#BB86FC',
  },
  td: {
    padding: 12,
    borderColor: '#333',
  },
  mark: {
    backgroundColor: 'rgba(187, 134, 252, 0.3)',
    color: '#ffffff',
    borderRadius: 2,
  },
};
