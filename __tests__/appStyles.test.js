/**
 * Minimal tests for app layout styles used by Tools/More screens and background logo.
 */
import createStyles, { HEADER_HEIGHT } from '../src/styles/appStyles';

const styles = createStyles('#7B8C9E', 'rgba(123, 140, 158, 0.3)');

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
