import { App } from "@octokit/app";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { Octokit } from "@octokit/rest";
import { logger } from "../logging";

const PoeApp = App.defaults({
  Octokit: Octokit.plugin(paginateRest)
})

const app = new PoeApp({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
  oauth: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
  webhooks: {
    secret: process.env.GITHUB_WEBHOOK_SECRET,
  },
});

(async () => {
  const { data } = await app.octokit.request("/app");
  logger.info("authenticated as %s", data.name);
})()


export { app }