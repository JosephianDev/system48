const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// paths
const ROOT = path.resolve(__dirname, '..');

const PATHS = {
  themeFile: path.join(ROOT, 'theme/system24.theme.css'),
  bundleFile: path.join(ROOT, 'build/system24.css'),
  sourceDir: path.join(ROOT, 'src'),
};

const targets = (process.env.DEV_OUTPUT_PATH || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

  if (!targets.length) {
  console.error('DEV_OUTPUT_PATH is not set in .env file');
  process.exit(1);
}

const contents = otherFiles.map(file => {
  const name = path.basename(file);
  return `/* ${name} */\n${fs.readFileSync(file, 'utf8')}\n`;
});

combinedCSS += contents.join('');

// utility functions
const readText = f => fs.readFileSync(f, 'utf8');
const writeText = (f, c) => fs.writeFileSync(f, c);

// file cache
let fileList = [];

function refreshFileList() {
  fileList = fs
    .readdirSync(PATHS.sourceDir)
    .filter(f => f.endsWith('.css'))
    .map(f => path.join(PATHS.sourceDir, f));
}

// build css bundle from src
function buildSourceBundle() {
  const main = fileList.find(f => path.basename(f) === 'main.css');
  const rest = fileList.filter(f => path.basename(f) !== 'main.css');

  let output = '';

  const appendFile = (file) => {
    const name = path.basename(file);
    const content = readText(file);
    output += `/* ${name} */\n${content}\n`;
  };

  if (main) appendFile(main);
  rest.forEach(appendFile);

  writeText(PATHS.bundleFile, output);

  return output;
}


// inject compiled css into base theme 
function applyToBase(compiled) {
  const base = readText(PATHS.themeFile);

  const pattern = /@import\s+url\(['"]?[^'"]+['"]?\);/g;

  const finalCss = base.replace(pattern, compiled);

  targets.forEach(dest => {
    writeText(dest, finalCss);
    console.log(`Updated ${dest}`);
  });
}

// hash function for change detection 
let lastHash = '';

function getHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// full pipeline 
function rebuild() {
  try {
    const css = buildSourceBundle();
	const hash = getHash(css);

	if (hash === lastHash) {
		console.log('No changes detected, skipping update.');
		return; // avoid unnecessary writes if content is unchanged
	}

	lastHash = hash;
	applyToBase(css);

  } catch (err) {
    console.error('Build error:', err);
  }
}

// initial run
refreshFileList();
rebuild();

// watcher
const watcher = chokidar.watch(
  [PATHS.themeFile, `${PATHS.sourceDir}/**/*.css`],
  { ignoreInitial: true }
);

// debounce logic to avoid multiple rapid rebuilds
let timer = null;
const DEBOUNCE_MS = 200;

function scheduleRebuild(event, file) {
  console.log(`[${event}] ${file}`);

  clearTimeout(timer);
  timer = setTimeout(() => {
    rebuild();
  }, DEBOUNCE_MS);
}

watcher
  .on('add', file => {
	refreshFileList();
	scheduleRebuild('added', file);
  })
  .on('unlink', file => {
	refreshFileList();
	scheduleRebuild('removed', file);
})
  .on('change', file => scheduleRebuild('changed', file))
  .on('error', err => console.error('Watcher error:', err));
