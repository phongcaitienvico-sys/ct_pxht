import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('Running setup verification tests...\n');

const projectRoot = process.cwd();

// Helper to check file existence
function assertFileExists(filePath, description) {
  const fullPath = path.join(projectRoot, filePath);
  assert.ok(fs.existsSync(fullPath), `Missing required file: ${description} (${filePath})`);
  return fs.readFileSync(fullPath, 'utf8');
}

// 1. package.json verification
const pkgRaw = assertFileExists('package.json', 'package.json');
const pkg = JSON.parse(pkgRaw);

assert.ok(pkg.scripts, 'package.json must contain scripts');
assert.ok(pkg.scripts.dev, 'package.json must contain dev script');
assert.ok(pkg.scripts.build, 'package.json must contain build script');
assert.ok(pkg.scripts.preview, 'package.json must contain preview script');
assert.ok(pkg.scripts.test, 'package.json must contain test script');

const expectedDeps = ['react', 'react-dom', 'lucide-react', 'xlsx', '@supabase/supabase-js'];
for (const dep of expectedDeps) {
  assert.ok(
    pkg.dependencies && pkg.dependencies[dep],
    `package.json must contain dependency: ${dep}`
  );
}

const expectedDevDeps = ['vite', '@vitejs/plugin-react', 'tailwindcss', 'postcss', 'autoprefixer'];
for (const dep of expectedDevDeps) {
  assert.ok(
    pkg.devDependencies && pkg.devDependencies[dep],
    `package.json must contain devDependency: ${dep}`
  );
}
console.log('✔ package.json verification passed');

// 2. vite.config.js verification
const viteConfig = assertFileExists('vite.config.js', 'Vite configuration');
assert.ok(
  viteConfig.includes("base: './'") || viteConfig.includes('base: "./"'),
  'vite.config.js must set base: "./"'
);
assert.ok(
  viteConfig.includes('@vitejs/plugin-react') || viteConfig.includes('react()'),
  'vite.config.js must use @vitejs/plugin-react'
);
console.log('✔ vite.config.js verification passed');

// 3. tailwind.config.js verification
const tailwindConfig = assertFileExists('tailwind.config.js', 'Tailwind configuration');
assert.ok(
  tailwindConfig.includes('content:'),
  'tailwind.config.js must specify content paths'
);
assert.ok(
  tailwindConfig.includes('./index.html') && tailwindConfig.includes('src'),
  'tailwind.config.js content paths must include index.html and src'
);
console.log('✔ tailwind.config.js verification passed');

// 4. postcss.config.js verification
const postcssConfig = assertFileExists('postcss.config.js', 'PostCSS configuration');
assert.ok(
  postcssConfig.includes('tailwindcss') && postcssConfig.includes('autoprefixer'),
  'postcss.config.js must include tailwindcss and autoprefixer'
);
console.log('✔ postcss.config.js verification passed');

// 5. index.html verification
const indexHtml = assertFileExists('index.html', 'index.html entry point');
assert.ok(
  indexHtml.includes('id="root"') || indexHtml.includes("id='root'"),
  'index.html must contain #root mount element'
);
assert.ok(
  indexHtml.includes('src="/src/main.jsx"') || indexHtml.includes('src="src/main.jsx"'),
  'index.html must link to src/main.jsx as module'
);
console.log('✔ index.html verification passed');

// 6. src/index.css verification
const indexCss = assertFileExists('src/index.css', 'Tailwind CSS entry point');
assert.ok(
  indexCss.includes('@tailwind base;') &&
  indexCss.includes('@tailwind components;') &&
  indexCss.includes('@tailwind utilities;'),
  'src/index.css must include Tailwind directives'
);
console.log('✔ src/index.css verification passed');

// 7. src/main.jsx verification
const mainJsx = assertFileExists('src/main.jsx', 'Main application entry');
assert.ok(
  mainJsx.includes('createRoot') && mainJsx.includes('App'),
  'src/main.jsx must render App component with createRoot'
);
console.log('✔ src/main.jsx verification passed');

// 8. src/App.jsx verification
const appJsx = assertFileExists('src/App.jsx', 'Root App component');
assert.ok(
  appJsx.includes('export default') && (appJsx.includes('function App') || appJsx.includes('const App')),
  'src/App.jsx must export App component'
);
console.log('✔ src/App.jsx verification passed');

console.log('\nAll setup verification tests passed successfully!');
