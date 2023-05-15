function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
import React, { Fragment, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, ImageBackground, KeyboardAvoidingView, Modal, Pressable, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { captureRef, captureScreen } from 'react-native-view-shot';
import Draggable from 'react-native-draggable';
import Ripple from 'react-native-material-ripple';
import { Path, Svg } from 'react-native-svg';
import PropTypes from 'prop-types';
import Toast, { BaseToast } from 'react-native-toast-message';
const Constants = {
  zIndex: 999999999,
  aspectRatio: Dimensions.get('window').width / Dimensions.get('window').height
};
const height = Dimensions.get('window').height * 0.72; // reduce height by 30%

const aspectRatio = Dimensions.get('window').width / Dimensions.get('window').height;
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
  const viewRef = useRef();
  const [comment, setComment] = useState('');
  const [currentPath, setCurrentPath] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paths, setPaths] = useState([]);
  const [selectedColor, setSelectedColor] = useState(InitialColor);
  const [src, setSrc] = useState('');
  const [visible, setVisible] = useState(false);
  const [widgetVisible, setWidgetVisible] = useState(true);
  const withAnim = useRef(new Animated.Value(40)).current;
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
      const uri = await captureScreen({
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
      const uri = await captureRef(viewRef, {
        result: 'data-uri'
      });
      const apiClient = axios.create({
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
        height: Dimensions.get('window').height,
        osName: 'iOS',
        width: Dimensions.get('window').width
      });
      await apiClient.post(`/tickets/${ticketID}/screenshot`, {
        image: uri
      });
      onReset();
      Toast.show({
        position: 'bottom',
        type: 'info',
        text1: 'New ticket added successfully.'
      });
    } catch (e) {
      onReset();
      Toast.show({
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
  useEffect(() => {
    Animated.timing(withAnim, {
      toValue: 40 * (expanded ? 3 : 1),
      duration: 500,
      useNativeDriver: false
    }).start();
  }, [expanded, withAnim]);
  return /*#__PURE__*/React.createElement(Fragment, null, widgetVisible && /*#__PURE__*/React.createElement(Draggable, {
    isCircle: true,
    minX: 0,
    minY: 0,
    maxX: Dimensions.get('window').width,
    maxY: Dimensions.get('window').height,
    onShortPressRelease: onScreenCapture,
    renderColor: Colors[0],
    renderSize: 72,
    touchableOpacityProps: {
      activeOpacity: 0
    },
    x: Dimensions.get('window').width - (72 + 16),
    y: Dimensions.get('window').height - (72 + 16),
    z: Constants.zIndex
  }, /*#__PURE__*/React.createElement(View, {
    style: [styles.buttonContainer]
  }, /*#__PURE__*/React.createElement(Image, {
    source: require('./assets/bug.png'),
    style: {
      width: 32,
      height: 32
    }
  }))), /*#__PURE__*/React.createElement(Modal, {
    animationType: "slide",
    transparent: true,
    visible: visible
  }, /*#__PURE__*/React.createElement(SafeAreaView, {
    style: styles.modalContainer
  }, /*#__PURE__*/React.createElement(View, {
    style: styles.appbarContainer
  }, /*#__PURE__*/React.createElement(Ripple, {
    onPress: onReset,
    rippleCentered: true,
    rippleColor: "rgb(255, 251, 254)",
    style: [styles.iconButton, {
      marginRight: 'auto'
    }]
  }, /*#__PURE__*/React.createElement(Image, {
    source: require('./assets/close.png'),
    style: {
      height: 24,
      width: 24
    }
  })), /*#__PURE__*/React.createElement(Ripple, {
    onPress: onUndo,
    rippleCentered: true,
    rippleColor: "rgb(255, 251, 254)",
    style: styles.iconButton
  }, /*#__PURE__*/React.createElement(Image, {
    source: require('./assets/undo.png'),
    style: {
      height: 24,
      width: 24
    }
  })), /*#__PURE__*/React.createElement(Animated.View, {
    style: [styles.colorsContainer, {
      width: withAnim
    }]
  }, /*#__PURE__*/React.createElement(Ripple, {
    onPress: toggleOpen,
    rippleCentered: true,
    rippleOpacity: 0.12,
    style: [styles.colorButton, {
      backgroundColor: selectedColor,
      borderColor: '#fff'
    }]
  }), Colors.filter(c => c !== selectedColor).map((c, i) => /*#__PURE__*/React.createElement(Ripple, {
    key: i,
    onPress: onChangeSelectedColor(c),
    rippleCentered: true,
    rippleOpacity: 0.12,
    style: [styles.colorButton, {
      backgroundColor: c,
      borderColor: c
    }]
  })))), /*#__PURE__*/React.createElement(ScrollView, {
    contentContainerStyle: {
      alignItems: 'center'
    },
    style: styles.modalContainer
  }, /*#__PURE__*/React.createElement(View, {
    style: styles.svgContainer,
    onTouchMove: onTouchMove,
    onTouchEnd: onTouchEnd
  }, src && /*#__PURE__*/React.createElement(ImageBackground, {
    ref: viewRef,
    resizeMode: "contain",
    source: {
      uri: src
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    height: height,
    width: width
  }, /*#__PURE__*/React.createElement(Path, {
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
    return /*#__PURE__*/React.createElement(Path, {
      key: `path-${index}`,
      d: data.join(''),
      stroke: color,
      fill: 'transparent',
      strokeWidth: 4,
      strokeLinejoin: 'round',
      strokeLinecap: 'round'
    });
  }))))), /*#__PURE__*/React.createElement(KeyboardAvoidingView, {
    behavior: Platform.OS === 'ios' ? 'padding' : 'height',
    style: styles.footerContainer
  }, /*#__PURE__*/React.createElement(TextInput, {
    placeholder: "Write a comment",
    onChangeText: setComment,
    style: styles.textInput,
    value: comment
  }), /*#__PURE__*/React.createElement(View, {
    style: {
      width: 4
    }
  }), loading ? /*#__PURE__*/React.createElement(ActivityIndicator, null) : /*#__PURE__*/React.createElement(Pressable, {
    disabled: loading,
    onPress: onSubmit,
    style: styles.button
  }, /*#__PURE__*/React.createElement(Text, {
    style: {
      color: 'white'
    }
  }, "Send"))))), /*#__PURE__*/React.createElement(Toast, {
    config: {
      info: props => /*#__PURE__*/React.createElement(BaseToast, _extends({}, props, {
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
const styles = StyleSheet.create({
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
  projectID: PropTypes.string.isRequired,
  token: PropTypes.string.isRequired
};
export default BugTracking;