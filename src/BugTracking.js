import React, { Fragment, useEffect, useRef, useState } from 'react';
import { BottomSheet } from 'react-native-btr';
import {
  Animated as RNAnimated,
  Dimensions,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import axios from 'axios';
import { captureRef, captureScreen } from 'react-native-view-shot';
import Draggable from 'react-native-draggable';
import Ripple from 'react-native-material-ripple';
import { Path, Svg } from 'react-native-svg';
import PropTypes from 'prop-types';
import Toast, { BaseToast } from 'react-native-toast-message';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
} from 'react-native-reanimated';

const Constants = {
  zIndex: 999999999,
  aspectRatio: Dimensions.get('window').width / Dimensions.get('window').height,
};
const height = Dimensions.get('window').height * 0.72;
const width = height * Constants.aspectRatio;
const Colors = ['#160647', '#FF4F6D', '#FCFF52'];
const InitialColor = Colors[1];

const BUTTON_SIZE = 72;
const MARGIN = 0;
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

if (!global._REANIMATED_VERSION) {
  console.warn(
    '⚠️ You need to import `react-native-reanimated` at the top of your entry file.',
  );
}

export const CommentInput = ({
  comment,
  setComment,
  toggleBottomNavigationView,
  loading,
  onSubmit,
}) => {
  return (
    <>
      <View style={styles.inputWrapper}>
        <TextInput
          placeholder="Report the issue"
          placeholderTextColor="#16064780"
          onChangeText={setComment}
          style={styles.singleTextInput}
          value={comment}
          focusable={false}
          // onPressOut={toggleBottomNavigationView}
        />
        <TouchableOpacity onPress={toggleBottomNavigationView}>
          <Image
            source={require('./assets/chat-icon.png')}
            style={styles.iconImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>
      <View style={{ width: 4 }} />
      {loading ? (
        <ActivityIndicator color="#6552ff" style={{ paddingHorizontal: 4 }} />
      ) : (
        <TouchableOpacity
          disabled={comment === ''}
          onPress={onSubmit}
          style={styles.rightIconContainer}>
          <Image
            source={require('./assets/arrow-right.png')}
            style={styles.rightIcon}
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}
    </>
  );
};

const DraggableFab = ({ onPress }) => {
  const startX = Dimensions.get('window').width - 88;
  const startY = Dimensions.get('window').height - 88;

  // shared values track position
  const x = useSharedValue(startX);
  const y = useSharedValue(startY);

  const gesture = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      ctx.offsetX = x.value;
      ctx.offsetY = y.value;
    },
    onActive: (event, ctx) => {
      const newX = ctx.offsetX + event.translationX;
      const newY = ctx.offsetY + event.translationY;

      x.value = Math.max(
        MARGIN,
        Math.min(newX, SCREEN_WIDTH - BUTTON_SIZE - MARGIN),
      );
      y.value = Math.max(
        MARGIN,
        Math.min(newY, SCREEN_HEIGHT - BUTTON_SIZE - MARGIN),
      );
    },
  });

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <PanGestureHandler onGestureEvent={gesture}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            pointerEvents: 'box-none',
            zIndex: Constants.zIndex,
          },
          fabStyle,
        ]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPress}
          style={styles.buttonContainer}>
          <Image
            source={require('./assets/ruttl.png')}
            style={{ width: 24, height: 24 }}
          />
        </TouchableOpacity>
      </Animated.View>
    </PanGestureHandler>
  );
};

export const BugTracking = ({ projectID = '', token = '' }) => {
  if (!projectID || !token) {
    throw new Error(
      `Error: Unable to find required prop 'projectID' or 'token' or both.`,
    );
  }

  const viewRef = useRef();
  const [comment, setComment] = useState('');
  const [description, setDescription] = useState('');
  const [currentPath, setCurrentPath] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paths, setPaths] = useState([]);
  const [selectedColor, setSelectedColor] = useState(InitialColor);
  const [src, setSrc] = useState('');
  const [visible, setVisible] = useState(false);
  const [btmSheetVisible, setbtmSheetVisible] = useState(false);

  const toggleBottomNavigationView = () => {
    setbtmSheetVisible(!btmSheetVisible);
  };

  const [isTouch, setTouch] = useState(false);
  const [widgetVisible, setWidgetVisible] = useState(true);
  const withAnim = useRef(new RNAnimated.Value(40)).current;
  const [lastTouch, setLastTouch] = useState([-1, -1]);
  const issueTitleRef = useRef(null);

  const onChangeSelectedColor = (color) => () => {
    setExpanded(false);

    setTimeout(() => {
      setSelectedColor(color);
    }, 500);
  };

  const onReset = () => {
    setComment('');
    setDescription('');
    setCurrentPath([]);
    setSrc('');
    setPaths([]);
    setVisible(false);
    setWidgetVisible(true);
  };

  const onScreenCapture = async () => {
    try {
      setWidgetVisible(false);
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      const uri = await captureScreen({
        handleGLSurfaceViewOnAndroid: true,
        quality: 1,
      });

      setSrc(uri);
      setVisible(true);
    } catch (e) {
      setWidgetVisible(true);
    }
  };

  const onSubmit = async () => {
    try {
      setLoading(true);
      if (!viewRef.current) {
        Toast.show({
          type: 'error',
          text1: 'Capture error',
          text2: 'Screenshot view is not available.',
        });
        return;
      }

      const uri = await captureRef(viewRef, {
        result: 'data-uri',
      });

      const apiClient = axios.create({
        // baseURL: `https://us-central1-ruttlp.cloudfunctions.net/mobile/projects/${projectID}`,
        baseURL: `https://us-central1-rally-brucira.cloudfunctions.net/mobile/projects/${projectID}`,
        headers: { 'x-plugin-code': token },
      });

      const saveData = {
        comment,
        description: btmSheetVisible ? description : null,
        // appVersion: '1.0.0',
        // device: 'iPhone',
        height: Dimensions.get('window').height,
        osName: Platform.OS,
        width: Dimensions.get('window').width,
      };

      const {
        data: { id: ticketID },
      } = await apiClient.post('/tickets', saveData);

      await apiClient
        .post(`/tickets/${ticketID}/screenshot`, {
          image: uri,
        })
        .then(() =>
          Toast.show({
            position: 'top',
            type: 'info',
            text1: 'New ticket added successfully.',
          }),
        )
        .catch((e) => console.log('Error is' + e));

      onReset();
    } catch (e) {
      console.log('Error in request ' + e);
      onReset();

      Toast.show({
        position: 'top',
        type: 'info',
        text1: 'Something went wrong',
        text2: e?.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const onTouchStart = (event) => {
    setLastTouch([event.nativeEvent.locationX, event.nativeEvent.locationY]);
    setTouch(true);
  };

  const onTouchMove = (event) => {
    if (isTouch) {
      const newPath = [...currentPath];
      const { locationX, locationY } = event.nativeEvent;
      const newPoint = `${newPath.length === 0 ? 'M' : ''}${locationX.toFixed(
        0,
      )},${locationY.toFixed(0)} `;

      if (
        locationX > 2 &&
        locationY > 2 &&
        locationX < width - 2 &&
        locationY < height - 2 &&
        !(lastTouch[0] < 15 && locationX - lastTouch[0] > 25) &&
        !(lastTouch[1] < 15 && locationY - lastTouch[1] > 25) &&
        !(lastTouch[0] > width - 15 && lastTouch[0] - locationX > 25) &&
        !(lastTouch[1] > height - 15 && lastTouch[0] - locationX > 25)
      ) {
        newPath.push(newPoint);
        setLastTouch([locationX, locationY]);
        setCurrentPath(newPath);
      } else {
        setTouch(false);
      }
    }
  };

  const onTouchEnd = () => {
    const currentPaths = [...paths];
    const newPath = [...currentPath];
    currentPaths.push({ color: selectedColor, data: newPath });
    setPaths(currentPaths);
    setCurrentPath([]);
  };

  const onUndo = () => {
    setPaths((state) => state.slice(0, -1));
  };

  const toggleOpen = () => {
    setExpanded((state) => !state);
  };

  useEffect(() => {
    RNAnimated.timing(withAnim, {
      toValue: 40 * (expanded ? 3 : 1),
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [expanded, withAnim]);

  useEffect(() => {
    let timeout;
    if (btmSheetVisible) {
      timeout = setTimeout(() => {
        issueTitleRef.current?.focus();
      }, 200);
    }
    return () => clearTimeout(timeout);
  }, [btmSheetVisible]);

  return (
    <View style={{ zIndex: 999 }}>
      <Fragment>
        {widgetVisible && <DraggableFab onPress={onScreenCapture} />}
        {/* {widgetVisible && (
          <Draggable
            isCircle
            minX={0}
            minY={0}
            maxX={Dimensions.get('window').width}
            maxY={Dimensions.get('window').height}
            onShortPressRelease={onScreenCapture}
            renderColor={Colors[0]}
            renderSize={72}
            onDrag={() => {}}
            onPressOut={() => {}}
            onRelease={() => {}}
            touchableOpacityProps={{activeOpacity: 0}}
            x={Dimensions.get('window').width - (72 + 16)}
            y={Dimensions.get('window').height - (72 + 16)}
            z={Constants.zIndex}>
            <View style={[styles.buttonContainer]}>
              <Image
                source={require('./assets/ruttl.png')}
                style={{
                  width: 24,
                  height: 24,
                }}
              />
            </View>
          </Draggable>
        )} */}
        <Modal animationType="slide" transparent visible={visible}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.appbarContainer}>
              <Ripple
                onPress={onReset}
                rippleCentered
                rippleColor="rgb(255, 251, 254)"
                style={[styles.iconButton, { marginRight: 'auto' }]}>
                <Image
                  source={require('./assets/close.png')}
                  style={{ height: 24, width: 24 }}
                />
              </Ripple>
              <Ripple
                onPress={onUndo}
                rippleCentered
                rippleColor="rgb(255, 251, 254)"
                style={styles.iconButton}>
                <Image
                  source={require('./assets/undo.png')}
                  style={{ height: 24, width: 24 }}
                />
              </Ripple>
              <RNAnimated.View
                style={[styles.colorsContainer, { width: withAnim }]}>
                <Ripple
                  onPress={toggleOpen}
                  rippleCentered
                  rippleOpacity={0.12}
                  style={[
                    styles.colorButton,
                    { backgroundColor: selectedColor, borderColor: '#fff' },
                  ]}
                />
                {Colors.filter((c) => c !== selectedColor).map((c, i) => (
                  <Ripple
                    key={i}
                    onPress={onChangeSelectedColor(c)}
                    rippleCentered
                    rippleOpacity={0.12}
                    style={[
                      styles.colorButton,
                      { backgroundColor: c, borderColor: c },
                    ]}
                  />
                ))}
              </RNAnimated.View>
            </View>
            <ScrollView
              ref={viewRef}
              contentContainerStyle={{ alignItems: 'center' }}
              style={styles.modalContainer}>
              <View
                style={styles.svgContainer}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}>
                {src && (
                  <ImageBackground
                    ref={viewRef}
                    resizeMode="contain"
                    source={{ uri: src }}>
                    <Svg height={height} width={width}>
                      <Path
                        d={currentPath.join('')}
                        stroke={selectedColor}
                        fill={'transparent'}
                        strokeWidth={4}
                        strokeLinejoin={'round'}
                        strokeLinecap={'round'}
                      />
                      {paths.length > 0 &&
                        paths.map(({ color, data }, index) => (
                          <Path
                            key={`path-${index}`}
                            d={data.join('')}
                            stroke={color}
                            fill={'transparent'}
                            strokeWidth={4}
                            strokeLinejoin={'round'}
                            strokeLinecap={'round'}
                          />
                        ))}
                    </Svg>
                  </ImageBackground>
                )}
              </View>
            </ScrollView>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.footerContainer}>
              {!btmSheetVisible && (
                <CommentInput
                  comment={comment}
                  setComment={setComment}
                  toggleBottomNavigationView={toggleBottomNavigationView}
                  loading={loading}
                  onSubmit={onSubmit}
                />
              )}
              <BottomSheet
                visible={btmSheetVisible}
                onBackButtonPress={toggleBottomNavigationView}
                onBackdropPress={toggleBottomNavigationView}>
                <View style={styles.bottomSheetContainer}>
                  <View style={styles.bottomSheetIndicator}></View>
                  <TextInput
                    ref={issueTitleRef}
                    style={[styles.bottomSheetTextInput, { marginBottom: 13 }]}
                    keyboardType="name-phone-pad"
                    placeholder="Add issue title"
                    placeholderTextColor="#16064780"
                    value={comment}
                    onChangeText={setComment}
                  />
                  <TextInput
                    style={[styles.bottomSheetTextInput, { height: 164 }]}
                    keyboardType="name-phone-pad"
                    placeholder="Add issue description"
                    placeholderTextColor="#16064780"
                    multiline
                    numberOfLines={5}
                    value={description}
                    onChangeText={setDescription}
                  />
                  {loading ? (
                    <ActivityIndicator
                      color="#6552ff"
                      style={{ paddingHorizontal: 4 }}
                    />
                  ) : (
                    <TouchableOpacity
                      onPress={onSubmit}
                      style={[
                        styles.bottomSheetButtonContainer,
                        {
                          backgroundColor:
                            comment !== '' ? '#6552FF' : '#6552FF80',
                        },
                      ]}>
                      <Text style={styles.submitButtonText}>Submit</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </BottomSheet>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
        <Toast
          config={{
            info: (props) => (
              <BaseToast
                {...props}
                style={{ backgroundColor: '#6552ff', borderLeftWidth: 0 }}
                text1Style={{
                  color: 'white',
                  fontWeight: '400',
                }}
              />
            ),
          }}
        />
      </Fragment>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: Constants.zIndex,
  },
  buttonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 60,
    width: 60,
    backgroundColor: Colors[0],
    // backgroundColor: 'white',
    borderRadius: 60 / 4,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  appbarContainer: {
    height: 64,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    backgroundColor: 'black',
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
    borderRadius: 40 / 2,
  },
  colorsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  colorButton: {
    height: 24,
    width: 24,
    margin: 6,
    borderRadius: 24 / 2,
    borderWidth: 1,
  },
  svgContainer: {
    flex: 1,
    height,
    width,
  },
  // footerContainer: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   paddingVertical: 4,
  //   paddingHorizontal: 16,
  // },
  textInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#6552ff',
    borderRadius: 12,
    color: '#160647',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
    elevation: 0,
    backgroundColor: '#6552ff',
  },

  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ECECEC',
    height: 65,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7E7E7',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    height: 45,
    flex: 1,
  },
  singleTextInput: {
    flex: 1,
    color: '#160647',
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter-Medium', // make sure it's loaded via font loader
    lineHeight: 19.5, // 130% of 15px
    fontWeight: '500', // for Android consistency
    overflow: 'hidden',
  },
  rightIconContainer: {
    height: 40,
    width: 40,
    backgroundColor: '#6552ff',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightIcon: {
    height: 24,
    width: 24,
  },
  iconImage: {
    width: 24,
    height: 24,
    marginLeft: 8,
  },
  bottomSheetContainer: {
    paddingHorizontal: 16,
    padding: 10,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
  },
  bottomSheetIndicator: {
    width: 48,
    height: 5,
    borderRadius: 8,
    backgroundColor: '#E4E4E4',
    marginBottom: 20,
  },
  bottomSheetTextInput: {
    width: '100%',
    height: 45,
    borderColor: '#E7E7E7',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 13,
    fontFamily: 'Inter-Medium', // Or 'Inter' if you're using default variant
    fontSize: 15,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 19.5, // 130% of 15
    color: '#160647',
    marginBottom: 13,
    textAlignVertical: 'top',
  },
  bottomSheetButtonContainer: {
    width: '100%',
    borderRadius: 8,
    alignItems: 'center',
    padding: 15,
    height: 48,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold', // Or 'Inter' if you're using the default
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '600',
    lineHeight: undefined, // 'normal' is default in React Native
    letterSpacing: -0.32,
  },
});

BugTracking.propTypes = {
  projectID: PropTypes.string.isRequired,
  token: PropTypes.string.isRequired,
};

export default BugTracking;
