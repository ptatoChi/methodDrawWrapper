/**
 * PostCSS configuration for Method-Draw wrapper.
 *
 * Run with:
 *   npx postcss src/app/lib/Method-Draw/src/css/*.css \
 *       --config postcss.config.js \
 *       -o src/app/lib/Method-Draw/md-prefixed.css
 *
 * The output stylesheet is fully scoped to `.md-wrapper` so it can be loaded
 * globally without leaking into the host application.
 */
module.exports = {
  plugins: [
    require('postcss-prefix-selector')({
      prefix: '.md-wrapper',
      transform (prefix, selector, prefixedSelector) {
        // keep @keyframe steps intact
        if (selector.startsWith('from') || selector.startsWith('to') || /^\d/.test(selector))
          return selector;
      
        // 1. if the selector IS exactly ':root'   → leave it unchanged
        if (selector.trim() === ':root')
          return selector;
      
        // 2. if the selector list CONTAINS ':root' (e.g. 'body, :root')
        //    split it and process each part
        if (selector.includes(':root')) {
          return selector
            .split(',')
            .map(s => s.trim())
            .map(s => s === ':root' ? ':root' : `${prefix} ${s}`)
            .join(', ');
        }
      
        // 3. replace bare 'body' / 'html' with the wrapper itself
        if (/^body(\W|$)/.test(selector) || /^html(\W|$)/.test(selector))
          return selector.replace(/^(body|html)/, prefix);
      
        // 4. default: just prefix
        return prefixedSelector;
      }
    }),
    require('postcss-combine-duplicated-selectors')({
      removeDuplicatedProperties: true
    })
  ]
}; 