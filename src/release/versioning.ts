import { Octokit } from "@octokit/rest";
import {RELEASE_BRANCH_PREFIX, BUILD_PREFIX, INITIAL_PATCH_VERSION, INITIAL_BUILD_VERSION} from "../config";
import { GithubTag } from "../github/types";
import { getTags } from "../github/service";

interface VersionTokens {
    major: number
    minor: number
    patch: number
    build: number
}


const isTagSemver = (tag: GithubTag) => /^(v?\d+\.\d+\.\d+)(-rc\.\d+)?$/.test(tag.name)

const isUsingSemver = tags => {
    const versions = tags.filter( tag => isTagSemver(tag))
    return versions.length == 0 && tags.length != 0
}

/**
 * Extracts version tokens such from tag name
 * @param {string} tag - raw tag name
 * @returns {VersionTokens}
 */
const extractVersionFromTag = (tag: string): VersionTokens => {
    //eslint-disable-next-line
    const regx = /^(v)?(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(-rc\.(?<build>\d+))?$/g
    const { groups: { major, minor, patch, build } } = regx.exec(tag)
    return {
        major: parseInt(major, 10),
        minor: parseInt(minor, 10),
        patch: parseInt(patch, 10),
        build: build != undefined ? parseInt(build, 10) : -1 // returning negative if build number does not exist
    }
}

/**
 * Extracts version from branch name
 * @param {string} branch - raw branch name
 * @returns {string} 
 */
const extractVersionFromBranch = (branch: string): VersionTokens => {
    //eslint-disable-next-line
    const regx = new RegExp(`${RELEASE_BRANCH_PREFIX}\/(?<version>\\d+\\.\\d+)`, 'g')
    const { groups: { version } } = regx.exec(branch)
    const tokens = version.split(".")

    return {
        major: parseInt(tokens[0], 10),
        minor: parseInt(tokens[1], 10),
        patch: parseInt(INITIAL_PATCH_VERSION, 10),
        build: parseInt(INITIAL_BUILD_VERSION, 10),
    }
}

/**
 * Generates raw version from version tokens
 * @param {VersionTokens} version - raw branch name
 * @returns {string} 
 */
const generateVersionFromTokens = (version: VersionTokens): string => {
    if (version.build >= 0) {
        return `v${version.major}.${version.minor}.${version.patch}-${BUILD_PREFIX}.${version.build}`
    } else {
        return `v${version.major}.${version.minor}.${version.patch}`
    }
}

/**
 * Returns the highest version tag 
 * @param {string} repo 
 * @param {string} owner 
 * @param {string} octokit 
 * @returns github tag object
 */
const determineLatestVersion = async (repo: string, owner: string, octokit: Octokit, nonrc: boolean): Promise<GithubTag> => {
    const tags = await getTags(repo, owner, octokit)
    const versions: GithubTag[] = tags.filter(tag => isTagSemver(tag) && !nonrc || !tag.name.includes("rc")).sort( (a,b) => {
        const x = a.name; const y = b.name;
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    })
    return versions[versions.length - 1]
}

export {
    generateVersionFromTokens, 
    extractVersionFromBranch, 
    extractVersionFromTag,
    determineLatestVersion,
    isTagSemver,
    isUsingSemver
}