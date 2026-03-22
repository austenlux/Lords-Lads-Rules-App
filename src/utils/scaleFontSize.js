import { Dimensions } from 'react-native';

const BASE_WIDTH = 443;

export function scaleFontSize(size) {
  const { width } = Dimensions.get('window');
  return Math.round(size * Math.min(1, width / BASE_WIDTH));
}

export const scaleSize = scaleFontSize;
