import os from 'os'
import fs from 'fs-extra'
import path from 'path'
import _ from 'lodash'
import del from 'del'
import chalk from 'chalk'
import electron from '@packages/electron'
import la from 'lazy-ass'

import * as packages from './util/packages-new'
import * as meta from './meta-new'
import xvfb from '../../cli/lib/exec/xvfb'
import smoke from './smoke'
import { spawn, execSync } from 'child_process'
import { transformRequires } from './util/transform-requires'
import execa from 'execa'
import { PlatformName } from '@packages/launcher'
import { testStaticAssets } from './util/testStaticAssets'
// import performanceTracking from '../../packages/server/test/support/helpers/performance.js'

const CY_ROOT_DIR = path.join(__dirname, '..', '..')

const logger = function (msg, platform) {
  const time = new Date()
  const timeStamp = time.toLocaleTimeString()

  console.log(timeStamp, chalk.yellow(msg), chalk.blue(platform))
}

export async function buildCypressApp (platform: meta.PlatformName, version: string) {
  function log (msg: string) {
    logger(msg, platform)
  }

  log('#checkPlatform')
  if (platform !== os.platform()) {
    throw new Error('Platform mismatch')
  }

  const DIST_DIR = meta.distDir(platform)

  function distDir (...parts: string[]) {
    return path.join(DIST_DIR, ...parts)
  }

  log('#cleanupPlatform')
  fs.removeSync(DIST_DIR)

  log('#buildPackages')
  await execa('yarn', ['lerna', 'run', 'build-prod', '--stream', '--ignore', 'cli'], {
    stdio: 'inherit',
    cwd: CY_ROOT_DIR,
  })

  // Copy Packages: We want to copy the package.json, files, and output
  await packages.copyAllToDist(DIST_DIR)

  const jsonRoot = fs.readJSONSync(path.join(CY_ROOT_DIR, 'package.json'))

  fs.writeJsonSync(distDir('package.json'), _.omit(jsonRoot, [
    'scripts',
    'devDependencies',
    'lint-staged',
    'engines',
  ]), { spaces: 2 })

  // Copy the yarn.lock file so we have a consistent install
  fs.copySync(path.join(CY_ROOT_DIR, 'yarn.lock'), distDir('yarn.lock'))

  // replaceLocalNpmVersions
  const dirsSeen = await packages.replaceLocalNpmVersions(DIST_DIR)

  // remove local npm dirs that aren't needed
  await packages.removeLocalNpmDirs(DIST_DIR, dirsSeen)

  execSync('yarn --production', {
    cwd: DIST_DIR,
    stdio: 'inherit',
  })

  // Remove npm modules that are now hoisted in the node_modules folder

  // Validate no-hoists / single copies of libs

  // Remove extra directories that are large/unneeded
  log('#remove extra dirs')
  await del([
    distDir('**', 'image-q', 'demo'),
    distDir('**', 'gifwrap', 'test'),
    distDir('**', 'pixelmatch', 'test'),
    distDir('**', '@jimp', 'tiff', 'test'),
    distDir('**', '@cypress', 'icons', '**/*.{ai,eps}'),
    distDir('**', 'esprima', 'test'),
    distDir('**', 'bmp-js', 'test'),
    distDir('**', 'exif-parser', 'test'),
  ])

  console.log('Deleted excess directories')

  log('#createRootPackage')
  const electronVersion = electron.getElectronVersion()
  const electronNodeVersion = await electron.getElectronNodeVersion()

  fs.writeJSONSync(distDir('package.json'), {
    name: 'cypress',
    productName: 'Cypress',
    description: jsonRoot.description,
    version, // Cypress version
    electronVersion,
    electronNodeVersion,
    main: 'index.js',
    scripts: {},
    env: 'production',
  }, { spaces: 2 })

  fs.writeFileSync(distDir('index.js'), `\
process.env.CYPRESS_INTERNAL_ENV = process.env.CYPRESS_INTERNAL_ENV || 'production'
require('./packages/server')\
`)

  // removeTypeScript
  await del([
    // include ts files of packages
    distDir('**', '*.ts'),

    // except those in node_modules
    `!${distDir('**', 'node_modules', '**', '*.ts')}`,
  ])

  // cleanJs
  packages.runAllCleanJs()

  // transformSymlinkRequires
  log('#transformSymlinkRequires')

  await transformRequires(distDir())

  log(`#testVersion ${distDir()}`)
  await testVersion(distDir(), platform, version)

  // testBuiltStaticAssets
  await testStaticAssets(distDir())

  log('#removeCyAndBinFolders')
  await del([
    distDir('node_modules', '.bin'),
    distDir('packages', '*', 'node_modules', '.bin'),
    distDir('packages', 'server', '.cy'),
  ])

  // when we copy packages/electron, we get the "dist" folder with
  // empty Electron app, symlinked to our server folder
  // in production build, we do not need this link, and it
  // would not work anyway with code signing

  // hint: you can see all symlinks in the build folder
  // using "find build/darwin/Cypress.app/ -type l -ls"
  log('#removeDevElectronApp')
  fs.removeSync(distDir('packages', 'electron', 'dist'))

  // electronPackAndSign
  log('#electronPackAndSign')
  // See the internal wiki document "Signing Test Runner on MacOS"
  // to learn how to get the right Mac certificate for signing and notarizing
  // the built Test Runner application

  const appFolder = distDir()
  const outputFolder = meta.buildRootDir()

  const iconFilename = getIconFilename(platform)

  console.log(`output folder: ${outputFolder}`)

  const args = [
    '--publish=never',
    `--c.electronVersion=${electronVersion}`,
    `--c.directories.app=${appFolder}`,
    `--c.directories.output=${outputFolder}`,
    `--c.icon=${iconFilename}`,
    // for now we cannot pack source files in asar file
    // because electron-builder does not copy nested folders
    // from packages/*/node_modules
    // see https://github.com/electron-userland/electron-builder/issues/3185
    // so we will copy those folders later ourselves
    '--c.asar=false',
  ]

  console.log('electron-builder arguments:')
  console.log(args.join(' '))

  try {
    await execa('electron-builder', args, {
      stdio: 'inherit',
    })
  } catch (e) {
    console.error(e)
  }

  // lsDistFolder
  console.log('in build folder %s', meta.buildDir(platform))

  const { stdout } = await execa('ls', ['-la', meta.buildDir(platform)])

  console.log(stdout)

  // testVersion(buildAppDir)
  await testVersion(meta.buildAppDir(platform), platform, version)

  // runSmokeTests
  let usingXvfb = xvfb.isNeeded()

  try {
    if (usingXvfb) {
      await xvfb.start()
    }

    const executablePath = meta.buildAppExecutable(platform)

    await smoke.test(executablePath)
  } finally {
    if (usingXvfb) {
      await xvfb.stop()
    }
  }

  // verifyAppCanOpen
  if (platform === 'darwin') {
    const appFolder = meta.zipDir(platform)

    await new Promise<void>((resolve, reject) => {
      const args = ['-a', '-vvvv', appFolder]

      console.log(`cmd: spctl ${args.join(' ')}`)
      const sp = spawn('spctl', args, { stdio: 'inherit' })

      return sp.on('exit', (code) => {
        if (code === 0) {
          return resolve()
        }

        return reject(new Error('Verifying App via GateKeeper failed'))
      })
    })
  }

  if (platform === 'win32') {
    return
  }

  log(`#printPackageSizes ${appFolder}`)

  // "du" - disk usage utility
  // -d -1 depth of 1
  // -h human readable sizes (K and M)
  const diskUsageResult = await execa('du', ['-d', '1', appFolder])

  const lines = diskUsageResult.stdout.split(os.EOL)

  // will store {package name: package size}
  const data = {}

  lines.forEach((line) => {
    const parts = line.split('\t')
    const packageSize = parseFloat(parts[0])
    const folder = parts[1]

    const packageName = path.basename(folder)

    if (packageName === 'packages') {
      return // root "packages" information
    }

    data[packageName] = packageSize
  })

  const sizes = _.fromPairs(_.sortBy(_.toPairs(data), 1))

  console.log(sizes)

  // performanceTracking.track('test runner size', sizes)
}

function getIconFilename (platform: PlatformName) {
  const filenames = {
    darwin: 'cypress.icns',
    win32: 'cypress.ico',
    linux: 'icon_512x512.png',
  }
  const iconFilename = electron.icons().getPathToIcon(filenames[platform])

  console.log(`For platform ${platform} using icon ${iconFilename}`)

  return iconFilename
}

async function testVersion (dir: string, platform: PlatformName, version: string) {
  logger('#testVersion', platform)

  console.log('testing dist package version')
  console.log('by calling: node index.js --version')
  console.log('in the folder %s', dir)

  const result = await execa('node', ['index.js', '--version'], {
    cwd: dir,
  })

  la(result.stdout, 'missing output when getting built version', result)

  console.log('app in %s', dir)
  console.log('built app version', result.stdout)
  la(result.stdout === version, 'different version reported',
    result.stdout, 'from input version to build', version)

  console.log('✅ using node --version works')
}
