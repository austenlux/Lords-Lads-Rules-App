declare module 'react-native-markdown-package' {
  import { ComponentType } from 'react';
  
  interface MarkdownProps {
    styles?: any;
    children: string;
    enableLightBox?: boolean;
    useAnchor?: boolean;
  }

  const Markdown: ComponentType<MarkdownProps>;
  export default Markdown;
} 