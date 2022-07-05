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

// Download Bitburner defs
console.log(
  'Downloaded',
  await download(
    'https://raw.githubusercontent.com/danielyxie/bitburner/dev/src/ScriptEditor/NetscriptDefinitions.d.ts',
    './NetscriptDefinitions.d.ts'
  )
)
