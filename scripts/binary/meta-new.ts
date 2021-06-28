import path from 'path'
import la from 'lazy-ass'
import check from 'check-more-types'
import R from 'ramda'
import os from 'os'

// canonical platform names
export const platforms = {
  darwin: 'darwin',
  linux: 'linux',
  windows: 'win32',
} as const

export type PlatformName = {[K in keyof typeof platforms]: typeof platforms[K]}[keyof typeof platforms]

export const isValidPlatform = check.oneOf(R.values(platforms))

export const checkPlatform = (platform) => {
  return la(isValidPlatform(platform),
    'invalid build platform', platform, 'valid choices', R.values(platforms))
}

export const buildRootDir = () => {
  return path.resolve('build')
}

// returns a path into the /build directory
// the output folder should look something like this
// build/
//   <platform>/ = linux or darwin
//     ... platform-specific files
export const buildDir = function (platform: PlatformName, ...args: string[]) {
  checkPlatform(platform)
  const root = buildRootDir()

  switch (platform) {
    case 'darwin':
      // the new electron-builder for some reason adds its own platform
      // subfolder and it is NOT "darwin" but "mac"
      return path.resolve(root, 'mac', ...args)
    case 'linux':
      return path.resolve(root, 'linux-unpacked', ...args)
    case 'win32':
      if (os.arch() === 'x64') {
        return path.resolve(root, 'win-unpacked', ...args)
      }

      // x86 32bit architecture
      return path.resolve(root, 'win-ia32-unpacked', ...args)
    default:
      throw new Error('unexpected platform')
  }
}

// returns a path into the /dist directory
export const distDir = function (platform: PlatformName, ...args: string[]) {
  checkPlatform(platform)

  return path.resolve('dist', platform, ...args)
}

// returns folder to zip before uploading
export const zipDir = function (platform: PlatformName) {
  checkPlatform(platform)
  switch (platform) {
    case 'darwin':
      return buildDir(platform, 'Cypress.app')
    case 'linux':
      return buildDir(platform)
    case 'win32':
      return buildDir(platform)
    default:
      throw new Error('unexpected platform')
  }
}

// returns a path into the /build/*/app directory
// specific to each platform
export const buildAppDir = function (platform: PlatformName, ...args: string[]) {
  checkPlatform(platform)
  switch (platform) {
    case 'darwin':
      return buildDir(platform, 'Cypress.app', 'Contents', 'resources', 'app', ...args)
    case 'linux':
      return buildDir(platform, 'resources', 'app', ...args)
    case 'win32':
      return buildDir(platform, 'resources', 'app', ...args)
    default:
      throw new Error('unexpected platform')
  }
}

export const buildAppExecutable = function (platform: PlatformName) {
  checkPlatform(platform)
  switch (platform) {
    case 'darwin':
      return buildDir(platform, 'Cypress.app', 'Contents', 'MacOS', 'Cypress')
    case 'linux':
      return buildDir(platform, 'Cypress')
    case 'win32':
      return buildDir(platform, 'Cypress')
    default:
      throw new Error('unexpected platform')
  }
}

export const cacheDir = path.join(process.cwd(), 'cache')
