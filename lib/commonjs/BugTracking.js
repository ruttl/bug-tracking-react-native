"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
var _axios = _interopRequireDefault(require("axios"));
var _reactNativeViewShot = require("react-native-view-shot");
var _reactNativeDraggable = _interopRequireDefault(require("react-native-draggable"));
var _reactNativeMaterialRipple = _interopRequireDefault(require("react-native-material-ripple"));
var _reactNativeSvg = require("react-native-svg");
var _propTypes = _interopRequireDefault(require("prop-types"));
var _reactNativeToastMessage = _interopRequireWildcard(require("react-native-toast-message"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
const Constants = {
  zIndex: 999999999,
  aspectRatio: _reactNative.Dimensions.get('window').width / _reactNative.Dimensions.get('window').height
};
const height = _reactNative.Dimensions.get('window').height * 0.72; // reduce height by 30%

const aspectRatio = _reactNative.Dimensions.get('window').width / _reactNative.Dimensions.get('window').height;
const width = height * aspectRatio;
const Colors = ['#160647', '#FF4F6D', '#FCFF52'];
const InitialColor = Colors[1];
const BugTracking = _ref => {
  let {
    projectID,
    token
  } = _ref;
  if (!projectID || !token || !projectID && !token) {
    throw new Error(`Error: Unable to find required prop 'projectID' or 'token' or both.`);
  }
  const viewRef = (0, _react.useRef)();
  const [comment, setComment] = (0, _react.useState)('');
  const [currentPath, setCurrentPath] = (0, _react.useState)([]);
  const [expanded, setExpanded] = (0, _react.useState)(false);
  const [loading, setLoading] = (0, _react.useState)(false);
  const [paths, setPaths] = (0, _react.useState)([]);
  const [selectedColor, setSelectedColor] = (0, _react.useState)(InitialColor);
  const [src, setSrc] = (0, _react.useState)('');
  const [visible, setVisible] = (0, _react.useState)(false);
  const [widgetVisible, setWidgetVisible] = (0, _react.useState)(true);
  const withAnim = (0, _react.useRef)(new _reactNative.Animated.Value(40)).current;
  const onChangeSelectedColor = color => () => {
    setExpanded(false);
    setTimeout(() => {
      setSelectedColor(color);
    }, 500);
  };
  const onReset = () => {
    setComment('');
    setCurrentPath([]);
    setSrc('');
    setPaths([]);
    setVisible(false);
    setWidgetVisible(true);
  };
  const onScreenCapture = async () => {
    try {
      setWidgetVisible(false);
      await new Promise(resolve => {
        setTimeout(resolve, 100);
      });
      const uri = await (0, _reactNativeViewShot.captureScreen)({
        handleGLSurfaceViewOnAndroid: true,
        quality: 1
      });
      setSrc(uri);
      setVisible(true);
    } catch (e) {
      console.log(e);
      setWidgetVisible(true);
    }
  };
  const onSubmit = async () => {
    try {
      setLoading(true);
      const uri = await (0, _reactNativeViewShot.captureRef)(viewRef, {
        result: 'data-uri'
      });
      const apiClient = _axios.default.create({
        baseURL: `https://us-central1-rally-brucira.cloudfunctions.net/mobile/projects/${projectID}`,
        headers: {
          'x-plugin-code': token
        }
      });
      const {
        data: {
          id: ticketID
        }
      } = await apiClient.post('/tickets', {
        comment,
        appVersion: '1.0.0',
        device: 'iPhone',
        height: _reactNative.Dimensions.get('window').height,
        osName: 'iOS',
        width: _reactNative.Dimensions.get('window').width
      });
      await apiClient.post(`/tickets/${ticketID}/screenshot`, {
        image: uri
      });
      onReset();
      _reactNativeToastMessage.default.show({
        position: 'bottom',
        type: 'info',
        text1: 'New ticket added successfully.'
      });
    } catch (e) {
      onReset();
      _reactNativeToastMessage.default.show({
        position: 'bottom',
        type: 'info',
        text1: 'Something went wrong, try again.'
      });
    } finally {
      setLoading(false);
    }
  };
  const onTouchMove = event => {
    const newPath = [...currentPath];
    const {
      locationX,
      locationY
    } = event.nativeEvent;
    const newPoint = `${newPath.length === 0 ? 'M' : ''}${locationX.toFixed(0)},${locationY.toFixed(0)} `;
    newPath.push(newPoint);
    setCurrentPath(newPath);
  };
  const onTouchEnd = () => {
    const currentPaths = [...paths];
    const newPath = [...currentPath];
    currentPaths.push({
      color: selectedColor,
      data: newPath
    });
    setPaths(currentPaths);
    setCurrentPath([]);
  };
  const onUndo = () => {
    setPaths(state => state.slice(0, -1));
  };
  const toggleOpen = () => {
    setExpanded(state => !state);
  };
  (0, _react.useEffect)(() => {
    _reactNative.Animated.timing(withAnim, {
      toValue: 40 * (expanded ? 3 : 1),
      duration: 500,
      useNativeDriver: false
    }).start();
  }, [expanded, withAnim]);
  return /*#__PURE__*/_react.default.createElement(_react.Fragment, null, widgetVisible && /*#__PURE__*/_react.default.createElement(_reactNativeDraggable.default, {
    isCircle: true,
    minX: 0,
    minY: 0,
    maxX: _reactNative.Dimensions.get('window').width,
    maxY: _reactNative.Dimensions.get('window').height,
    onShortPressRelease: onScreenCapture,
    renderColor: Colors[0],
    renderSize: 72,
    touchableOpacityProps: {
      activeOpacity: 0
    },
    x: _reactNative.Dimensions.get('window').width - (72 + 16),
    y: _reactNative.Dimensions.get('window').height - (72 + 16),
    z: Constants.zIndex
  }, /*#__PURE__*/_react.default.createElement(_reactNative.View, {
    style: [styles.buttonContainer]
  }, /*#__PURE__*/_react.default.createElement(_reactNative.Image, {
    source: require('./assets/bug.png'),
    style: {
      width: 32,
      height: 32
    }
  }))), /*#__PURE__*/_react.default.createElement(_reactNative.Modal, {
    animationType: "slide",
    transparent: true,
    visible: visible
  }, /*#__PURE__*/_react.default.createElement(_reactNative.SafeAreaView, {
    style: styles.modalContainer
  }, /*#__PURE__*/_react.default.createElement(_reactNative.View, {
    style: styles.appbarContainer
  }, /*#__PURE__*/_react.default.createElement(_reactNativeMaterialRipple.default, {
    onPress: onReset,
    rippleCentered: true,
    rippleColor: "rgb(255, 251, 254)",
    style: [styles.iconButton, {
      marginRight: 'auto'
    }]
  }, /*#__PURE__*/_react.default.createElement(_reactNative.Image, {
    source: require('./assets/close.png'),
    style: {
      height: 24,
      width: 24
    }
  })), /*#__PURE__*/_react.default.createElement(_reactNativeMaterialRipple.default, {
    onPress: onUndo,
    rippleCentered: true,
    rippleColor: "rgb(255, 251, 254)",
    style: styles.iconButton
  }, /*#__PURE__*/_react.default.createElement(_reactNative.Image, {
    source: require('./assets/undo.png'),
    style: {
      height: 24,
      width: 24
    }
  })), /*#__PURE__*/_react.default.createElement(_reactNative.Animated.View, {
    style: [styles.colorsContainer, {
      width: withAnim
    }]
  }, /*#__PURE__*/_react.default.createElement(_reactNativeMaterialRipple.default, {
    onPress: toggleOpen,
    rippleCentered: true,
    rippleOpacity: 0.12,
    style: [styles.colorButton, {
      backgroundColor: selectedColor,
      borderColor: '#fff'
    }]
  }), Colors.filter(c => c !== selectedColor).map((c, i) => /*#__PURE__*/_react.default.createElement(_reactNativeMaterialRipple.default, {
    key: i,
    onPress: onChangeSelectedColor(c),
    rippleCentered: true,
    rippleOpacity: 0.12,
    style: [styles.colorButton, {
      backgroundColor: c,
      borderColor: c
    }]
  })))), /*#__PURE__*/_react.default.createElement(_reactNative.ScrollView, {
    contentContainerStyle: {
      alignItems: 'center'
    },
    style: styles.modalContainer
  }, /*#__PURE__*/_react.default.createElement(_reactNative.View, {
    style: styles.svgContainer,
    onTouchMove: onTouchMove,
    onTouchEnd: onTouchEnd
  }, src && /*#__PURE__*/_react.default.createElement(_reactNative.ImageBackground, {
    ref: viewRef,
    resizeMode: "contain",
    source: {
      uri: src
    }
  }, /*#__PURE__*/_react.default.createElement(_reactNativeSvg.Svg, {
    height: height,
    width: width
  }, /*#__PURE__*/_react.default.createElement(_reactNativeSvg.Path, {
    d: currentPath.join(''),
    stroke: selectedColor,
    fill: 'transparent',
    strokeWidth: 4,
    strokeLinejoin: 'round',
    strokeLinecap: 'round'
  }), paths.length > 0 && paths.map((_ref2, index) => {
    let {
      color,
      data
    } = _ref2;
    return /*#__PURE__*/_react.default.createElement(_reactNativeSvg.Path, {
      key: `path-${index}`,
      d: data.join(''),
      stroke: color,
      fill: 'transparent',
      strokeWidth: 4,
      strokeLinejoin: 'round',
      strokeLinecap: 'round'
    });
  }))))), /*#__PURE__*/_react.default.createElement(_reactNative.KeyboardAvoidingView, {
    behavior: _reactNative.Platform.OS === 'ios' ? 'padding' : 'height',
    style: styles.footerContainer
  }, /*#__PURE__*/_react.default.createElement(_reactNative.TextInput, {
    placeholder: "Write a comment",
    onChangeText: setComment,
    style: styles.textInput,
    value: comment
  }), /*#__PURE__*/_react.default.createElement(_reactNative.View, {
    style: {
      width: 4
    }
  }), loading ? /*#__PURE__*/_react.default.createElement(_reactNative.ActivityIndicator, null) : /*#__PURE__*/_react.default.createElement(_reactNative.Pressable, {
    disabled: loading,
    onPress: onSubmit,
    style: styles.button
  }, /*#__PURE__*/_react.default.createElement(_reactNative.Text, {
    style: {
      color: 'white'
    }
  }, "Send"))))), /*#__PURE__*/_react.default.createElement(_reactNativeToastMessage.default, {
    config: {
      info: props => /*#__PURE__*/_react.default.createElement(_reactNativeToastMessage.BaseToast, _extends({}, props, {
        style: {
          backgroundColor: '#6552ff',
          borderLeftWidth: 0
        },
        text1Style: {
          color: 'white',
          fontWeight: '400'
        }
      }))
    }
  }));
};
const styles = _reactNative.StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: Constants.zIndex
  },
  buttonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 72,
    width: 72,
    backgroundColor: Colors[0],
    borderRadius: 72 / 2,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'black'
  },
  appbarContainer: {
    height: 64,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    backgroundColor: 'black'
  },
  iconButton: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    width: 40,
    margin: 6,
    elevation: 0,
    overflow: 'hidden',
    borderRadius: 40 / 2
  },
  colorsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden'
  },
  colorButton: {
    height: 24,
    width: 24,
    margin: 6,
    borderRadius: 24 / 2,
    borderWidth: 1
  },
  svgContainer: {
    flex: 1,
    height,
    width
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 16
  },
  textInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#6552ff',
    borderRadius: 12
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
    elevation: 0,
    backgroundColor: '#6552ff'
  }
});
BugTracking.propTypes = {
  projectID: _propTypes.default.string.isRequired,
  token: _propTypes.default.string.isRequired
};
var _default = BugTracking;
exports.default = _default;