import * as path from 'path'
import * as https from 'https'
import * as fs from 'fs'

async function mkdir(dest) {
  try {
    try {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true })
    } catch (e) {
      if (e.message && !e.message.includes('EEXIST')) throw e
      console.log(e)
    }
  } catch (err) {
    throw new Error(err)
  }
}

async function download(url, dest) {
  await mkdir(dest)
  return new Promise((resolve, reject) => {
    const file = fs
      .createWriteStream(dest)
      .on('finish', () => resolve(dest))
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err))
      })
    https
      .get(url, (response) => {
        if (response.statusCode >= 400) {
          fs.unlink(dest, () => {
            reject(new Error(`Failed to get '${url}' (${response.statusCode})`))
          })
          return
        }

        response.pipe(file)
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err))
      })
  })
}

async function downloadJsFile(lib, dir) {
  const jsPath = await download(lib.url, `${dir}/${lib.name}.js`)
  console.log(lib.name, 'Downloaded', jsPath)
  const data = await fs.promises.readFile(jsPath, 'utf8')
  var result = data.replace(/module.exports =/g, 'export default')
  await fs.promises.writeFile(jsPath, result, 'utf8')
  console.log(lib.name, 'Replaced module.exports with export default')
}

const libs = [
  {
    name: 'ascii-progress',
    license: 'https://raw.githubusercontent.com/bubkoo/ascii-progress/master/LICENSE',
    url: 'https://raw.githubusercontent.com/bubkoo/ascii-progress/master/index.js',
  },
  {
    name: 'text-table',
    license: 'https://raw.githubusercontent.com/substack/text-table/master/LICENSE',
    url: 'https://raw.githubusercontent.com/substack/text-table/master/index.js',
  },
]

for (const lib of libs) {
  const dir = `./src/ext-lib/${lib.name}`
  downloadJsFile(lib, dir)
  if (lib.license) download(lib.license, `${dir}/LICENSE`).then((dl) => console.log(lib.name, 'Downloaded', dl))
  if (lib.types) download(lib.types, `${dir}/${lib.name}.d.ts`).then((dl) => console.log(lib.name, 'Downloaded', dl))
}

// Download Bitburner defs
console.log(
  'Downloaded',
  await download(
    'https://raw.githubusercontent.com/danielyxie/bitburner/dev/src/ScriptEditor/NetscriptDefinitions.d.ts',
    './NetscriptDefinitions.d.ts'
  )
)
