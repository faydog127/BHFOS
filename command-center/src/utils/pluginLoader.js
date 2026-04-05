/**
 * Utility to load external plugins dynamically.
 * Plugins are loaded from the public /plugins directory.
 */

/**
 * Loads a plugin configuration dynamically.
 * 
 * Plugins are app-level resources, not tenant-scoped. This avoids duplication and rewrite issues.
 * The URL structure intentionally avoids using ${tenantId} prefixes.
 * 
 * @param {string} pluginName - The name of the plugin directory (e.g., "visual-editor")
 * @returns {Promise<any|null>} - The plugin's default export or null if failed
 */
export async function loadPlugin(pluginName) {
  // Construct the URL without tenant prefix to ensure it hits the static asset directly
  // regardless of the current client-side route structure.
  const pluginUrl = `/plugins/${pluginName}/${pluginName}-config.js`;
  
  try {
    // Attempt dynamic import
    // Note: In Vite/Rollup, dynamic imports with variables might need specific handling or glob patterns,
    // but for purely external/public folder scripts loaded at runtime via browser native import(),
    // this standard import should work if the file is served correctly.
    // If Vite transforms this, it might look for files in src.
    // For purely runtime loading from /public, we might use standard import() if the build target supports it,
    // or we might need to use a shim or script tag injection if 'import' is transpiled away.
    // However, assuming standard ESM environment:
    const module = await import(/* @vite-ignore */ pluginUrl);
    
    console.log(`✓ Plugin loaded: ${pluginName}`);
    return module.default;
  } catch (error) {
    console.warn(`✗ Failed to load plugin: ${pluginName}`, error);
    return null;
  }
}