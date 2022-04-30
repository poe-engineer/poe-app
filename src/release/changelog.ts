import { Octokit } from '@octokit/rest';
import { logger } from '../logging';

interface ChangeLog { 
    commits: any[]
    text: string
}

interface Commit {
    url: string;
    sha: string;
    node_id: string;
    html_url: string;
    comments_url: string;
    commit: {
        url: string;
        author: {
            name?: string;
            email?: string;
            date?: string;
        };
        committer: {
            name?: string;
            email?: string;
            date?: string;
            login?: string;
        };
        message: string;
        comment_count: number;
    };
}

/**
 * Extracts all shas from changelog
 * @param changelog 
 * @returns 
 */
const extractCommitsFromChangelog = (changelog: string): string[] => {
    logger.debug(`Extracting changelog from issue comment body: ${changelog}`)
    const res = /(?<=<!--commits\n)(?<log>(.|\n)*)(?=-->)/g.exec(changelog)
    if (res) {
        logger.debug(res);
        return res.groups.log.match(/\b[0-9a-f]{5,40}\b/g)
    }
    return []
}

/**
 * Extracts all commit log from a issue comment
 * @param body 
 * @returns 
 */
const extractChangeLogFromComment = (body: string): string => {
    
    logger.debug(`Extracting changelog from issue comment body: ${body}`)
    const res = /(?<=### Changelog Text\n)(?<log>(.|\n)*)(?=---)/g.exec(body)
    if (res) {
        return res.groups.log
    }
    logger.debug(`Failed parsing body: ${body}\n res ${JSON.stringify(res)}`)
    return ""
}

/**
 * 
 * @param startSha 
 * @param endSha 
 * @param octokit 
 * @param repo 
 * @param owner 
 * @returns 
 */
const getGitLogDiff = async (startSha:string, endSha:string, octokit: Octokit, repo: string, owner:string): Promise<Commit[]> => {
    const commits = await octokit.paginate("GET /repos/{owner}/{repo}/commits", {
        owner: owner,
        repo: repo,
        sha: startSha,
    })
    const logCommits = []
    for (let index = 0; index < commits.length; index++) {
        const element = commits[index];
        if (element.sha == endSha) {
            break
        }
        logCommits.push(element)
    }
    return logCommits
}

/**
 * 
 * @param text 
 * @param log 
 * @returns 
 */
const generateChangelogText = (log: Commit[]): string => {
    return `
${log.map( elem => {
    const long = elem.commit.message.includes("\n")
    const msg = long ? elem.commit.message.substring(0, elem.commit.message.indexOf("\n")) : elem.commit.message
    return `* ${msg} by ${elem.commit.author.name}`
}).join("\n")}
`
}

/**
 * Returns commits log based on two shas
 * @param startSha 
 * @param endSha 
 * @param octokit 
 * @returns 
 */
const getChangelog =  async (startSha: string, endSha: string, octokit: Octokit, owner: string, repo: string): Promise<ChangeLog> => {
    logger.debug("Retrieving changelog with:\n ");
    logger.debug(`${startSha} and ${endSha}`);
    
    const log = await getGitLogDiff(startSha, endSha, octokit, repo, owner);
    return {
        commits: log,
        text: generateChangelogText(log)
    }
}

export { getChangelog, extractChangeLogFromComment, extractCommitsFromChangelog, ChangeLog }