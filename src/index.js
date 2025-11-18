import { requireNativeModule } from 'expo-modules-core';
const MyModuleJS = requireNativeModule('MyModule');
export { MyModuleJS };

export { default as BugTracking } from './BugTracking';
