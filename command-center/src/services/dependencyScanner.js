// Mock dependency list since we can't read package.json at runtime easily without importing it specifically
import pkg from '../../package.json'; // Vite allows JSON imports

export const scanDependencies = async () => {
  const deps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};
  
  const allDeps = { ...deps, ...devDeps };
  const results = [];
  
  Object.entries(allDeps).forEach(([name, version]) => {
     let status = 'ok';
     let risk = 'low';
     
     // Artificial vulnerability check
     if (name === 'axios' && version.includes('0.21')) { // Example logic
        status = 'vulnerable';
        risk = 'high';
     }

     results.push({
        name,
        version,
        status,
        risk
     });
  });

  return {
    score: 95, // Assuming mostly fresh create-react-app style setup
    dependencies: results
  };
};