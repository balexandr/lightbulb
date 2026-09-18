# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Deploying the web server (Render)

`app.json`'s `web.output` is `"server"` because `app/api/illuminate+api.ts`
is a real API route (proxies OpenAI so the key never reaches the client) —
that only works when the web build runs as a Node server, not static files.

This repo includes a `render.yaml` blueprint:

1. On Render, "New" → "Blueprint", point it at this repo.
2. Set `OPENAI_API_KEY` in the service's environment settings (marked
   `sync: false` in the blueprint, so Render prompts for it rather than
   storing it in git).
3. Deploy. `npm run build` (`expo export -p web`) produces `dist/client`
   (static assets) and `dist/server` (the API route); `npm run serve`
   (`node server.js`) serves both.

Native (iOS/Android) builds have no same-origin `/api/illuminate` to call,
so set `EXPO_PUBLIC_API_BASE_URL` to the deployed Render URL when building
those — see `.env.example`. Don't set it for the web build itself; leaving
it unset makes the web client call `/api/illuminate` same-origin.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
