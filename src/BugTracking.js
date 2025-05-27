import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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
  StatusBar,
  useColorScheme,
} from 'react-native';
import axios from 'axios';
import { captureRef, captureScreen } from 'react-native-view-shot';
import Ripple from 'react-native-material-ripple';
import { Path, Svg } from 'react-native-svg';
import PropTypes from 'prop-types';
import Toast, { BaseToast } from 'react-native-toast-message';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

const PADDING = 24;
const BUTTON_SIZE = 72;
const Z_INDEX = 999999999;
const COLORS = ['#160647', '#FF4F6D', '#FCFF52'];
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const ASPECT_RATIO = SCREEN_WIDTH / SCREEN_HEIGHT;
const START_POS = {
  x: SCREEN_WIDTH - BUTTON_SIZE - PADDING,
  y: SCREEN_HEIGHT - BUTTON_SIZE - PADDING,
};

const height = Dimensions.get('window').height * 0.72;
const width = height * ASPECT_RATIO;

export const CommentInput = ({
  comment,
  toggleBottomNavigationView,
  loading,
  onSubmit,
  handleCommentChange,
  error,
  theme,
}) => {
  return (
    <View style={styles.commentContainer}>
      <View style={styles.row}>
        <View
          style={[
            styles.inputWrapper,
            { backgroundColor: theme?.background || '#000' },
          ]}>
          <TextInput
            placeholder={'Report the issue'}
            placeholderTextColor={theme?.placeholder || '#000'}
            onChangeText={handleCommentChange}
            value={comment}
            style={[styles.singleTextInput, { color: theme?.text || '#000' }]}
          />
          <TouchableOpacity onPress={toggleBottomNavigationView}>
            <Image
              source={require('./assets/chat-icon.png')}
              style={styles.iconImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>

        <View style={{ width: 8 }} />

        <TouchableOpacity
          onPress={onSubmit}
          style={styles.rightIconContainer}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFF" style={{ paddingHorizontal: 4 }} />
          ) : (
            <Text style={styles.addButtonStyle}>Add</Text>
          )}
        </TouchableOpacity>
      </View>
      {error && (
        <Text style={[styles.errorText, { marginLeft: 12 }]}>
          Please enter a comment before submitting
        </Text>
      )}
    </View>
  );
};

const DraggableFab = ({ onPress, onDragEnd, initialX, initialY }) => {
  const startX = initialX;
  const startY = initialY;

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
        PADDING,
        Math.min(newX, SCREEN_WIDTH - BUTTON_SIZE - PADDING),
      );
      y.value = Math.max(
        PADDING,
        Math.min(newY, SCREEN_HEIGHT - BUTTON_SIZE - PADDING),
      );
    },
    onEnd: () => {
      // Find nearest corner
      const toLeft = x.value < SCREEN_WIDTH / 2;
      const toTop = y.value < SCREEN_HEIGHT / 2;

      const finalX = toLeft ? PADDING : SCREEN_WIDTH - BUTTON_SIZE - PADDING;
      const finalY = toTop ? PADDING : SCREEN_HEIGHT - BUTTON_SIZE - PADDING;

      x.value = withTiming(finalX, { duration: 400 });
      y.value = withTiming(finalY, { duration: 400 }, () => {
        if (onDragEnd) runOnJS(onDragEnd)({ x: finalX, y: finalY });
      });
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
            zIndex: Z_INDEX,
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

export const BugTracking = ({projectID = '', token = ''}) => {
  if (!projectID || !token) {
    throw new Error(
      `Error: Unable to find required prop 'projectID' or 'token' or both.`,
    );
  }

  const viewRef = useRef();
  const exportRef = useRef();
  const [comment, setComment] = useState('');
  const [description, setDescription] = useState('');
  const [currentPath, setCurrentPath] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paths, setPaths] = useState([]);
  const [selectedColor, setSelectedColor] = useState(COLORS[1]);
  const [src, setSrc] = useState('');
  const [visible, setVisible] = useState(false);
  const [btmSheetVisible, setbtmSheetVisible] = useState(false);
  const [error, setError] = useState(false);
  const [isTouch, setTouch] = useState(false);
  const [widgetVisible, setWidgetVisible] = useState(true);
  const withAnim = useRef(new RNAnimated.Value(40)).current;
  const [lastTouch, setLastTouch] = useState([-1, -1]);
  const issueTitleRef = useRef(null);
  const [fabPos, setFabPos] = useState(START_POS);
const scheme = useColorScheme();

  const toggleBottomNavigationView = () => {
    setbtmSheetVisible(!btmSheetVisible);
  };

  const onChangeSelectedColor = color => () => {
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
    setError(false);
  };

  const onScreenCapture = async () => {
    try {
      setWidgetVisible(false);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const uri = await captureScreen({
        handleGLSurfaceViewOnAndroid: true,
        quality: 1,
      });

      if (uri) {
        setSrc(uri);
        setVisible(true);
      } else {
        throw new Error('Unsupported view on the screenshot.');
      }
    } catch (e) {
      setWidgetVisible(true);
      const message =
        e.message || 'Something went wrong while taking the screenshot.';
      Toast.show({
        type: 'error',
        text1: 'Capture error',
        text2: message,
      });
    }
  };

  const onSubmit = async () => {
    try {
      if (!comment.trim()) {
        setError(true);
        return;
      }

      setLoading(true);
      if (!exportRef.current) {
        Toast.show({
          type: 'error',
          text1: 'Capture error',
          text2: 'Screenshot view is not available.',
        });
        return;
      }

      const uri = await captureRef(exportRef, {
        result: 'data-uri',
        quality: 1,
        height: SCREEN_HEIGHT,
        width: SCREEN_WIDTH,
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
        height: SCREEN_HEIGHT,
        osName: Platform.OS,
        width: SCREEN_WIDTH,
      };

      const {
        data: { id: ticketID },
      } = await apiClient.post('/tickets', saveData);

      await apiClient
        .post(`/tickets/${ticketID}/screenshot`, { image: uri })
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

  const onUndo = () => setPaths((state) => state.slice(0, -1));

  const toggleOpen = () => setExpanded((state) => !state);

  const handleCommentChange = (text) => {
    setComment(text);
    if (error && text?.trim()) {
      setError(false);
    }
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

  const buttonColor = useMemo(
    () => (comment?.trim() !== '' ? '#6552FF' : '#6552FF80'),
    [comment],
  );

  const buttonText = useMemo(
    () => (loading ? 'Submitting...' : 'Submit'),
    [loading],
  );

  const theme = useMemo(() => {
    return {
      background: scheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
      text: scheme === 'dark' ? '#FFFFFF' : '#000000',
      placeholder: scheme === 'dark' ? '#FFFFFF66' : '#00000066',
    };
  }, [scheme]);

  return (
    <View style={{ zIndex: 999 }}>
      <Fragment>
        {widgetVisible ? (
          <DraggableFab
            onPress={onScreenCapture}
            initialX={fabPos.x}
            initialY={fabPos.y}
            onDragEnd={setFabPos}
          />
        ) : (
          <StatusBar backgroundColor={'#000'}></StatusBar>
        )}

        <Modal animationType="slide" visible={visible} transparent={false}>
          <SafeAreaView style={styles.modalContainer}>
            <View
              style={{
                flex: 1,
                borderRadius: 28,
                overflow: 'hidden',
                padding: 16,
                backgroundColor: '#1F1F1F',
              }}>
              <View style={styles.appbarContainer}>
                <Ripple
                  onPress={onReset}
                  rippleCentered
                  rippleColor="rgb(255, 251, 254)"
                  style={[
                    {
                      marginRight: 'auto',
                      width: 80,
                      borderRadius: 27,
                      backgroundColor: theme?.background,
                      height: 34,
                      justifyContent: 'center',
                      alignItems: 'center',
                    },
                  ]}>
                  <Text
                    style={{
                      color: theme?.text,
                      marginHorizontal: 12,
                      fontWeight: '600',
                      fontSize: 16,
                      lineHeight: 16, // 100% of 16px
                      letterSpacing: -0.32, // -2% of 16px = -0.32
                    }}>
                    Close
                  </Text>
                </Ripple>
                <Ripple
                  onPress={onUndo}
                  rippleCentered
                  rippleColor="rgb(255, 251, 254)"
                  style={styles.iconButton}>
                  <Image
                    source={require('./assets/undo.png')}
                    style={{
                      height: 24,
                      width: 24,
                      transform: [{ rotate: '180deg' }],
                    }}
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
                      {
                        backgroundColor: selectedColor,
                        borderColor: '#fff',
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    ]}>
                    <Image
                      source={require('./assets/edit_color.png')}
                      style={{ height: 14, width: 14 }}
                    />
                  </Ripple>
                  {COLORS.filter((c) => c !== selectedColor).map((c, i) => (
                    <Ripple
                      key={i}
                      onPress={onChangeSelectedColor(c)}
                      rippleCentered
                      rippleOpacity={0.12}
                      style={[
                        styles.colorButton,
                        { backgroundColor: c, borderColor: c, marginLeft: 8 },
                      ]}
                    />
                  ))}
                </RNAnimated.View>
              </View>
              <ScrollView
                contentContainerStyle={{
                  alignItems: 'center',
                  flexGrow: 1,
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
                scrollEnabled={false}
                style={{ flex: 1, backgroundColor: '#1F1F1F' }}>
                <View
                  ref={viewRef}
                  style={[styles.svgContainer]}
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

                <View
                  ref={exportRef}
                  style={styles.svgContainerHidden}
                  pointerEvents="none">
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
            </View>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.footerContainer}>
              <CommentInput
                comment={comment}
                toggleBottomNavigationView={toggleBottomNavigationView}
                loading={loading}
                handleCommentChange={handleCommentChange}
                onSubmit={onSubmit}
                error={error}
                theme={theme}
              />
              <BottomSheet
                visible={btmSheetVisible}
                onBackButtonPress={toggleBottomNavigationView}
                onBackdropPress={toggleBottomNavigationView}
                animationType="slide">
                <View style={styles.bottomSheetContainer}>
                  <View style={styles.bottomSheetIndicator}></View>
                  <TextInput
                    ref={issueTitleRef}
                    style={[
                      styles.bottomSheetTextInput,
                      error && { borderColor: 'red' },
                    ]}
                    keyboardType="name-phone-pad"
                    placeholder="Add issue title"
                    placeholderTextColor="#16064780"
                    value={comment}
                    onChangeText={handleCommentChange}
                  />
                  {error && (
                    <View style={{ width: '100%' }}>
                      <Text style={[styles.errorText]}>
                        Please enter a comment before submitting
                      </Text>
                    </View>
                  )}
                  <TextInput
                    style={[
                      styles.bottomSheetTextInput,
                      {
                        height: 154,
                        marginTop: 13,
                        textAlignVertical: 'top',
                        textAlign: 'justify',
                      },
                    ]}
                    keyboardType="name-phone-pad"
                    placeholder="Add issue description (optional)"
                    placeholderTextColor="#16064780"
                    multiline
                    numberOfLines={5}
                    value={description}
                    onChangeText={setDescription}
                  />
                  <TouchableOpacity
                    onPress={onSubmit}
                    disabled={loading}
                    style={[
                      styles.bottomSheetButtonContainer,
                      { backgroundColor: buttonColor },
                    ]}>
                    <Text style={styles.submitButtonText}>{buttonText}</Text>
                    {loading && <ActivityIndicator color="#fff" />}
                  </TouchableOpacity>
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
    zIndex: Z_INDEX,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'left',
    width: '100%',
  },
  buttonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 60,
    width: 60,
    // backgroundColor: COLORS[0],
    backgroundColor: 'white',
    borderRadius: 60 / 2,
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
    height: 34,
    width: '100%',
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 16,
    // borderWidth:1,
    // borderColor: '#E7E7E7',
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
    // flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  colorButton: {
    height: 34,
    width: 34,
    borderRadius: 34 / 2,
    borderWidth: 1,
  },
  svgContainer: {
    alignItems: 'center',
    height: height,
    width: width,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 16,
  },
  svgContainerHidden: {
    width,
    height,
    position: 'absolute',
    top: -9999,
    opacity: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    flexDirection: 'column',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#000',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: '#2C2C2C',
    paddingHorizontal: 10,
    height: 45,
    flex: 1,
  },
  singleTextInput: {
    flex: 1,
    color: '#E7E7E7',
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    lineHeight: 19.5,
    fontWeight: '500',
    overflow: 'hidden',
    textAlign: 'justify',
    borderRadius: 24,
    textAlignVertical: 'center',
  },
  rightIconContainer: {
    height: 40,
    width: 80,
    borderRadius: 27,
    backgroundColor: '#6552ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonStyle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.32,
  },
  rightIcon: {
    height: 24,
    width: 24,
  },
  iconImage: {
    width: 24,
    height: 24,
    marginLeft: 8,
    backgroundColor: 'transparent',
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
    // height: 45,
    borderColor: '#E7E7E7',
    borderWidth: 1,
    borderRadius: 5,
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 19.5,
    color: '#160647',
    textAlignVertical: 'center',
    paddingHorizontal: 13,
    paddingVertical: 16,
  },
  bottomSheetButtonContainer: {
    width: '100%',
    borderRadius: 8,
    height: 48,
    marginTop: 13,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '600',
    lineHeight: undefined,
    letterSpacing: -0.32,
  },
  commentContainer: {
    width: '100%',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
});

BugTracking.propTypes = {
  projectID: PropTypes.string.isRequired,
  token: PropTypes.string.isRequired,
};

export default BugTracking;
