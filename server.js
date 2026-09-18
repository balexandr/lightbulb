// Production server for the Expo Router web build (app.json -> web.output: "server").
// `expo export -p web` produces two folders under dist/:
//   dist/client — static HTML/JS/CSS/assets
//   dist/server — the API routes and SSR handlers (e.g. /api/illuminate)
// This just serves the former as static files and hands everything else to
// the latter via expo-server's Express adapter. Run `npm run build` first.
const path = require('path');
const express = require('express');
const { createRequestHandler } = require('expo-server/adapter/express');

const CLIENT_BUILD_DIR = path.join(__dirname, 'dist/client');
const SERVER_BUILD_DIR = path.join(__dirname, 'dist/server');

const app = express();

app.use(express.static(CLIENT_BUILD_DIR));
app.use(createRequestHandler({ build: SERVER_BUILD_DIR }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
