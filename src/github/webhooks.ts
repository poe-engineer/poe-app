import { app } from "./app";
import { parseReleaseComment, promptRelease } from "../release/release";

app.webhooks.on("push", context => {
    promptRelease(context)
    
})

app.webhooks.on("issue_comment", ctx => {
    parseReleaseComment(ctx)
})


export {app};