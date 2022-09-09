const express = require("express");
const path = require("path");
const child_process = require("child_process");
const fs = require("fs");
const fetch = require("node-fetch-commonjs");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/DejaVuSansMono.ttf", (req, res) => {
  res.sendFile(path.join(__dirname, "DejaVuSansMono.ttf"));
});

app.post("/trash", async (req, res) => {
  const b = req.body;
  if (b.action !== "released") {
    return res.status(200).send("not released");
  }
  if (b.release.assets.length < 1) {
    return res.status(200).send("no assets");
  }
  const url = b.release.assets[0].browser_download_url;
  res.status(200).send("done");
  const content = (await fetch(url).then((x) => x.buffer())).toString("base64");
  const lastCommitSha = (
    await fetch("https://api.github.com/repos/Steffan153/trash/branches/main").then((x) =>
      x.json()
    )
  ).commit.sha;
  const base64BlobSha = await fetch(
    "https://api.github.com/repos/Steffan153/trash/git/blobs",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.GITHUB_TOKEN,
      },
      body: JSON.stringify({
        encoding: "base64",
        content,
      }),
    }
  )
    .then((x) => x.json())
    .then((x) => x.sha);
  const treeSha = await fetch("https://api.github.com/repos/Steffan153/trash/git/trees", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.GITHUB_TOKEN,
    },
    body: JSON.stringify({
      base_tree: lastCommitSha,
      tree: [
        {
          path: "randomjunk.txt",
          mode: "100644",
          type: "blob",
          sha: base64BlobSha,
        },
      ],
    }),
  })
    .then((x) => x.json())
    .then((x) => x.sha);
  const newCommitSha = await fetch(
    "https://api.github.com/repos/Steffan153/trash/git/commits",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.GITHUB_TOKEN,
      },
      body: JSON.stringify({
        message: "Add some random junk",
        author: {
          name: "Fig Bot",
          email: "noreply@github.com",
        },
        parents: [lastCommitSha],
        tree: treeSha,
      }),
    }
  )
    .then((x) => x.json())
    .then((x) => x.sha);
  await fetch("https://api.github.com/repos/Steffan153/trash/git/refs/heads/main", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.GITHUB_TOKEN,
    },
    body: JSON.stringify({
      ref: "refs/heads/main",
      sha: newCommitSha,
    }),
  });
});

app.post("/run", (req, res) => {
  fs.writeFile("code.fig", req.body.code, (err) => {
    if (err) {
      res.status(500).send("Writing code to file failed.");
      return;
    }
    const proc = child_process.spawn("java", [
      "-jar",
      "Fig.jar",
      "run",
      "code.fig",
      ...req.body.inputs,
    ]);
    const timeout = setTimeout(() => proc.kill("SIGINT"), 10000);
    let out = "";
    let debug = "";
    let outExceeded = false,
      debugExceeded = false;
    proc.stdout.on("data", (chunk) => {
      out += chunk;
      if (out.length > 10000 && !outExceeded) {
        proc.kill("SIGINT");
        debug += "\nSTDOUT exceeded 10KB, process was terminated.";
        outExceeded = true;
      }
    });
    proc.stderr.on("data", (chunk) => {
      debug += chunk;
      if (debug.length > 10000 && !debugExceeded) {
        proc.kill("SIGINT");
        debug += "\nSTDERR exceeded 10KB, process was terminated.";
        debugExceeded = true;
      }
    });
    proc.on("close", () => {
      clearTimeout(timeout);
      res.send({ out, debug });
    });
  });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
