const esbuild = require('esbuild');
const config = require('./config.cjs');

const watch = process.argv.includes('--watch');
const serve = process.argv.includes('--serve');
const isDev = watch || serve || process.argv.includes('--dev');
const apiBase = isDev ? config.devApiBase : config.prodApiBase;

async function build() {
  const ctx = await esbuild.context({
    entryPoints: ['src/index.js'],
    bundle: true,
    outfile: 'dist/grass-touchers.js',
    format: 'iife',
    target: 'es2020',
    loader: { '.png': 'dataurl' },
    define: {
      __API_BASE__: JSON.stringify(apiBase),
      __STALE_AFTER_DAYS__: JSON.stringify(config.staleAfterDays),
    },
  });

  console.log(`Building for ${isDev ? 'dev' : 'prod'} (API_BASE=${apiBase})`);

  if (serve) {
    // esbuild only binds loopback by default, which isn't reachable from
    // Windows over the WSL2 IP. Bind all interfaces instead.
    await ctx.serve({ servedir: 'dist', port: 8000, host: '0.0.0.0' });
    console.log(`Serving payload at ${config.devBaseUrl}/grass-touchers.js`);
  } else if (watch) {
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('Build complete: dist/grass-touchers.js');
  }
}

build();
