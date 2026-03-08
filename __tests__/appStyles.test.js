/**
 * Minimal tests for app layout styles used by Tools/More screens and background logo.
 */
import styles, { HEADER_HEIGHT } from '../src/styles/appStyles';

describe('appStyles', () => {
  it('exports HEADER_HEIGHT as a number', () => {
    expect(typeof HEADER_HEIGHT).toBe('number');
    expect(HEADER_HEIGHT).toBeGreaterThan(0);
  });

  it('defines moreSectionWrapper with full width for More screen', () => {
    expect(styles.moreSectionWrapper).toBeDefined();
    expect(styles.moreSectionWrapper.width).toBe('100%');
  });

  it('defines aboutSectionWrapper with full width for Tools screen', () => {
    expect(styles.aboutSectionWrapper).toBeDefined();
    expect(styles.aboutSectionWrapper.width).toBe('100%');
  });
});
