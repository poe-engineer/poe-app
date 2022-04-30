interface GithubIssue {
    title: string;
    body: string;
}

interface GithubTag {
    name: string;
    commit: {
        sha: string;
        url: string;
    };
    node_id: string;
}

interface CreateGithubTag {
    node_id: string;
    tag: string;
    sha: string;
    url: string;
    message: string;
    tagger: {
        date: string;
        email: string;
        name: string;
    };
    object: {
        sha: string;
        type: string;
        url: string;
    };
    verification?: {
        verified: boolean;
        reason: string;
        payload: string;
        signature: string;
    };
}

interface Branch {
    ref: string;
    node_id: string;
    url: string;
    object: {
        type: string;
        sha: string;
        url: string;
    };
}


export {
    GithubIssue,
    GithubTag,
    CreateGithubTag,
    Branch,
}