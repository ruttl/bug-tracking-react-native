CREATE PROJECT :  npx create-expo-app@latest --template blank


----------------------------
1) :  import Plugin at root file with wrapping of gesture handler : 

import { BugTracking } from "@ruttl/bug-tracking";
import { GestureHandlerRootView } from "react-native-gesture-handler";
………..

     <GestureHandlerRootView style={{ ...CustomStyle }}>
     <BugTracking
       projectID="0mL3d2RMtvcAbAbV5xtC"
       token="vsirNGvN31gpoPsNz6YWLk6OFL92"
     />
    ..........
     [CODE]
    ..........
<GestureHandlerRootView>


----------------------------
2) : add plugin into babel.config.js file  : 

module.exports = function (api) {
 api.cache(true);
 return {
   presets: ["babel-preset-expo"],
   plugins: ["react-native-reanimated/plugin"],  		//ADD LAST 
 };
};


----------------------------
3) : Install required Library :

yarn add react-native-gesture-handler
yarn add react-native-reanimated
yarn add react-native-view-shot
yarn add react-native-svg
yarn add react-native-image-picker
yarn add react-native-material-ripple
yarn add react-native-device-info
yarn add expo-audio

4) : Prebuild Project :
- npx expo prebuild