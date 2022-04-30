import { INITIAL_BUILD_VERSION, INITIAL_MINOR_VERSION, INITIAL_PATCH_VERSION } from "../config"
import { extractVersionFromTag, generateVersionFromTokens } from "./versioning"

/**
 * Bumps the build number it will increment 
 * the patch version as well, since this is a future release
 * @param {string} version 
 */
const bumpBuild = (version:string): string => {
    const tokens = extractVersionFromTag(version)
    if (tokens.build == -1) {
        tokens.build = 0
    }
    tokens.build += 1
    return generateVersionFromTokens(tokens) 
    
}

/**
 * Bumps the patch number  
 * @param {string} version 
 */
const bumpPatch = (version:string): string => {
    const tokens = extractVersionFromTag(version)
    tokens.patch += 1
    tokens.build = -1
    return generateVersionFromTokens(tokens) 
}

/**
 * Bumps minor version
 * @param {string} version 
 * @returns {string}
 */
const bumpMinor = (version:string): string => {
    const tokens = extractVersionFromTag(version)
    tokens.minor += 1
    tokens.patch = parseInt(INITIAL_PATCH_VERSION, 10)
    tokens.build = -1
    return generateVersionFromTokens(tokens) 
}


/**
 * Bumps major version
 * @param {string} version 
 * @returns {string}
 */
const bumpMajor = (version:string): string => {
    const tokens = extractVersionFromTag(version)
    tokens.major += 1
    tokens.minor = parseInt(INITIAL_MINOR_VERSION, 10)
    tokens.patch = parseInt(INITIAL_PATCH_VERSION, 10)
    return generateVersionFromTokens(tokens) 
}


export { bumpBuild, bumpPatch, bumpMinor, bumpMajor }

