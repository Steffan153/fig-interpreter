const express = require("express");
const path = require('path');
const child_process = require('child_process');
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/DejaVuSansMono.ttf", (req, res) => {
  res.sendFile(path.join(__dirname, "DejaVuSansMono.ttf"));
})

app.post("/run", (req, res) => {
  fs.writeFile('code.fig', req.body.code, (err) => {
    if (err) {
      res.status(500).send("Writing code to file failed.");
      return;
    }
    child_process.execSync("unset JAVA_TOOL_OPTIONS");
    const proc = child_process.spawn('java', ['-jar', 'Fig.jar', 'run', 'code.fig', ...req.body.inputs]);
    const timeout = setTimeout(() => proc.kill('SIGINT'), 10000);
    let out = '';
    let debug = '';
    let outExceeded = false, debugExceeded = false;
    proc.stdout.on('data', (chunk) => {
      out += chunk;
      if (out.length > 10000 && !outExceeded) {
        proc.kill('SIGINT');
        debug += "\nSTDOUT exceeded 10KB, process was terminated.";
        outExceeded = true;
      }
    });
    proc.stderr.on('data', (chunk) => {
      debug += chunk;
      if (debug.length > 10000 && !debugExceeded) {
        proc.kill('SIGINT');
        debug += "\nSTDERR exceeded 10KB, process was terminated.";
        debugExceeded = true;
      }
    });
    proc.on('close', () => {
      clearTimeout(timeout);
      res.send({ out, debug });
    });
  });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
