CRETE PROJECT : npx @react-native-community/cli@latest init [PROJECT_NAME]

----------------------------
1) :  import this at root file at the top : 
import 'react-native-gesture-handler';
import 'react-native-reanimated';


----------------------------
2) :  import Plugin at root file with wrapping of gesture handler : 

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
3) :  Add this Plugin into babel.config.js file : 
	
module.exports = {
		…….
		plugins: ['react-native-reanimated/plugin'],
		…….
}


----------------------------
 4) : Install required Library :
   
    "react-native-btr": "^2.2.1",
    "react-native-gesture-handler": "^2.25.0",
    "react-native-reanimated": "^3.17.5",
    "react-native-safe-area-context": "^5.4.0",
    "react-native-screens": "^4.10.0",
    "react-native-svg": "^15.12.0",
    "react-native-view-shot": "^4.0.3",
    "react-native-image-picker": "^8.2.1",