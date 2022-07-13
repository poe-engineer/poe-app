import { Octokit } from "@octokit/rest";
import { Branch, CreateGithubTag, GithubIssue, GithubTag } from "./types";


const getTagCompareURL = (org, repo, v1, v2) => {
    return `https://github.com/${org}/${repo}/compare/${v1}...${v2}`
}

const getComments = async(issue_number: number, owner:string, repo:string, octokit: Octokit) => {
    const res = await octokit.paginate("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
        owner,
        repo,
        issue_number,
    })
    return res
}

/**
 * Returns comparison between two releases url
 * @param sha 
 * @param octokit 
 */
const getCompareURL = (previousTag: string, latestTag:string,  owner: string, repo: string): string => {
    return `https://github.com/${owner}/${repo}/compare/${previousTag}...${latestTag}`
}

/**
 * 
 * @param sha 
 * @param octokit 
 */
const createBranch = async(name:string, sha: string, owner: string, repo: string, octokit: Octokit): Promise<Branch> => {
    const data = await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
        owner: owner,
        repo: repo,
        ref: `refs/heads/${name}`,
        sha: sha
    })
    return data.data
}


/**
 * 
 * @param name 
 * @param sha 
 * @param octokit 
 */
const createTag = async(tag: string, sha: string, owner: string, repo: string, message: string, octokit: Octokit): Promise<CreateGithubTag> => {
    await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
        owner,
        repo,
        sha,
        ref: `refs/tags/${tag}`
    })
    const res = await octokit.request("POST /repos/{owner}/{repo}/git/tags", {
        owner,
        repo,
        tag,
        type: "commit",
        message,
        tagger: {
            name: "poe",
            email: "poethebutler@deepai.services",
            date: new Date().toJSON(),
        },
        object: sha
    })

    return res.data
}

/**
 * Sets labels for a PR or Issues
 * @param labels 
 * @param payload 
 * @param octokit 
 * @returns 
 */
const setLabels = async( labels: string[], payload, octokit ) => {
    return await octokit.request(
        "PUT /repos/{owner}/{repo}/issues/{issue_number}/labels", {
            "owner": payload.repository.owner.login,
            "issue_number": payload.pull_request.number,
            "labels": [...new Set(labels)],
            "repo": payload.repository.name
        }
    )
}

/**
 * Retrieves a list of github tags
 * @param repo 
 * @param owner 
 * @param octokit 
 * @returns 
 */
const getTags = async (repo, owner, octokit: Octokit): Promise<GithubTag[]> => {
    return await octokit.paginate("GET /repos/{owner}/{repo}/tags", {owner, repo}, res => {
        if (res.status != 200) {
            throw `Failed accesing ${res.url}`
        }
        return res.data
    }) 
}

/**
 * Creates a unique github issue 
 * In case one already exists (closed or opened) it will not create another one
 * @param {string} repo - repo name
 * @param {string} owner - owner name
 * @param {Octokit} octokit - authenticated octokit client
 * @param {GithubIssue} issue - github issue
 */
const createUniqueIssue = async (repo: string, owner: string, octokit: Octokit, issue: GithubIssue, labels) => {
    const body = issue.body.slice(0, 64550)
    const foundIssue = await octokit.paginate("GET /repos/{owner}/{repo}/issues", {repo, owner}, (res, done) => {
        const l = res.data.filter( iss => iss.title == issue.title && iss.state == "open" )
        if (l.length > 0) { 
            done()
            return [l[0]] 
        }
        return []
    })
    if (foundIssue.length > 0) {
        return octokit.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
            repo,
            owner,
            title: issue.title,
            body: body,
            issue_number: foundIssue[0].number,
            labels: labels
        })
    }
    return await octokit.request('POST /repos/{owner}/{repo}/issues', {
        owner: owner,
        repo: repo,
        title: issue.title,
        body: body,
        labels: labels
    })
}

/**
 * Creates a github issue 
 * @param {string} repo - repo name
 * @param {string} owner - owner name
 * @param {Octokit} octokit - authenticated octokit client
 * @param {GithubIssue} issue - github issue
 */
const createIssue = async (repo: string, owner: string, octokit, issue: GithubIssue) => {
    return await octokit.request('POST /repos/{owner}/{repo}/issues', {
        owner: owner,
        repo: repo,
        title: issue.title,
        body: issue.body.slice(65550)
    })
}

/**
 * Retrieves all github issues
 * @param {string} repo - repo name
 * @param {string} owner - owner name
 * @param {Octokit} octokit - authenticated octokit client
 */
const getIssues = async (repo: string, owner: string, octokit: Octokit) => {
    return await octokit.paginate("GET /repos/{owner}/{repo}/issues", {repo, owner})
}

/**
 * Create a issue comment
 * @param issue_number 
 * @param owner 
 * @param repo 
 * @param body 
 * @param octokit 
 * @returns 
 */
const createComment = async (issue_number: number, owner: string, repo: string,  body: string, octokit: Octokit) => {
    const res = await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
        repo,
        owner, 
        body,
        issue_number 
    })
    return res.data
}


/**
 * Updates issues by setting its state to 'closed'
 * @param issue_number 
 * @param owner 
 * @param repo 
 * @param octokit 
 * @returns 
 */
const closeIssue = async (issue_number: number, owner: string, repo: string, octokit: Octokit) => {
    const res = await octokit.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
        issue_number,
        owner,
        repo,
        state: "closed"
    })
    return res.data
}

const createRelease = async (tag_name, body: string, owner:string, repo:string, octokit:Octokit) => {
    const res = await octokit.request("POST /repos/{owner}/{repo}/releases", {
        owner,
        repo,
        tag_name,
        body,
        prerelease: tag_name.includes("rc") ? true : false
    })
    return res.data
}

export {
    setLabels, 
    createIssue, 
    createUniqueIssue,
    getTags, 
    getIssues,
    createBranch,
    createTag,
    getComments,
    closeIssue,
    createComment,
    createRelease,
    getCompareURL,
    getTagCompareURL
}
