// Webpack-resolvable module for 'self' global
// This allows webpack to resolve 'self' when libraries try to import or access it

// In the browser, self already exists
if (typeof self !== 'undefined') {
  module.exports = self;
} 
// In Node.js/server environment, create a compatible object
else if (typeof global !== 'undefined') {
  // Use global as the base
  module.exports = global;
} 
// Fallback for other environments
else {
  module.exports = {};
}