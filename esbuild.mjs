import glob from 'glob'
import esbuild from 'esbuild'

const args = process.argv.slice(2)

let watch = undefined
if (args[0] === '--watch') {
  watch = {
    onRebuild(error, result) {
      if (error) console.error('watch build failed:', error)
      else console.log('watch build succeeded:', result)
    },
  }
}
esbuild
  .build({
    entryPoints: glob.sync('src/*.ts'),
    outdir: 'out/',
    bundle: true,
    platform: 'node',
    format: 'esm',
    sourcemap: 'inline',
    logOverride: { 'direct-eval': 'silent' },
    watch,
  })
  .then((result) => {
    console.log('Built successfully')
  })
