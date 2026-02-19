/**
 * SVGR config: force icon fill/stroke to use props so any SVG renders with
 * app-controlled color (inactive/active) without editing the SVG file.
 * Both fill and stroke use props.fill; add more color values here if needed.
 */
const TINT_PROP = '{props.fill ?? "#E1E1E1"}';

module.exports = {
  replaceAttrValues: {
    currentColor: TINT_PROP,
    // Blacks / dark
    '#000': TINT_PROP,
    '#000000': TINT_PROP,
    black: TINT_PROP,
    '#111': TINT_PROP,
    '#111111': TINT_PROP,
    '#121212': TINT_PROP,
    '#222': TINT_PROP,
    '#222222': TINT_PROP,
    '#333': TINT_PROP,
    '#333333': TINT_PROP,
    '#444': TINT_PROP,
    '#444444': TINT_PROP,
    '#555': TINT_PROP,
    '#555555': TINT_PROP,
    '#666': TINT_PROP,
    '#666666': TINT_PROP,
    '#777': TINT_PROP,
    '#777777': TINT_PROP,
    '#888': TINT_PROP,
    '#888888': TINT_PROP,
    '#999': TINT_PROP,
    '#999999': TINT_PROP,
    '#aaa': TINT_PROP,
    '#aaaaaa': TINT_PROP,
    '#bbb': TINT_PROP,
    '#bbbbbb': TINT_PROP,
    '#ccc': TINT_PROP,
    '#cccccc': TINT_PROP,
    '#ddd': TINT_PROP,
    '#dddddd': TINT_PROP,
    '#eee': TINT_PROP,
    '#eeeeee': TINT_PROP,
    // Whites (app controls tint either way)
    '#fff': TINT_PROP,
    '#ffffff': TINT_PROP,
    white: TINT_PROP,
    '#f5f5f5': TINT_PROP,
    '#e0e0e0': TINT_PROP,
    '#e1e1e1': TINT_PROP,
  },
};
