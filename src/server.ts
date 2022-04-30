import { createNodeMiddleware } from "@octokit/app";  
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { app } from './github/webhooks'
import { logger } from "./logging";

export const startServer = () => {
    logger.info("Starting server")
    
    const middleware = createNodeMiddleware(app);
    const srv = createServer(middleware).listen(process.env.PORT ? process.env.PORT : 3000);
    srv.on("request", (req: IncomingMessage, res: ServerResponse)=>{
        logger.info({
            "method": req.method,
            "url": req.url,
            "statusCode": res.statusCode,
        });
    })
    return
}
