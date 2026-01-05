-------------------- Clear Everything like --------------------
- node_modules
- yarn.lock
- lib folder
- build folder

-------------------- Install Everything new fresh start using npm --------------------
- npm install / yarn
- npm run clean / yarn clean
- npm run build / yarn build
- npm pack / yarn pack

-------------------- UPDATE FILES --------------------
- cd android/build/src/main/java/expo/modules/mymodule
- update MyModule.kt & ScreenRecordService.kt file
- BugTracking.js & update assets folder
- update import's of module in BugTracking.js file from index file as not default module

-------------------- CONSUMER PROJECTS APP BUILD --------------------
- cd android
- ./gradlew assembleRelease
- cp android/app/build/outputs/apk/release/app-release.apk ~/Desktop/

-------------------- CONSUMER INCRESED BUILD NUMBER --------------------
- pnpm react-native-version --set-build 42 (SPECIFIC NUMBER)

-------------------- PUBLISH PACKAGE --------------------
- npm version patch/minor/major
- npm run build
- npm whoami (CHECK LOGIN USER)
- npm login (IF NOT LOGIN)
- npm whoami (CHECK LOGIN USER)
- npm publish --access public (PUSH CHANGES)

-------------------- CONSUMER PROJECTS TODO --------------------
- yarn cache clean @ruttl/bug-tracking
