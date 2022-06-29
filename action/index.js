// packages
const core = require("@actions/core");
const github = require("@actions/github");
const { IncomingWebhook } = require("@slack/webhook");

// libraries
const message = require("./lib/message");

// parse inputs
const inputs = {
  token: core.getInput("github-token", { required: true }),
  ignore: {
    jobs: (core.getInput("ignore-jobs") || "")
      .split(",")
      .map(Function.prototype.call, String.prototype.trim),
    steps: (core.getInput("ignore-steps") || "")
      .split(",")
      .map(Function.prototype.call, String.prototype.trim),
  },
  channelId: core.getInput("channel-id", { required: true }),
};

// error handler
function errorHandler(err) {
  console.error(err);
  core.setFailed(`Unhandled error: ${err}`);
}

// catch errors and exit
process.on("unhandledRejection", errorHandler);
process.on("uncaughtException", errorHandler);

// exit early
if (!github.context.workflow || !github.context.runId) {
  core.error("action triggered outside of a workflow run");
  process.exit(1);
}

// initiate the client
const octokit = github.getOctokit(inputs.token);

async function main() {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  // fetch workflow
  const {
    data: { workflows },
  } = await octokit.actions.listRepoWorkflows({
    ...github.context.repo,
  });

  // find the current workflow
  const workflow = workflows.find(
    (workflow) => workflow.name === github.context.workflow
  );

  // fetch run
  const run = await octokit.actions.getWorkflowRun({
    ...github.context.repo,
    run_id: github.context.runId,
  });

  // fetch jobs
  const {
    data: { jobs },
  } = await octokit.actions.listJobsForWorkflowRun({
    ...github.context.repo,
    run_id: github.context.runId,
  });

  const blocks = message(workflow, run.data, jobs, inputs.ignore);

  // send to Slack

  if (typeof webhookUrl !== "undefined" && webhookUrl.length > 0) {
    const webhook = new IncomingWebhook(webhookUrl);
    await webhook.send({ blocks });
  }

  if (typeof botToken !== "undefined" && botToken.length > 0) {
    const web = new WebClient(botToken);

    if (inputs.channelId.length <= 0) {
      console.log(
        "Channel ID is required to run this action. An empty one has been provided"
      );
      throw new Error(
        "Channel ID is required to run this action. An empty one has been provided"
      );
    }
    const message = "Workflow status";

    if (blocks) {
      // post message
      webResponse = await web.chat.postMessage({
        channel: channelId,
        text: message,
        ...(blocks || {}),
      });
    } else {
      console.log(
        "Missing blocks! Did not send a message via chat.postMessage with botToken",
        { channel: channelId, text: message, ...blocks }
      );
      throw new Error(
        "Missing message content, please input a valid payload or message to send. No Message has been send."
      );
    }
  }
}

// awaiting top-level await
main();
