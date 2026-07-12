import fs from 'node:fs';

import istanbulCoverage from 'istanbul-lib-coverage';

import type { CoverageMapData } from 'istanbul-lib-coverage';

// istanbul-lib-coverage is CJS; named imports don't exist under native ESM
const { createCoverageMap } = istanbulCoverage;

const map = createCoverageMap({});

const inputs = [
  'coverage/unit/coverage-final.json',
  'coverage/e2e/coverage-final.json',
];

for (const file of inputs) {
  if (!fs.existsSync(file)) {
    console.warn(`Missing: ${file}`);
    continue;
  }

  const json = JSON.parse(fs.readFileSync(file, 'utf8')) as CoverageMapData;

  if (Object.keys(json).length === 0) {
    console.warn(`Empty coverage: ${file}`);
    continue;
  }

  map.merge(json);
}

fs.mkdirSync('coverage/merged', { recursive: true });
fs.writeFileSync('coverage/merged/coverage-final.json', JSON.stringify(map));

console.log('Merged coverage written to coverage/merged/coverage-final.json');
