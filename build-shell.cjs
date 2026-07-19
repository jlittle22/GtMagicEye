const fs = require('fs');
const path = require('path');

const { version } = require('./package.json');
const config = require('./config.cjs');

const iconDataUri = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, 'assets', 'logo-icon.png')).toString('base64')}`;

function shellSource({ name, namespace, baseUrl, updateUrl }) {
  const updateLines = updateUrl
    ? `// @updateURL    ${updateUrl}\n// @downloadURL  ${updateUrl}\n`
    : '';

  return `// ==UserScript==
// @name         ${name}
// @namespace    ${namespace}
// @version      ${version}
// @author       lawnhittle
// @description  This script allows you to collect and share your troop counts
// @icon         ${iconDataUri}
// @include      https://*.grepolis.com/game/*
// @include      https://grepodata.com*
// @exclude      view-source://*
${updateLines}// @copyright    2026, Jake Little
// @grant        none
// ==/UserScript==

(function () {
  var BASE_URL = ${JSON.stringify(baseUrl)};
  var rand = Math.floor(Date.now() / 1000 / (60 * 60)) + '';

  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = BASE_URL + '/grass-touchers.js?v=' + rand;
  document.head.appendChild(script);

  console.log('[GrassTouchers] loader injected, base=' + BASE_URL);
})();
`;
}

const outDir = path.join(__dirname, 'dist');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'grass-touchers.user.js'),
  shellSource({
    name: 'Grass Touchers LLC City Indexer',
    namespace: 'gtllc',
    baseUrl: config.prodBaseUrl,
    updateUrl: `${config.prodBaseUrl}/grass-touchers.user.js`,
  })
);

fs.writeFileSync(
  path.join(outDir, 'grass-touchers.dev.user.js'),
  shellSource({
    name: 'Grass Touchers LLC City Indexer [DEV]',
    namespace: 'gtllc-dev',
    baseUrl: config.devBaseUrl,
    updateUrl: null,
  })
);

console.log('Shell scripts written:');
console.log('  dist/grass-touchers.user.js      (prod ->', config.prodBaseUrl + ')');
console.log('  dist/grass-touchers.dev.user.js  (dev  ->', config.devBaseUrl + ')');
