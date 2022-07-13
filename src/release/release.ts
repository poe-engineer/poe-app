import { INITIAL_BUILD_VERSION, INITIAL_MAJOR_VERSION, INITIAL_MINOR_VERSION, INITIAL_PATCH_VERSION } from "../config";
import { GithubIssue } from "../github/types";
import { closeIssue, createBranch, createComment, createTag, createUniqueIssue, getTags, createRelease } from "../github/service";
import { isTagSemver } from "../release/versioning";
import { bumpBuild, bumpMajor, bumpMinor, bumpPatch } from "./bumping";
import { extractChangeLogFromComment, extractCommitsFromChangelog, getChangelog, ChangeLog } from "./changelog";
import { determineLatestVersion, extractVersionFromBranch, extractVersionFromTag } from "./versioning";
import {logger} from '../logging';


interface ReleaseDocumentVars {
    majorVersion: string
    minorVersion: string
    build: string
    log: ChangeLog
    latestVersion: string
    breakingChange: boolean
}

const releaseLabel = {name: "Release", color:"#3fb950"}
const releasePatchLabel = {name: "Patch", color: "#db575e"}


const cleanVersion = (v: string) => v.replace(/-rc\.\d+/i, '')


const getIssueClosingComment = (release, version) => {
    return `
Access new release:
${release.html_url} 

${ version.includes("rc") ? `
Your next build seems it could be
\`\`\`
/release:${bumpBuild(version)}
\`\`\`
or Promote build
\`\`\`
/promote:${version}
\`\`\`

` : ''}
`

}


const getReleaseMainText =  ({majorVersion, minorVersion, build, log, latestVersion, breakingChange}: ReleaseDocumentVars): GithubIssue => {
    return {
        "title": "[poe][release] Your next release",
        "body": `
# New release

## Preparing for release

${breakingChange ? 'You have a breaking change I would recommend you increase your major version' : 'I propose we bump the minor version'}
- ${breakingChange ? majorVersion : minorVersion}
- ${build}


## What's changed
Here are the most recent changes that you've introduced since last version (${latestVersion})

### Changelog Text
${log.text}
----

## Releasing 

If you would like poe to create a release for you, comment on this issue with the following:

\`\`\`
/release:${breakingChange ? majorVersion : minorVersion}
\`\`\`
\`\`\`
/release:${build}
\`\`\`

**In case you have a special requirement you may enter which version you see fit**

<!--commits
${ log.commits.map(elem => elem.sha).join(" ") }
-->
`
    }
}


const getPatchReleaseText =  (patchVersion, buildVersion, log: ChangeLog, latestVersion): GithubIssue => {
    return {
        "title": `[poe][patch] Your next patch ${patchVersion}`,
        "body": `
<!--commits
${ log.commits.map(elem => elem.sha).join(" ") }
-->

# New release

## Preparing for release

It seems like your next version could be either one of these:
- ${patchVersion}
- ${buildVersion}


## Changelog 
Here are the most recent changes that you've introduced since last version (${latestVersion})

Upon releasing the following section will posted in the next Release, you may modify this section to your requirements.

> Do not change the order of the items or remove the hashes because they are used internally

### Changelog Text
${log.text}
---

## Releasing 

If you would like poe to create a release for you, comment on this issue with the following:

\`\`\`
/release:${patchVersion}
\`\`\`
\`\`\`
/release:${buildVersion}
\`\`\`

**In case you have a special requirement you may enter which version you see fit**

`
    }
}

const getReleaseBranchNameFromVersion = (version) => {
    const versionTokens = extractVersionFromTag(version)
    return `release/${versionTokens.major}.${versionTokens.minor}`
}


const promoteReleaseCandidate = async({payload, octokit, version}) => {
    logger.debug("Promote to gold the last build containing this version")
    const tags = await getTags(payload.repository.name, payload.repository.owner.login, octokit)
    logger.debug("Retrieved tags " + tags.length)
    const lastBuildTags = tags.filter( elem => elem.name.indexOf(version) != -1 && elem.name.indexOf("rc") != -1).sort()
    logger.debug("Last build tags")
    logger.debug(lastBuildTags);
    if (lastBuildTags.length == 0) {
        throw new Error("No build found to promote");
    }
    const tag = lastBuildTags[0]

    version = cleanVersion(version)
    await createTag(cleanVersion(version), tag.commit.sha, payload.repository.owner.login, payload.repository.name, '', octokit)
    const release = await createRelease(cleanVersion(version), '', payload.repository.owner.login, payload.repository.name, octokit)
    const closingComment = getIssueClosingComment(release, version)
    await createComment(payload.issue.number, payload.repository.owner.login, payload.repository.name, closingComment, octokit)
    await closeIssue(payload.issue.number, payload.repository.owner.login, payload.repository.name, octokit)
    try {
        await createBranch(getReleaseBranchNameFromVersion(version), tag.commit.sha, payload.repository.owner.login, payload.repository.name, octokit)
    } catch (err) {
        logger.warn("Not creating branch as it may already exist")
    }
}


const publishNewRelease = async({payload, octokit, version}) => {
    logger.debug("publishNewRelease")

    const versionTokens = extractVersionFromTag(version)
    const branchName = `release/${versionTokens.major}.${versionTokens.minor}`
    logger.debug("Extracting commits")
    const commits = extractCommitsFromChangelog(payload.issue.body)
    logger.debug(commits)
    const headCommit = commits[0]
    const log = await getChangelog(headCommit, commits[commits.length - 1], octokit, payload.repository.owner.login, payload.repository.name)
    await createTag(version, headCommit, payload.repository.owner.login, payload.repository.name, log.text, octokit)
    const release = await createRelease(version, log.text, payload.repository.owner.login, payload.repository.name, octokit)
    const closingComment = getIssueClosingComment(release, version);

    await createComment(payload.issue.number, payload.repository.owner.login, payload.repository.name, closingComment, octokit)
    if (!version.includes("-rc.")) {
        logger.debug("Closing issue as it is not a RC")
        await closeIssue(payload.issue.number, payload.repository.owner.login, payload.repository.name, octokit)
        try {
            await createBranch(branchName, headCommit, payload.repository.owner.login, payload.repository.name, octokit)
        } catch (err) {
            logger.warn("Not creating branch as it may already exist")
        }
    }

}

const extractParamValues = (val, regx: RegExp) => {
    const matches = regx.exec(val)
    return matches.groups
}


const commands = {
    promote: {
        slug: "promote",
        regx: /^\/promote:(?<version>v\d+\.\d+\.\d+-rc\.\d+)/g,
        func: promoteReleaseCandidate
    },
    release: {
        slug: "release",
        regx: /^\/release:(?<version>v\d+\.\d+\.\d+(-rc\.\d+)?)/g,
        func: publishNewRelease
    }
}

/**
 * 
 * @param context
 * @returns 
 */
const parseReleaseComment = async ({payload, octokit}) => {
    logger.debug("parseReleaseComment start")

    if (!/^\[poe\]\[release|patch\]/g.test(payload.issue.title)) {
        return
    }
    const cmds = Object.keys(commands)
    for (let index = 0; index < cmds.length; index++) {
        const cmd = commands[cmds[index]];
        if (payload.comment.body.match(cmd.regx)) {
            logger.debug(`Command matched with ${cmd.slug}`)
            const params = extractParamValues(payload.comment.body, cmd.regx)
            logger.debug(`Extracted params`)
            logger.debug(params)
            cmd.func({payload, octokit, ...params})
            return
        }
    }
}

/**
 * A webhook that on push to default branch or any of the release branches
 * Creates a issue based on the commits on any of the release branch or main branch.
 * Which prompts that user with all the current Release notes 
 * and asks if he wants to make the release or make a alpha release.
 * 
 * e.g  
 * Pushing to branch release/1.0 will detect which is the last version of 1.0 
 * assuming latest version os 1.0.1 the user will be prompted if he wants to release 1.0.2
 * 
 * e.g
 * Latest release would be 1.0.0, upon pushing to main the user is asked if he wants to 
 * release 2.0.0 or 1.1.0
 */
const promptRelease = async ({payload, octokit}) => {
    logger.debug("Promoting new release");
    logger.debug(payload);

    let tags = await getTags(payload.repository.name, payload.repository.owner.login, octokit)

    // Parameterize default branch
    if (payload.ref.endsWith("main")) {
        logger.debug("Commit was made to default branch main")
        
        const latestVersion = await determineLatestVersion(payload.repository.name, payload.repository.owner.login, octokit, false);
        logger.debug(`Detected latest version  ${latestVersion}`)

        let nextBuild:string, nextMajor:string, nextMinor:string
        const prodTags = tags.filter( tag => isTagSemver(tag) && !tag.name.includes("rc")).sort()
        const buildTags = tags.filter( tag => isTagSemver(tag) && tag.name.includes("rc")).sort()

        const log = await getChangelog(
            payload.head_commit.id,
            prodTags.length ? prodTags[0].commit.sha : null, octokit, 
            payload.repository.owner.login, 
            payload.repository.name
        )

        const major = log.text.includes("BREAKING CHANGE") 

        logger.debug(`Breaking change value: ${major}`);

        if (prodTags.length == 0 || buildTags.length == 0) {
            console.warn("Unable to detect any versions yet");

            if (prodTags.length == 0) {
                nextMajor = `v${INITIAL_MAJOR_VERSION}.${INITIAL_MINOR_VERSION}.${INITIAL_PATCH_VERSION}`
                nextMinor = `v${INITIAL_MAJOR_VERSION}.${INITIAL_MINOR_VERSION}.${INITIAL_PATCH_VERSION}`
            } else {
                logger.info(`Detected only prod ${JSON.stringify(prodTags[0])}`);
                nextMajor = bumpMajor(prodTags[0].name)
                nextMinor = bumpMinor(prodTags[0].name)
            }

            if (buildTags.length == 0 && prodTags.length == 0) {
                nextBuild = `v${INITIAL_MAJOR_VERSION}.${INITIAL_MINOR_VERSION}.${INITIAL_PATCH_VERSION}-rc.${INITIAL_BUILD_VERSION}`
            } else if (buildTags.length == 0) {
                nextBuild = bumpBuild(nextMinor);
            } else {
                logger.info(`Detected only build ${buildTags[0]}`);
                nextBuild = bumpBuild(buildTags[0].name)
            }
        } else {
            const lastBuild = buildTags[0]
            const lastProd = prodTags[0]
            logger.debug(`Found buld and prod Detected ${JSON.stringify(lastBuild)} and ${JSON.stringify(lastProd)}`);
            

            nextMinor = bumpMinor(lastProd.name)
            nextMajor = bumpMajor(lastProd.name)
            if(lastProd.name >= cleanVersion(lastBuild.name)) {
                if (major) {
                    nextBuild = bumpBuild(nextMajor)
                } else {
                    nextBuild = bumpBuild(nextMinor)
                }
            } else {
                nextBuild = bumpBuild(lastBuild.name);
            }

        }

        logger.debug(`Getting release text with vars: ${nextMinor} ${nextMajor} ${nextBuild}`)
        const issueText = getReleaseMainText({
            majorVersion: nextMajor, 
            minorVersion: nextMinor, 
            build: nextBuild, 
            log, 
            latestVersion: prodTags.length ? prodTags[0].name : null, 
            breakingChange: major
        });

        await createUniqueIssue(payload.repository.name, payload.repository.owner.login, octokit, issueText, [releaseLabel])
    } else if (payload.ref.match(/release\/\d+\.\d+$/g)) {
        logger.debug("Promting an existing release");
        
        const version = extractVersionFromBranch(payload.ref)
        tags = tags.filter( tag => tag.name.includes(`${version.major}.${version.minor}`) && isTagSemver(tag)).sort()


        // remove complexity by dryDRY 
        // this repeats 
        const lastTag = tags[0]
        const prodTags = tags.filter( tag => tag.name.includes(`v${version.major}.${version.minor}`) && isTagSemver(tag) && !tag.name.includes('rc')).sort() 
        const buildTags = tags.filter( tag => tag.name.includes(`v${version.major}.${version.minor}`) && isTagSemver(tag) && tag.name.includes('rc')).sort()

        const lastProd = prodTags[0]
        const lastBuild = buildTags[0]
        const patch = bumpPatch(lastProd.name)
        let build = ''
        if (!lastBuild || lastProd.name >= lastBuild.name) {
            build = bumpBuild(patch); 
        } else {
            build = bumpBuild(lastBuild.name)
        }


        const log = await getChangelog(payload.head_commit.id, lastProd.commit.sha, octokit, payload.repository.owner.login, payload.repository.name)
        const issueText = getPatchReleaseText(patch, bumpBuild(patch), log, lastTag.name)
        await createUniqueIssue(payload.repository.name, payload.repository.owner.login, octokit, issueText, [releaseLabel, releasePatchLabel])
    }
}

export { promptRelease, parseReleaseComment }
