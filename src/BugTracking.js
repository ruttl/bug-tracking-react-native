import PropTypes from 'prop-types';
import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated as RNAnimated,
  Dimensions,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { BottomSheet } from 'react-native-btr';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Ripple from 'react-native-material-ripple';
import Animated, {
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Path, Svg } from 'react-native-svg';
import Toast, { BaseToast } from 'react-native-toast-message';
import { captureRef, captureScreen } from 'react-native-view-shot';
import { launchImageLibrary } from 'react-native-image-picker';

const PADDING = 24;
const BUTTON_SIZE = 72;
const Z_INDEX = 99999999999999;
const COLORS = ['#160647', '#FF4F6D', '#FCFF52'];
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const ASPECT_RATIO = SCREEN_WIDTH / SCREEN_HEIGHT;
const START_POS = {
  x: SCREEN_WIDTH - BUTTON_SIZE - PADDING,
  y: SCREEN_HEIGHT - BUTTON_SIZE - PADDING,
};
const height = SCREEN_HEIGHT * 0.72;
const width = height * ASPECT_RATIO;

const ERROR_MESSAGE_TITLE = 'Failed to capture this snapshot!';
const ERROR_MESSAGE_DESCRIPTION = 'Please try again later.';

export const CommentInput = ({
  comment,
  toggleBottomNavigationView,
  loading,
  onSubmit,
  handleCommentChange,
  error,
  theme,
  disabled,
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
            style={[styles.singleTextInput, { color: theme?.text || '#000' }]}
            value={comment}
            onChangeText={handleCommentChange}
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
          disabled={loading || disabled}
          style={[
            styles.rightIconContainer,
            disabled && { backgroundColor: '#7B7B7B' },
          ]}
          onPress={onSubmit}>
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

const DraggableFab = ({
  onPress,
  onDragEnd,
  initialX,
  initialY,
  handleLongPress,
  throttleMs = 800,
}) => {
  const x = useSharedValue(initialX);
  const y = useSharedValue(initialY);

  const tapBlocked = useRef(false);
  const handlePress = () => {
    if (tapBlocked.current) return;
    tapBlocked.current = true;
    onPress?.();
    setTimeout(() => (tapBlocked.current = false), throttleMs);
  };

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
    <PanGestureHandler
      hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
      onGestureEvent={gesture}>
      <Animated.View
        style={[
          { position: 'absolute', pointerEvents: 'box-none', zIndex: Z_INDEX },
          fabStyle,
        ]}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.buttonContainer}
          onPress={handlePress}
          delayPressOut={300}
          onLongPress={handleLongPress}>
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
  const exportRef = useRef();
  const activePointerId = useRef(null);
  const isCapturing = useRef(false);
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
  const [showImageUpload, setShowImageUpload] = useState(false);
  const withAnim = useRef(new RNAnimated.Value(40)).current;
  const [lastTouch, setLastTouch] = useState([-1, -1]);
  const issueTitleRef = useRef(null);
  const [fabPos, setFabPos] = useState(START_POS);
  const scheme = useColorScheme();

  const toggleBottomNavigationView = () => {
    setbtmSheetVisible(!btmSheetVisible);
  };

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
    setExpanded(false);
    setError(false);
    setShowImageUpload(false);
    isCapturing.current = false;
  };

  const onScreenCapture = async () => {
    try {
      if (isCapturing.current) return;
      isCapturing.current = true;
      setWidgetVisible(false);
      setVisible(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      const uri = await captureScreen({
        handleGLSurfaceViewOnAndroid: true,
        quality: 1,
      });

      if (uri) {
        setSrc(uri);
        setShowImageUpload(false);
      } else {
        setShowImageUpload(true);
      }
    } catch (e) {
      setShowImageUpload(true);
    } finally {
      isCapturing.current = false;
    }
  };

  const openImagePicker = () => {
    if (typeof launchImageLibrary !== 'function') {
      console.error(
        'launchImageLibrary is not available. Check if the module is linked correctly.',
      );
      return;
    }

    launchImageLibrary(
      {
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 1,
      },
      (response) => {
        if (response.didCancel) {
          console.log('User cancelled image picker');
        } else if (response.errorCode) {
          console.error('ImagePicker Error:', response.errorMessage);
        } else {
          const asset = response.assets?.[0];
          if (asset?.uri) {
            setSrc(asset.uri);
            setShowImageUpload(false);
          } else {
            console.warn('No image URI returned');
          }
        }
      },
    );
  };

  // const onSubmit = async () => {
  //   try {
  //     if (!comment.trim()) {
  //       setError(true);
  //       return;
  //     }

  //     setLoading(true);
  //     if (!exportRef.current) {
  //       Toast.show({
  //         type: 'error',
  //         text1: ERROR_MESSAGE_TITLE,
  //         text2: ERROR_MESSAGE_DESCRIPTION,
  //       });
  //       return;
  //     }

  //     const uri = await captureRef(exportRef, {
  //       result: 'data-uri',
  //       quality: 1,
  //       height: SCREEN_HEIGHT,
  //       width: SCREEN_WIDTH,
  //     });

  //     const apiClient = axios.create({
  //       // baseURL: `https://us-central1-ruttlp.cloudfunctions.net/mobile/projects/${projectID}`,
  //       baseURL: `https://us-central1-rally-brucira.cloudfunctions.net/mobile/projects/${projectID}`,
  //       headers: { 'x-plugin-code': token },
  //     });

  //     const saveData = {
  //       comment,
  //       description: btmSheetVisible ? description : null,
  //       // appVersion: '1.0.0',
  //       // device: 'iPhone',
  //       height: SCREEN_HEIGHT,
  //       width: SCREEN_WIDTH,
  //       osName: Platform.OS,
  //     };

  //     const {
  //       data: { id: ticketID },
  //     } = await apiClient.post('/tickets', saveData);

  //     await apiClient
  //       .post(`/tickets/${ticketID}/screenshot`, { image: uri })
  //       .then(() =>
  //         Toast.show({
  //           position: 'top',
  //           type: 'success',
  //           text1: 'New ticket added successfully.',
  //         }),
  //       )
  //       .catch(e => console.log('Error is' + e));

  //     onReset();
  //   } catch (e) {
  //     console.log('Error in request ' + e);
  //     onReset();

  //     Toast.show({
  //       position: 'top',
  //       type: 'error',
  //       text1: 'Something went wrong',
  //       text2: e?.message,
  //     });
  //   } finally {
  //     setLoading(false);
  //   }
  // };

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
          text1: ERROR_MESSAGE_TITLE,
          text2: ERROR_MESSAGE_DESCRIPTION,
        });
        return;
      }

      const uri = await captureRef(exportRef, {
        result: 'data-uri',
        quality: 1,
        height: SCREEN_HEIGHT,
        width: SCREEN_WIDTH,
      });

      const baseURL = `https://us-central1-rally-brucira.cloudfunctions.net/mobile/projects/${projectID}`;
      // baseURL: `https://us-central1-ruttlp.cloudfunctions.net/mobile/projects/${projectID}`,
      const headers = {
        'Content-Type': 'application/json',
        'x-plugin-code': token,
      };

      const saveData = {
        comment,
        description: btmSheetVisible ? description : null,
        // appVersion: '1.0.0',
        // device: 'iPhone',
        height: SCREEN_HEIGHT,
        width: SCREEN_WIDTH,
        osName: Platform.OS,
      };

      const ticketResponse = await fetch(`${baseURL}/tickets`, {
        method: 'POST',
        headers,
        body: JSON.stringify(saveData),
      });

      if (!ticketResponse.ok) {
        throw new Error('Failed to create ticket');
      }

      const ticketJson = await ticketResponse.json();
      const ticketID = ticketJson?.id;

      const screenshotResponse = await fetch(
        `${baseURL}/tickets/${ticketID}/screenshot`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ image: uri }),
        },
      );

      if (!screenshotResponse.ok) {
        throw new Error('Failed to upload screenshot');
      }

      Toast.show({
        position: 'top',
        type: 'success',
        text1: 'New ticket added successfully.',
      });

      onReset();
    } catch (e) {
      console.log('Error in request', e);
      onReset();

      Toast.show({
        position: 'top',
        type: 'error',
        text1: 'Something went wrong',
        text2: e?.message || 'Unknown error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const onTouchStart = (event) => {
    if (event.nativeEvent.touches?.length !== 1) {
      return;
    }
    activePointerId.current = event.nativeEvent.identifier;
    setLastTouch([event.nativeEvent.locationX, event.nativeEvent.locationY]);
    setTouch(true);
  };

  const onTouchMove = (event) => {
    if (isTouch && event.nativeEvent.touches?.length === 1) {
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
    activePointerId.current = null;
    if (currentPath.length > 0) {
      const currentPaths = [...paths];
      const newPath = [...currentPath];
      currentPaths.push({ color: selectedColor, data: newPath });
      setPaths((prev) => [
        ...prev,
        { color: selectedColor, data: [...currentPath] },
      ]);
    }
    setCurrentPath([]);
    setTouch(false);
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

  const buttonText = useMemo(
    () => (loading ? 'Submitting...' : 'Submit'),
    [loading],
  );

  const buttonColor = useMemo(
    () => (comment?.trim() !== '' ? '#6552FF' : '#6552FF80'),
    [comment],
  );

  const theme = useMemo(() => {
    return {
      background: scheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
      text: scheme === 'dark' ? '#FFFFFF' : '#000000',
      placeholder: scheme === 'dark' ? '#FFFFFF66' : '#00000066',
    };
  }, [scheme]);

  const onLongPressHandler = async () => {
    setWidgetVisible(false);
    setVisible(true);
    setSrc('');
    await new Promise((resolve) => setTimeout(resolve, 200));
    setShowImageUpload(true);
    openImagePicker();
  };

  const randerSVG = () => {
    if (!src) return null;
    return (
      <ImageBackground ref={viewRef} resizeMode="contain" source={{ uri: src }}>
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
                fill={'transparent'}
                stroke={color}
                strokeLinecap={'round'}
                strokeLinejoin={'round'}
                strokeWidth={4}
              />
            ))}
        </Svg>
      </ImageBackground>
    );
  };

  return (
    <View style={{ zIndex: 999 }}>
      <Fragment>
        {widgetVisible && !src ? (
          <DraggableFab
            initialX={fabPos.x}
            initialY={fabPos.y}
            throttleMs={1000}
            onDragEnd={setFabPos}
            handleLongPress={onLongPressHandler}
            onPress={onScreenCapture}
          />
        ) : (
          <StatusBar backgroundColor={'#000'}></StatusBar>
        )}

        <Modal animationType="slide" transparent={false} visible={visible}>
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
                  rippleCentered
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
                  ]}
                  rippleColor="rgb(255, 251, 254)"
                  onPress={onReset}>
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
                {src && (
                  <>
                    <Ripple
                      rippleCentered
                      rippleColor="rgb(255, 251, 254)"
                      style={styles.iconButton}
                      onPress={onUndo}>
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
                        rippleCentered
                        style={[
                          styles.colorButton,
                          {
                            backgroundColor: selectedColor,
                            borderColor: '#fff',
                            alignItems: 'center',
                            justifyContent: 'center',
                          },
                        ]}
                        rippleOpacity={0.12}
                        onPress={toggleOpen}>
                        <Image
                          source={require('./assets/edit_color.png')}
                          style={{ height: 14, width: 14 }}
                        />
                      </Ripple>
                      {COLORS.filter((c) => c !== selectedColor).map((c, i) => (
                        <Ripple
                          key={i}
                          rippleCentered
                          style={[
                            styles.colorButton,
                            {
                              backgroundColor: c,
                              borderColor: c,
                              marginLeft: 8,
                            },
                          ]}
                          rippleOpacity={0.12}
                          onPress={onChangeSelectedColor(c)}
                        />
                      ))}
                    </RNAnimated.View>
                  </>
                )}
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
                {src || showImageUpload ? (
                  <>
                    {src && (
                      <>
                        <View
                          ref={viewRef}
                          style={[styles.svgContainer]}
                          onTouchEnd={onTouchEnd}
                          onTouchMove={onTouchMove}
                          onTouchStart={onTouchStart}>
                          {randerSVG()}
                        </View>

                        <View
                          ref={exportRef}
                          pointerEvents="none"
                          style={styles.svgContainerHidden}>
                          {randerSVG()}
                        </View>
                      </>
                    )}
                    {showImageUpload && (
                      <View style={styles.imagePickerContainer}>
                        <View style={styles.uploadButtonContainer}>
                          <Image
                            source={require('./assets/empty_image.png')}
                            style={{ height: 70, width: 102 }}
                          />
                          <Text style={styles.uploadErrorMessage}>
                            Failed to capture screenshot.
                          </Text>
                          <TouchableOpacity
                            style={styles.uploadButton}
                            onPress={openImagePicker}>
                            <Image
                              source={require('./assets/plus.png')}
                              style={{ height: 24, width: 24 }}
                            />
                            <Text style={styles.uploadButtonText}>
                              Upload image
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.bottomMessage}>
                          Sometimes, the screenshot capturing is blocked due to
                          native modules. Hence, please upload your screenshot
                          manually.
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <ActivityIndicator style={{ alignSelf: 'center' }} />
                )}
              </ScrollView>
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.footerContainer}>
              <CommentInput
                comment={comment}
                error={error}
                handleCommentChange={handleCommentChange}
                loading={loading}
                theme={theme}
                toggleBottomNavigationView={toggleBottomNavigationView}
                onSubmit={onSubmit}
                disabled={!src}
              />
              <BottomSheet
                animationType="slide"
                visible={btmSheetVisible}
                onBackButtonPress={toggleBottomNavigationView}
                onBackdropPress={toggleBottomNavigationView}>
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
                    multiline
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
                    numberOfLines={5}
                    placeholder="Add issue description (optional)"
                    placeholderTextColor="#16064780"
                    value={description}
                    onChangeText={setDescription}
                  />
                  <TouchableOpacity
                    style={[
                      styles.bottomSheetButtonContainer,
                      { backgroundColor: buttonColor },
                      !src && { backgroundColor: '#7B7B7B' },
                    ]}
                    disabled={loading || !src}
                    onPress={onSubmit}>
                    <Text style={styles.submitButtonText}>{buttonText}</Text>
                    {loading && <ActivityIndicator color="#fff" />}
                  </TouchableOpacity>
                </View>
              </BottomSheet>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
        <Toast config={{ info: (props) => <BaseToast {...props} /> }} />
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
    minHeight: 80,
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
  imagePickerContainer: {
    alignItems: 'center',
    height: height,
    width: width,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF3C',
    borderRadius: 16,
  },
  uploadButtonContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadErrorMessage: {
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadButtonText: {
    color: '#000',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '600',
    lineHeight: undefined,
    letterSpacing: -0.32,
    textAlign: 'center',
  },
  bottomMessage: {
    color: '#FFFFFFB2',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 12,
    letterSpacing: -0.24,
    textAlign: 'center',
    padding: 12,
    paddingHorizontal: 24,
  },
});

BugTracking.propTypes = {
  projectID: PropTypes.string.isRequired,
  token: PropTypes.string.isRequired,
};

export default BugTracking;
