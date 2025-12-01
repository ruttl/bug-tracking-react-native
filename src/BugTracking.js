import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Constants from "expo-constants";
import PropTypes from "prop-types";
import {
  ActivityIndicator,
  Animated as RNAnimated,
  Dimensions,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
  Keyboard,
  PermissionsAndroid,
  Linking,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { launchImageLibrary } from "react-native-image-picker";
import Ripple from "react-native-material-ripple";
import DeviceInfo from "react-native-device-info";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Path, Svg } from "react-native-svg";
import { captureRef, captureScreen } from "react-native-view-shot";
import { MyModuleJS } from "./index";
import { useVideoPlayer, VideoView } from "expo-video";
import { SafeAreaView } from "react-native-safe-area-context";
import ToastManager, { Toast } from "toastify-react-native";
import LottieView from "lottie-react-native";
import { Video } from "react-native-compressor";
import * as FileSystem from "expo-file-system/legacy";
import LinearGradient from 'react-native-linear-gradient';
import { Calendar } from 'react-native-calendars';
import { useAudioPlayer } from 'expo-audio';

const toastConfig = {
  success: (props) => <ToastStyle {...props} />,
  info: (props) => <ToastStyle {...props} />,
  error: (props) => <ToastStyle {...props} error={true} />,
};

const PADDING = 24;
const BUTTON_SIZE = 72;
const Z_INDEX = 99999999999999;
const COLORS = ["#160647", "#FF4F6D", "#FCFF52"];
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const ASPECT_RATIO = SCREEN_WIDTH / SCREEN_HEIGHT;
const START_POS = {
  x: SCREEN_WIDTH - BUTTON_SIZE - PADDING,
  y: SCREEN_HEIGHT - BUTTON_SIZE - PADDING,
};
const height = SCREEN_HEIGHT * 0.72;
const width = height * ASPECT_RATIO;
const ERROR_MESSAGE_TITLE = "Failed to capture this snapshot! Please retry";
const MAX_MB = 10 * 1024 * 1024;

let BUILD_NUMBER = "1";
const NGROK = `https://3c89-2401-4900-8817-1fea-e454-c83e-45c8-4a00.ngrok-free.app/ruttlp/us-central1`;
const PREVIEW_URL = `https://preview.ruttl.com/api/mobile`;
const PRODUCTION_URL = `https://us-central1-ruttlp.cloudfunctions.net/mobile/projects`;
const BASE_URL = true ? PREVIEW_URL : PRODUCTION_URL;

const ToastStyle = ({ text1, text2, ...props }) => {
  return (
    <View style={[styles.toastContainer, props.error && styles.errorToastStyle]}>
      <Text style={styles.toastText1}>{text1}</Text>
      {text2 && <Text style={styles.toastText2}>{text2}</Text>}
    </View>
  );
};

const OptionButton = ({ onPress, title }) => {
  return (
    <TouchableOpacity style={styles.uploadButton} onPress={onPress}>
      <Image
        source={require("./assets/plus.png")}
        style={styles.uploadIcon}
      />
      <Text style={styles.uploadText}>{title}</Text>
    </TouchableOpacity>
  );
};

const DraggableFab = ({
  onScreenCapture,
  onDragEnd,
  initialX,
  initialY,
  isRecording,
  startRecording,
  stopRecording,
  videoLoading
}) => {
  const x = useSharedValue(initialX);
  const y = useSharedValue(initialY);
  const [showOption, setShowOption] = useState(false);

  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);

  const handlePress = () => {
    if (isRecording) {
      stopRecording?.();
    } else {
      setShowOption((prev) => !prev);
    }
  };

  const startRecordingHandler = async () => {
    setShowOption(false);
    if (!isRecording) {
      await startRecording();
    } else {
      await stopRecording?.();
    }
  };

  const captureScreenshotHandler = () => {
    setShowOption(false);
    onScreenCapture?.();
  };

  const dragGesture = Gesture.Pan()
    .onStart(() => {
      offsetX.value = x.value;
      offsetY.value = y.value;
    })
    .onUpdate((event) => {
      const newX = offsetX.value + event.translationX;
      const newY = offsetY.value + event.translationY;

      x.value = Math.max(
        PADDING,
        Math.min(newX, SCREEN_WIDTH - BUTTON_SIZE - PADDING)
      );
      y.value = Math.max(
        PADDING,
        Math.min(newY, SCREEN_HEIGHT - BUTTON_SIZE - PADDING)
      );
    })
    .onEnd(() => {
      const snapX =
        x.value < SCREEN_WIDTH / 2
          ? PADDING
          : SCREEN_WIDTH - BUTTON_SIZE - PADDING;
      const snapY =
        y.value < SCREEN_HEIGHT / 2
          ? PADDING
          : SCREEN_HEIGHT - BUTTON_SIZE - PADDING;

      x.value = withTiming(snapX);
      y.value = withTiming(snapY);

      if (onDragEnd) {
        runOnJS(onDragEnd)({ x: snapX, y: snapY });
      }
    });

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  const directionStyle = useAnimatedStyle(() => {
    const isLeft = x.value < SCREEN_WIDTH / 2;

    return {
      flexDirection: isLeft ? "row" : "row-reverse",
      alignItems: "center",
    };
  }, [showOption]);

  const uploadButtonStyle = useAnimatedStyle(() => {
    const isTop = y.value < SCREEN_HEIGHT / 2;

    return {
      position: "absolute",
      top: isTop ? BUTTON_SIZE : -BUTTON_SIZE - 46,
      flexDirection: isTop ? "column" : "column-reverse",
      rowGap: 10,
    };
  }, [showOption]);

  useEffect(() => {
    Image.resolveAssetSource(require("./assets/plus.png"));
  }, []);

  return (
    <>
      {showOption && (
        <TouchableWithoutFeedback onPress={() => setShowOption(false)}>
          <View
            style={styles.backdrop}
          />
        </TouchableWithoutFeedback>
      )}

      <GestureDetector gesture={dragGesture}>
        <Animated.View
          style={[
            {
              position: "absolute",
              pointerEvents: "box-none",
              zIndex: Z_INDEX,
            },
            fabStyle,
          ]}
        >
          <Animated.View style={directionStyle}>
            {showOption && (
              <Animated.View style={uploadButtonStyle}>
                <OptionButton
                  onPress={startRecordingHandler}
                  title={isRecording ? "Stop Recording" : "Start Recording"}
                />
                <OptionButton
                  onPress={captureScreenshotHandler}
                  title={"Capture Screenshot"}
                />
              </Animated.View>
            )}

            <TouchableOpacity
              activeOpacity={0.7}
              delayPressOut={300}
              style={styles.buttonContainer}
              onLongPress={() => { }}
              onPress={handlePress}
            >
              {videoLoading ? (
                <ActivityIndicator size="small" color={"#000"} />
              )
                : isRecording ? (
                  <LottieView
                    source={require("./assets/live-pulse-animation.json")}
                    autoPlay
                    loop
                    style={styles.lottie}
                  />
                ) : (
                  <Image
                    source={require("./assets/ruttl.png")}
                    style={styles.ruttlIcon}
                  />
                )}
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </>
  );
};

const ActionButton = ({ icon, text, onPress = () => { }, iconBgColor = '#f4f4f4', showNameImage = false, startIcon, style }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.3}
      style={[styles.actionButton, style]}
      onPress={onPress}
    >
      <LinearGradient
        colors={[
          'rgba(255,255,255,0)',
          'rgba(153,153,153,0.20)',
        ]}
        start={{ x: -0.37, y: 0 }}
        end={{ x: 0.99, y: 0 }}
        style={styles.actionButtonGradient}
      >
        {startIcon ? startIcon : iconBgColor ? <View style={[styles.actionButtonIconBg, { backgroundColor: iconBgColor }]}></View> : <Image source={icon} style={styles.actionButtonIcon} />}
        <Text
          style={[styles.actionButtonText]}
          numberOfLines={1}
        >
          {text}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const BottomPopupModal = ({ visible, onClose, children }) => {
  const progress = useSharedValue(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [layoutReady, setLayoutReady] = useState(false);

  useEffect(() => {
    if (layoutReady) {
      progress.value = withTiming(visible ? 1 : 0, { duration: 250 });
    }
  }, [visible, layoutReady]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.5]),
    pointerEvents: visible ? "auto" : "none",
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [contentHeight, 0]
        ),
      },
    ],
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();   // also dismiss when tapping outside
          onClose();
        }}
      >
        <Animated.View style={[styles.backdropSheet, backdropStyle]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sheet, sheetStyle]}
        onLayout={(e) => {
          if (!layoutReady) {
            setContentHeight(e.nativeEvent.layout.height);
            setLayoutReady(true);
          }
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const GradientCircle = ({ text = '', size, style }) => {

  return (
    <LinearGradient
      colors={['#E2F0F8', '#FFEBF2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.gradientCircle, { width: size, height: size }, style]}
    >
      <Text style={styles.gradientCircleText}>{text}</Text>
    </LinearGradient>
  );
};

const CheckBox = ({ selected = false, toggleCheckBox }) => {
  return (
    <TouchableOpacity onPress={toggleCheckBox} style={[styles.checkBox, { backgroundColor: selected ? "#45386C" : "transparent" }]}>
      {selected && (
        <Image
          source={require('./assets/check-icon.png')}
          style={styles.checkBoxImage}
        />
      )}
    </TouchableOpacity>
  );
};

const AssigneeRow = ({ name, initial, selected, onToggle, image }) => {
  return (
    <View
      style={styles.assigneeRow}
    >
      {image ? <Image source={{ uri: image }} style={{ height: 33, width: 33, borderRadius: 17 }} /> : <GradientCircle text={initial} />}
      <Text style={styles.assigneeName}>{name}</Text>
      <CheckBox selected={selected} toggleCheckBox={onToggle} />
    </View>
  );
};

const AssigneeModal = ({ isOpen, closeHandler, selectedAssignees = [], onChangeAssignees, users }) => {
  const [searchText, setSearchText] = useState("");

  const filteredAssignees = useMemo(() => {
    return users?.filter((item) =>
      item.displayName.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [searchText]);

  const toggleCheckBox = (item) => {
    if (!onChangeAssignees) return;
    const updated = [...selectedAssignees];
    const index = updated.findIndex(a => a.uid === item.uid); // use uid
    if (index > -1) {
      updated.splice(index, 1);
    } else {
      updated.push(item);
    }
    onChangeAssignees(updated);
  };

  return (
    <BottomPopupModal visible={isOpen} onClose={closeHandler}>
      <View style={styles.modalContentContainer}>

        <View style={styles.dragHandle} />

        <Text style={styles.modalTitle}>Assignee</Text>

        <View style={styles.searchField}>
          <TextInput
            placeholder="Search assignee"
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
          />
          <Image
            source={require("./assets/search.png")}
            style={styles.searchIcon}
          />
        </View>

        <View style={styles.assigneeListContainer}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.assigneeListContent}
            keyboardShouldPersistTaps="handled"
          >
            {filteredAssignees?.length > 0 ? (
              filteredAssignees?.map((item) => {
                const isSelected = selectedAssignees.some(a => a.uid === item.uid);
                return (
                  <AssigneeRow
                    key={item.uid}
                    name={item.displayName}
                    initial={item.initial}
                    selected={isSelected}
                    onToggle={() => toggleCheckBox(item)}
                    image={item.photoURL}
                  />
                );
              })
            ) : (
              <Text
                style={styles.noAssigneeText}
              >
                No assignee found
              </Text>
            )}
          </ScrollView>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={closeHandler}
        >
          <Text
            style={styles.continueButtonText}
          >
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </BottomPopupModal>
  );
};

const DueDateModal = ({ isOpen, closeHandler, onDateSelect }) => {
  const [selectedDate, setSelectedDate] = useState(null);

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

  const handleContinue = () => {
    if (onDateSelect) onDateSelect(selectedDate);
    closeHandler();
  };

  return (
    <BottomPopupModal visible={isOpen} onClose={closeHandler}>
      <View style={styles.modalContentContainer}>
        <View style={styles.dragHandle} />

        <Calendar
          onDayPress={handleDayPress}
          markedDates={{
            [selectedDate]: { selected: true, selectedColor: '#6552FF' },
          }}
          theme={{
            backgroundColor: '#1F1F1F',
            calendarBackground: '#1F1F1F',
            textSectionTitleColor: '#FFF',
            dayTextColor: '#FFF',
            todayTextColor: '#6552FF',
            selectedDayTextColor: '#FFF',
            monthTextColor: '#FFF',
            arrowColor: '#FFF',
            textDayFontFamily: 'Inter',
            textDayHeaderFontFamily: 'Inter',
            textMonthFontFamily: 'Inter',
          }}
          style={styles.calendarStyle}
        />

        <TouchableOpacity
          style={[styles.continueButton, styles.continueButtonMargin]}
          onPress={handleContinue}
        >
          <Text
            style={styles.continueButtonText}
          >
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </BottomPopupModal>
  );
};

const PriorityModal = ({ isOpen, closeHandler, onPrioritySelect }) => {
  const [selectedPriority, setSelectedPriority] = useState(null);

  const priorities = [
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
    { id: 'low', label: 'Low' },
  ];

  const togglePriority = (id) => {
    setSelectedPriority(id);
    onPrioritySelect(id);
  };

  return (
    <BottomPopupModal visible={isOpen} onClose={closeHandler}>
      <View style={styles.modalContentContainer}>

        <View style={styles.dragHandle} />
        <Text style={styles.modalTitle}>Priority</Text>

        <View style={styles.assigneeListContainer}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.assigneeListContent}
            keyboardShouldPersistTaps="handled"
          >
            {priorities.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => togglePriority(item.id)}
                style={[styles.priorityItem, { borderColor: selectedPriority === item.id ? "#6552FF" : "rgba(234, 234, 234, 0.2)" }]}
              >
                <Text
                  style={styles.priorityItemText}
                >
                  {item.label}
                </Text>
                {selectedPriority === item.id && (
                  <Image
                    source={require('./assets/check-icon.png')}
                    style={styles.checkIcon}
                  />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={closeHandler}
        >
          <Text
            style={styles.continueButtonText}
          >
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </BottomPopupModal>
  );
};

const AudioPermissionModal = ({ isOpen, closeHandler, onOpenSettings, onContinueWithoutAudio }) => {
  return (
    <Modal
      transparent
      visible={isOpen}
      animationType="fade"
      onRequestClose={closeHandler}
      onDismiss={closeHandler}
    >
      <View style={styles.centeredModalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Audio Permission Required</Text>

          <Text style={[styles.modalText, { marginBottom: 24, color: '#FFF', opacity: 0.8, textAlign: 'center' }]}>
            To record with audio, please enable microphone access in settings.
          </Text>

          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: '#6552FF', marginBottom: 12, width: '100%' }]}
            onPress={onOpenSettings}
          >
            <Text style={styles.continueButtonText}>Open Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', width: '100%' }]}
            onPress={onContinueWithoutAudio}
          >
            <Text style={styles.continueButtonText}>Record without Audio</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const InputScreen = ({
  comment,
  handleCommentChange,
  description,
  setDescription,
  issueTitleRef,
  error,
  closeSheet,
  projectDetails,
  selectedAssignees,
  setSelectedAssignees,
  selectedDueDate,
  setSelectedDueDate,
  selectedPriority,
  setSelectedPriority,
  disabled, buttonColor, onSubmit, loading
}) => {
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const descriptionRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!comment) {
        issueTitleRef.current?.focus();
      } else if (!description) {
        descriptionRef.current?.focus();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const openAssigneeModal = () => {
    Keyboard.dismiss();
    setShowAssigneeModal(true)
  }

  const openDueDateModal = () => {
    Keyboard.dismiss();
    setShowDueDateModal(true)
  }

  const openPriorityModal = () => {
    Keyboard.dismiss();
    setShowPriorityModal(true)
  }

  const handleAssigneeClose = () => setShowAssigneeModal(false);
  const handleDueDateClose = () => setShowDueDateModal(false);
  const handlePriorityClose = () => setShowPriorityModal(false);

  const handleDueDateSelect = (date) => {
    const [year, month, day] = date.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatted = `${day} ${months[parseInt(month) - 1]}, ${year}`;
    setSelectedDueDate(formatted);
    setShowDueDateModal(false);
  }

  const handlePrioritySelect = (priority) => {
    setSelectedPriority(priority);
  }

  const handleAssigneesChange = (updated) => {
    setSelectedAssignees(updated || []);
  };

  const dueDateDisplay = useMemo(() => {
    if (!selectedDueDate) return "Due date";

    const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const [day, monthStr, year] = selectedDueDate.replace(',', '').split(' ');
    const due = new Date(year, months[monthStr], day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (due < today) return "Overdue";
    if (due.getTime() === today.getTime()) return "Due Today";
    return selectedDueDate;
  }, [selectedDueDate]);

  const assigneeButtonTitle = useMemo(() => {
    if (!selectedAssignees || selectedAssignees.length === 0) return "Assignee";
    return selectedAssignees.map((u) => u.displayName).join(", ");
  }, [selectedAssignees]);

  const priorityButtonColor = useMemo(() => {
    if (!selectedPriority) return null;
    return selectedPriority === "low" ? "#F8C104" : selectedPriority === "medium" ? "#F98521" : "#FD4C41";
  }, [selectedPriority]);

  return (
    <>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          <View style={styles.bottomSheetContainer}>
            <View style={styles.inputScreenHeader}>
              <TouchableOpacity onPress={closeSheet}>
                <Image source={require('./assets/back.png')} style={styles.backIcon} resizeMode="cover"></Image>
              </TouchableOpacity>
              <TouchableOpacity onPress={onSubmit} style={{
                opacity: 1,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: 100,
                backgroundColor: buttonColor,
              }}
                disabled={disabled || loading}
              >
                {loading ? <ActivityIndicator color="#FFF" style={[styles.activityIndicator, {
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                }]} /> : <Text style={{
                  borderRadius: 100,
                  color: '#FFF',
                  textAlign: 'center',
                  fontFamily: 'Inter',
                  fontSize: 16,
                  fontWeight: '500',
                  lineHeight: 20.8,
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                }}>Submit</Text>}
              </TouchableOpacity>
            </View>

            <TextInput
              ref={issueTitleRef}
              multiline
              style={[
                styles.textInput1,
                styles.inputScreenTitle,
                error && { borderColor: "red" }
              ]}
              placeholder="Enter Ticket Title"
              placeholderTextColor="#FFFFFF4D"
              value={comment}
              onChangeText={handleCommentChange}
            />
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  Please enter a comment before submitting
                </Text>
              </View>
            )}

            <TextInput
              ref={descriptionRef}
              multiline
              numberOfLines={10}
              style={[
                styles.bottomSheetTextInput,
                styles.inputScreenDescription,
              ]}
              keyboardType="name-phone-pad"
              placeholder="Add issue description (optional)"
              placeholderTextColor="#FFFFFF4D"
              value={description}
              onChangeText={setDescription}
              id="comment-description-input"
            />
          </View>

          <View style={styles.bottomActionBar}>
            <ActionButton
              icon={require("./assets/priority.png")}
              iconBgColor={priorityButtonColor}
              text={selectedPriority || "Priority"}
              onPress={openPriorityModal}
            />
            <ActionButton
              icon={require("./assets/date.png")}
              text={dueDateDisplay}
              iconBgColor={null}
              onPress={openDueDateModal}
            />
            <ActionButton
              icon={require("./assets/assignee.png")}
              text={assigneeButtonTitle || "Assignee"}
              iconBgColor={null}
              onPress={openAssigneeModal}
              showNameImage={true}
              style={{ flex: 0, width: "auto" }}
              startIcon={
                selectedAssignees?.length > 0 ? (
                  <View style={{ flexDirection: "row" }}>
                    {selectedAssignees.slice(0, 2).map((u, i) => (
                      <GradientCircle
                        key={i}
                        text={u.displayName?.charAt(0).toUpperCase()}
                        size={20}
                        style={{
                          marginLeft: i > 0 ? -8 : 0,
                          zIndex: i
                        }}
                      />
                    ))}
                  </View>
                ) : null
              }
            />
          </View>
        </View>
      </TouchableWithoutFeedback>

      <AssigneeModal
        isOpen={showAssigneeModal}
        closeHandler={handleAssigneeClose}
        selectedAssignees={selectedAssignees}
        onChangeAssignees={handleAssigneesChange}
        users={projectDetails?.users}
      />

      <DueDateModal
        isOpen={showDueDateModal}
        closeHandler={handleDueDateClose}
        onDateSelect={handleDueDateSelect}
      />

      <PriorityModal
        isOpen={showPriorityModal}
        closeHandler={handlePriorityClose}
        onPrioritySelect={handlePrioritySelect}
      />
    </>
  )
}

const PreviewScreen = ({ loading, src, videoUri, showImageUpload, onReset, setPaths, setExpanded, paths, withAnim, currentPath, exportRef, setCurrentPath, expanded, openImagePicker, player }) => {
  const viewRef = useRef();
  const activePointerId = useRef(null);
  const [selectedColor, setSelectedColor] = useState(COLORS[1]);
  const [lastTouch, setLastTouch] = useState([-1, -1]);
  const [isTouch, setTouch] = useState(false);

  useEffect(() => {
    if (videoUri && player) {
      setTimeout(() => {
        player.replace(videoUri);
        player.loop = false;
        player.play();
      }, 100);
    }
  }, [videoUri, player]);

  const pageLoaded = useMemo(() => {
    return src || showImageUpload || videoUri ? true : false;
  }, [src, showImageUpload, videoUri]);

  const onUndo = () => setPaths((state) => state.slice(0, -1));

  const toggleOpen = () => setExpanded((state) => !state)

  const renderSVG = () => {
    if (!src) return null;
    return (
      <ImageBackground ref={viewRef} resizeMode="contain" source={{ uri: src }}>
        <Svg height={height} width={width}>
          <Path
            d={currentPath.join("")}
            fill={"transparent"}
            stroke={selectedColor}
            strokeLinecap={"round"}
            strokeLinejoin={"round"}
            strokeWidth={4}
          />
          {paths.length > 0 &&
            paths.map(({ color, data }, index) => (
              <Path
                key={`path-${index}`}
                d={data.join("")}
                fill={"transparent"}
                stroke={color}
                strokeLinecap={"round"}
                strokeLinejoin={"round"}
                strokeWidth={4}
              />
            ))}
        </Svg>
      </ImageBackground>
    );
  };

  const onTouchMove = (event) => {
    if (isTouch && event.nativeEvent.touches?.length === 1) {
      const newPath = [...currentPath];
      const { locationX, locationY } = event.nativeEvent;
      const newPoint = `${newPath.length === 0 ? "M" : ""}${locationX.toFixed(
        0
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

  const onChangeSelectedColor = (color) => () => {
    setExpanded(false);
    setTimeout(() => {
      setSelectedColor(color);
    }, 500);
  };

  const onTouchStart = (event) => {
    if (event.nativeEvent.touches?.length !== 1) {
      return;
    }
    activePointerId.current = event.nativeEvent.identifier;
    setLastTouch([event.nativeEvent.locationX, event.nativeEvent.locationY]);
    setTouch(true);
  };

  useEffect(() => {
    RNAnimated.timing(withAnim, {
      toValue: 40 * (expanded ? 3 : 1),
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [expanded, withAnim]);

  return (
    <View style={styles.modalInnerContainer}>
      <View style={styles.appbarContainer}>
        <Ripple
          rippleCentered
          style={styles.previewCloseButton}
          disabled={loading}
          rippleColor="rgb(255, 251, 254)"
          onPress={pageLoaded ? onReset : () => { }}
          id={"close-button"}
        >
          <Image
            style={styles.previewCloseIcon}
            source={require("./assets/close.png")}
          />
        </Ripple>
        {src && (
          <View style={styles.previewUndoContainer}>
            <Ripple
              rippleCentered
              disabled={loading}
              rippleColor="rgb(255, 251, 254)"
              style={styles.iconButton}
              onPress={onUndo}
              id={"undo-button"}
            >
              <Image
                style={styles.undoIcon}
                source={require("./assets/undo.png")}
              />
            </Ripple>
            <RNAnimated.View
              style={[styles.colorsContainer, { width: withAnim }]}
            >
              <Ripple
                rippleCentered
                style={[
                  styles.colorButton,
                  styles.colorPickerButton,
                  {
                    backgroundColor: selectedColor,
                  },
                ]}
                disabled={loading}
                rippleOpacity={0.12}
                onPress={toggleOpen}
                id={"selected-color-picker-button"}
              >
                <Image
                  source={require("./assets/edit_color.png")}
                  style={styles.editColorIcon}
                />
              </Ripple>
              {COLORS?.filter((c) => c !== selectedColor).map((c, i) => (
                <Ripple
                  key={i}
                  rippleCentered
                  style={[
                    styles.colorButton,
                    styles.colorOption,
                    { backgroundColor: c, borderColor: c },
                  ]}
                  disabled={loading}
                  rippleOpacity={0.12}
                  onPress={onChangeSelectedColor(c)}
                  id={`color-picker-button-${i + 1}`}
                />
              ))}
            </RNAnimated.View>
          </View>
        )}
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        scrollEnabled={false}
        style={styles.scrollView}
      >
        {videoUri ? (
          <VideoView
            key={videoUri}
            style={styles.videoView}
            player={player}
            nativeControls={true}
          />
        ) : src || showImageUpload ? (
          <>
            {src && (
              <>
                <View
                  ref={viewRef}
                  style={[styles.svgContainer]}
                  onTouchEnd={onTouchEnd}
                  onTouchMove={onTouchMove}
                  onTouchStart={onTouchStart}
                >
                  {renderSVG()}
                </View>

                <View
                  ref={exportRef}
                  pointerEvents="none"
                  style={styles.svgContainerHidden}
                >
                  {renderSVG()}
                </View>
              </>
            )}
            {showImageUpload && (
              <View style={styles.imagePickerContainer}>
                <View style={styles.uploadButtonContainer}>
                  <Image
                    source={require("./assets/empty_image.png")}
                    style={styles.emptyImage}
                  />
                  <Text style={styles.uploadErrorMessage}>
                    Failed to capture screenshot.
                  </Text>
                  <TouchableOpacity
                    style={styles.uploadButtonShow}
                    onPress={openImagePicker}
                    id="upload-image-button"
                  >
                    <Image
                      source={require("./assets/plus.png")}
                      style={styles.uploadPlusIcon}
                    />
                    <Text style={styles.uploadButtonText}>
                      Upload Image
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
          <View style={styles.imagePickerContainer}>
            <ActivityIndicator style={styles.activityIndicatorCenter} />
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const CommentInput = ({
  comment,
  toggleBottomNavigationView,
  loading,
  onSubmit,
  error,
  theme,
  disabled,
  buttonColor,
  handleCommentChange
}) => {

  const textFieldPress = () => {
    toggleBottomNavigationView()
  }
  return (
    <View style={styles.commentContainer}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.inputWrapper,
            { backgroundColor: theme?.background || "#000" },
          ]}
          onPress={textFieldPress}
        >
          <TextInput
            style={[styles.singleTextInput, { color: theme?.text || "#000" }]}
            value={comment}
            onChangeText={handleCommentChange}
            placeholder="Report the issue"
            placeholderTextColor={(theme?.text || "#000") + "80"} // adds opacity
          />
          <View disabled={loading} id="open-sheet-button" style={styles.openSheetButton}>
            <Image
              resizeMode="cover"
              source={require("./assets/chat-icon.png")}
              style={styles.iconImage}
            />
          </View>
        </TouchableOpacity>

        <View style={styles.spacer8} />

        <TouchableOpacity
          disabled={loading || disabled}
          style={[styles.rightIconContainer, { backgroundColor: buttonColor }]}
          onPress={onSubmit}
          id="add-comment-button"
        >
          {loading ? (
            <ActivityIndicator color="#FFF" style={styles.activityIndicator} />
          ) : (
            <Text style={styles.addButtonStyle}>Add</Text>
          )}
        </TouchableOpacity>
      </View>
      {error && (
        <Text style={[styles.errorText, styles.commentErrorText]}>
          Please enter a comment before submitting
        </Text>
      )}
    </View>
  );
};

export const BugTracking = ({ projectID = "", token = "" }) => {
  if (Platform.OS === "ios") {
    throw new Error(`BugTracking is currently not supported on iOS`);
  }

  if (!projectID || !token) {
    throw new Error(
      `Error: Unable to find required prop 'projectID' or 'token' or both.`
    );
  }

  const exportRef = useRef();
  const isCapturing = useRef(false);
  const [comment, setComment] = useState("");
  const [description, setDescription] = useState("");
  const [currentPath, setCurrentPath] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paths, setPaths] = useState([]);
  const [src, setSrc] = useState("");
  const [visible, setVisible] = useState(false);
  const [btmSheetVisible, setbtmSheetVisible] = useState(false);
  const [error, setError] = useState(false);
  const [widgetVisible, setWidgetVisible] = useState(true);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const withAnim = useRef(new RNAnimated.Value(40)).current;
  const issueTitleRef = useRef(null);
  const [fabPos, setFabPos] = useState(START_POS);
  const scheme = useColorScheme();
  const [isRecording, setIsRecording] = useState(false);
  const [videoUri, setVideoUri] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const player = useVideoPlayer(null);
  const [showAudioPermissionModal, setShowAudioPermissionModal] = useState(false);

  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [selectedDueDate, setSelectedDueDate] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState(null);
  const audioPlayer = useAudioPlayer(require('./assets/start-audio.mp3'));

  const playSound = () => {
    audioPlayer.seekTo(0.5);
    audioPlayer.play();
  };

  const handleAudioPermissionSettings = async () => {
    setShowAudioPermissionModal(false);
    await Linking.openSettings();
  };

  const handleContinueWithoutAudio = async () => {
    setShowAudioPermissionModal(false);
    const granted = await MyModuleJS.requestPermissions();
    if (granted) {
      playSound();
      try {
        const isStarted = await MyModuleJS.startRecordingService();
        if (isStarted) {
          setIsRecording(true);
        } else {
          setIsRecording(false);
        }
      } catch (e) {
        console.error("❌ Start recording error:", e);
        setIsRecording(false);
      }
    } else {
      console.log("❌ Media Projection permission denied");
    }
  };

  const toggleBottomNavigationView = () => {
    setbtmSheetVisible(!btmSheetVisible);
  };

  const onReset = () => {
    setComment("");
    setDescription("");
    setCurrentPath([]);
    setSrc("");
    setPaths([]);
    setWidgetVisible(true);
    setVisible(false);
    setExpanded(false);
    setError(false);
    setLoading(false);
    setShowImageUpload(false);
    setVideoUri(null);
    if (player) player.pause();
    isCapturing.current = false;
    setSelectedAssignees([]);
    setSelectedDueDate(null);
    setSelectedPriority(null);
    setSelectedDueDate(null);
    setSelectedPriority(null);
    setbtmSheetVisible(false);
  };

  const onScreenCapture = async () => {
    try {
      if (isCapturing.current) return;
      isCapturing.current = true;
      setWidgetVisible(false);
      setVisible(true);
      await new Promise((resolve) => setTimeout(resolve, 500));
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
    if (typeof launchImageLibrary !== "function") {
      console.error(
        "launchImageLibrary is not available. Check if the module is linked correctly."
      );
      return;
    }

    launchImageLibrary(
      {
        mediaType: "photo",
        selectionLimit: 1,
        quality: 1,
      },
      (response) => {
        if (response.didCancel) {
          console.log("User cancelled image picker");
        } else if (response.errorCode) {
          console.error("ImagePicker Error:", response.errorMessage);
        } else {
          const asset = response.assets?.[0];
          if (!asset?.uri) {
            console.warn("No image URI returned");
            return;
          }

          if (asset.fileSize && asset.fileSize > MAX_MB) {
            Toast.show({
              type: "error",
              text1:
                "Selected image is too large. Please select an image under 10MB.",
            });
            return;
          }

          setShowImageUpload(false);
          setTimeout(() => {
            setSrc(asset.uri);
          }, 1200);
        }
      }
    );
  };

  const getBuildNumber = () => {
    try {
      const expoConfig = Constants?.expoConfig;
      if (expoConfig) {
        if (Platform.OS === "android" && expoConfig?.android?.versionCode) {
          return String(expoConfig?.android?.versionCode);
        } else if (Platform.OS === "ios" && expoConfig?.ios?.buildNumber) {
          return String(expoConfig?.ios?.buildNumber);
        }
      }

      return String(DeviceInfo.getBuildNumber() ?? BUILD_NUMBER);
    } catch (err) {
      console.warn("⚠️ Failed to get build number:", err.message);
      return String(DeviceInfo.getBuildNumber() ?? BUILD_NUMBER);
    }
  };

  const fetchProjectDetails = async () => {
    try {
      const response = await fetch(`${BASE_URL}/project-details`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-plugin-code": token,
        },
        body: JSON.stringify({
          projectID: projectID,
        }),
      });

      const data = await response.json();
      if (data?.success) {
        setProjectDetails(data?.data);
      }
    } catch (error) {
      console.error("Error fetching assignees:", error);
    }
  };

  const uploadVideo = async (videoUri) => {
    try {
      const compressedUri = await Video.compress(videoUri, {
        compressionMethod: 'auto',
      });

      const formData = new FormData();
      formData.append('file', {
        uri: compressedUri,
        type: 'video/mp4',
        name: 'upload.mp4',
      });

      const response = await fetch('https://us-central1-ruttlp.cloudfunctions.net/uploadFile', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = await response.json();
      console.log("Upload response:", result);
      if (result.success && result.files && result.files.length > 0) {
        return result.files[0].url;
      } else {
        throw new Error("Upload failed or no file url returned");
      }
    } catch (error) {
      console.error("Video upload error:", error);
      throw error;
    }
  };

  const submitTicketHandler = async (image = '', videoUrlFile = '') => {
    const headers = {
      "Content-Type": "application/json",
      "x-plugin-code": token,
    };

    const packageName = DeviceInfo.getBundleId();
    if (!packageName) {
      Toast.show({
        type: "error",
        text1: "Application identifier not found!",
      });
      return;
    }

    const haveDescription = !!description?.trim();
    const buildNumber = getBuildNumber();

    let saveData = {
      comment,
      description: haveDescription ? description?.trim() : "",
      height: SCREEN_HEIGHT,
      width: SCREEN_WIDTH,
      osName: Platform.OS,
      appId: packageName,
      buildNumber,
      highlightedCoords: highlightedCoords ?? {},
      image: image ? image : '',
      projectID,
    };

    if (videoUrlFile) {
      saveData.video = videoUrlFile;
    }

    if (selectedPriority) {
      saveData.priority = { high: 1, medium: 2, low: 3 }[selectedPriority];
    }

    if (selectedDueDate) {
      const months = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
      const [day, monthStr, year] = selectedDueDate.replace(',', '').split(' ');
      saveData.dueDate = new Date(`${year}-${months[monthStr]}-${day}`).toISOString();
    }

    if (selectedAssignees?.length) {
      saveData.assignedTo = selectedAssignees.map(u => u.uid);
    }

    try {
      const ticketResponse = await fetch(BASE_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(saveData),
      });

      const ticketData = await ticketResponse.json();

      if (ticketData?.success) {
        Toast.show({
          type: "success",
          text1: "New ticket added successfully.",
        });
      } else {
        Toast.show({
          type: "error",
          text1: "Something went wrong while creating the ticket.",
        });
      }
    } catch (err) {
      setTimeout(() => {
        manuallyUpload();
      }, 1000);
      Toast.show({
        type: "error",
        text1: "Ticket upload failed in background",
      });
    }
  };

  const imageSubmit = async () => {
    if (!exportRef.current) {
      Toast.show({
        type: "error",
        text1: ERROR_MESSAGE_TITLE,
      });
      return;
    }

    try {
      setLoading(true);
      const uri = await captureRef(exportRef, {
        result: "data-uri",
        quality: 1,
        height: SCREEN_HEIGHT,
        width: SCREEN_WIDTH,
      });

      setTimeout(() => {
        onReset();
      }, 1000);

      if (checkIsDataURI(uri)) {
        submitTicketHandler(uri);
      }
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Something went wrong",
      });
      setTimeout(() => {
        manuallyUpload();
      }, 2000);
    }
  }

  const videoSubmit = async () => {
    if (!videoUri) {
      Toast.show({
        type: "error",
        text1: "No video found to submit",
      });
      return;
    }

    try {
      setLoading(true);
      const uploadedUrl = await uploadVideo(videoUri);

      setTimeout(() => {
        onReset();
      }, 1000);

      await submitTicketHandler(null, uploadedUrl);

    } catch (e) {
      console.error("Video submit error:", e);
      Toast.show({
        type: "error",
        text1: "Failed to upload video or submit ticket",
      });
      setLoading(false);
    }
  }

  const onSubmit = async () => {
    Keyboard.dismiss();
    if (!comment.trim()) {
      setError(true);
      return;
    }

    if (!src && !videoUri) {
      Toast.show({
        type: "error",
        text1: "No image or video found to submit",
      });
      return;
    }

    if (videoUri && !src) {
      videoSubmit()
    }

    if (src && !videoUri) {
      imageSubmit()
    }
  };

  const checkIsDataURI = (uri) => {
    const isValid =
      uri && typeof uri === "string" && uri.startsWith("data:image/");

    if (!isValid) {
      Toast.show({
        type: "error",
        text1: "Data-URI not found or invalid format",
      });
      return false;
    }

    return isValid;
  };

  const manuallyUpload = async () => {
    setWidgetVisible(false);
    setVisible(true);
    setSrc("");
    await new Promise((resolve) => setTimeout(resolve, 200));
    setShowImageUpload(true);
    openImagePicker();
  };

  const checkPermissions = async () => {
    if (Platform.OS !== 'android') return true;

    const audioGranted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Audio Permission Required',
        message: 'App needs access to your microphone to record screen audio.',
        buttonPositive: 'OK',
        buttonNegative: 'Cancel',
      }
    );

    if (audioGranted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      setShowAudioPermissionModal(true);
      return false;
    }

    if (audioGranted !== PermissionsAndroid.RESULTS.GRANTED) {
      setShowAudioPermissionModal(true)
      return false;
    }

    if (Platform.Version >= 33) {
      const notificationGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Notification Permission',
          message: 'We need to show a notification while recording.',
          buttonPositive: 'OK',
          buttonNegative: 'Cancel',
        }
      );

      if (notificationGranted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log("❌ Notification permission denied");
        return false;
      }
    }

    return true;
  };

  const startRecording = async () => {
    try {
      const hasPermissions = await checkPermissions();
      if (!hasPermissions) return;

      const granted = await MyModuleJS.requestPermissions();
      if (granted) {
        playSound();
        try {
          const isStarted = await MyModuleJS.startRecordingService();
          if (isStarted) {
            setIsRecording(true);
          } else {
            setIsRecording(false);
          }
        } catch (e) {
          console.error("❌ Start recording error:", e);
          setIsRecording(false);
        }
      }
    } catch (e) {
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      const result = await MyModuleJS.stopRecording();
      setVideoLoading(true);
      setIsRecording(false);
      if (result?.uri) {
        const info = await FileSystem.getInfoAsync(result.uri);
        if (!info.exists || info.size < 1000) {
          console.error("❌ File is too small or empty:", info);
          Toast.show({ type: "error", text1: "Recording failed (Empty File)" });
          return;
        }
        setVideoUri(result.uri);
        setVisible(true);
        setVideoLoading(false);
      } else {
        setVideoLoading(false)
        console.log("⚠️ Stopped, But no video returned (maybe short recording?)");
      }
    } catch (e) {
      setVideoLoading(false);
      console.error("❌ Stop recording error:", e);
    } finally {
      setVideoLoading(false);
    }
  };

  const handleCommentChange = (text) => {
    setComment(text);
    if (error && text?.trim()) {
      setError(false);
    }
  };

  const theme = useMemo(() => {
    return {
      background: scheme === "dark" ? "#2A2A2A" : "#FFFFFF",
      text: scheme === "dark" ? "#FFFFFF" : "#000000",
      placeholder: scheme === "dark" ? "#FFFFFF66" : "#00000066",
    };
  }, [scheme]);

  const disabledButton = useMemo(() => {
    return (!videoUri && !src) || !comment?.trim();
  }, [src, comment, videoUri]);

  const buttonColor = useMemo(() => {
    return disabledButton ? "#F8F7FF66" : "#6552FF";
  }, [disabledButton]);

  const highlightedCoords = useMemo(() => {
    let minX = SCREEN_WIDTH;
    let minY = SCREEN_HEIGHT;
    let maxX = 0;
    let maxY = 0;
    let foundPoints = false;

    const allPaths = [
      ...paths,
      ...(currentPath.length > 0 ? [{ data: currentPath }] : []),
    ];

    if (allPaths.length === 0) return null;

    for (const pathObj of allPaths) {
      for (const pointString of pathObj.data) {
        const cleanString = pointString.trim().replace("M", "");
        if (!cleanString) continue;

        const [xStr, yStr] = cleanString.split(",");
        const x = parseFloat(xStr);
        const y = parseFloat(yStr);

        if (!isNaN(x) && !isNaN(y)) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          foundPoints = true;
        }
      }
    }

    if (!foundPoints) return null;

    const padding = 5;

    const normalizedMinX = Math.max(0, minX - padding);
    const normalizedMinY = Math.max(0, minY - padding);
    const normalizedMaxX = Math.min(width, maxX + padding);
    const normalizedMaxY = Math.min(height, maxY + padding);

    if (normalizedMaxX > normalizedMinX && normalizedMaxY > normalizedMinY) {
      return {
        x1: normalizedMinX,
        y1: normalizedMinY,
        x2: normalizedMaxX,
        y2: normalizedMaxY,
      };
    }

    return null;
  }, [paths, currentPath, width, height]);

  useEffect(() => {
    let interval;

    if (isRecording) {
      interval = setInterval(async () => {
        const stillRecording = await MyModuleJS.isRecording();
        const recorded = await MyModuleJS.isRecorded();

        if (!stillRecording && recorded) {
          setIsRecording(false);
          const info = await MyModuleJS.getLatestVideoInfo();

          if (info?.uri) {
            console.log("Native auto-stop:", info);
            setVideoUri(info.uri);
            setVisible(true);
            setVideoLoading(false);
          }
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    fetchProjectDetails();
  }, []);

  useEffect(() => {
    const checkRecordingStatus = async () => {
      try {
        const recording = await MyModuleJS.isRecording();
        if (recording) {
          setIsRecording(true);
        }
      } catch (e) {
        console.log("Error checking recording status:", e);
      }
    };
    checkRecordingStatus();
    const timer = setTimeout(checkRecordingStatus, 2000);
    return () => clearTimeout(timer);
  }, []);


  return (
    <GestureHandlerRootView style={styles.mainContainer}>
      <Fragment>
        <AudioPermissionModal
          isOpen={showAudioPermissionModal}
          closeHandler={() => setShowAudioPermissionModal(false)}
          onOpenSettings={handleAudioPermissionSettings}
          onContinueWithoutAudio={handleContinueWithoutAudio}
        />
        {widgetVisible && !src ? (
          <DraggableFab
            initialX={fabPos.x}
            initialY={fabPos.y}
            onDragEnd={setFabPos}
            onPress={onScreenCapture}
            onScreenCapture={onScreenCapture}
            manuallyUpload={manuallyUpload}
            startRecording={startRecording}
            stopRecording={stopRecording}
            isRecording={isRecording}
            videoLoading={videoLoading}
          />
        ) : (
          <StatusBar backgroundColor={"#000"}></StatusBar>
        )}

        <Modal animationType="slide" transparent={false} visible={visible}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={{ flex: 1 }}>
              <View
                style={[
                  { flex: 1 },
                  btmSheetVisible && {
                    ...StyleSheet.absoluteFillObject,
                    opacity: 0,
                    zIndex: -1,
                  },
                ]}
              >
                <PreviewScreen
                  loading={loading}
                  src={src}
                  showImageUpload={showImageUpload}
                  videoUri={videoUri}
                  onReset={onReset}
                  setPaths={setPaths}
                  setExpanded={setExpanded}
                  withAnim={withAnim}
                  currentPath={currentPath}
                  paths={paths}
                  expanded={expanded}
                  exportRef={exportRef}
                  setCurrentPath={setCurrentPath}
                  setbtmSheetVisible={setbtmSheetVisible}
                  openImagePicker={openImagePicker}
                  player={player}
                />
                <KeyboardAvoidingView
                  behavior={Platform.OS === "ios" ? "padding" : "height"}
                  style={styles.footerContainer}
                >
                  <CommentInput
                    buttonColor={buttonColor}
                    comment={comment}
                    disabled={disabledButton}
                    error={error}
                    loading={loading}
                    theme={theme}
                    toggleBottomNavigationView={toggleBottomNavigationView}
                    onSubmit={onSubmit}
                    handleCommentChange={handleCommentChange}
                  />
                </KeyboardAvoidingView>
              </View>
              {btmSheetVisible && (
                <InputScreen
                  comment={comment}
                  handleCommentChange={handleCommentChange}
                  description={description}
                  setDescription={setDescription}
                  issueTitleRef={issueTitleRef}
                  error={error}
                  closeSheet={toggleBottomNavigationView}
                  projectDetails={projectDetails}
                  selectedAssignees={selectedAssignees}
                  setSelectedAssignees={setSelectedAssignees}
                  selectedDueDate={selectedDueDate}
                  setSelectedDueDate={setSelectedDueDate}
                  selectedPriority={selectedPriority}
                  setSelectedPriority={setSelectedPriority}
                  buttonColor={buttonColor}
                  disabled={disabledButton}
                  onSubmit={onSubmit}
                  loading={loading}
                  exportRef={exportRef}
                />
              )}
            </View>
          </SafeAreaView>
        </Modal>
      </Fragment>
      <ToastManager config={toastConfig} />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  errorText: {
    color: "red",
    fontSize: 12,
    marginTop: 4,
    textAlign: "left",
    width: "100%",
  },
  buttonContainer: {
    justifyContent: "center",
    alignItems: "center",
    height: 60,
    width: 60,
    backgroundColor: "white",
    borderRadius: 60 / 2,
    zIndex: 1,
    shadowColor: "#000",
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
    backgroundColor: "black",
  },
  appbarContainer: {
    height: 34,
    width: "100%",
    overflow: "hidden",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    width: 40,
    margin: 6,
    elevation: 0,
    overflow: "hidden",
    borderRadius: 40 / 2,
  },
  colorsContainer: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  colorButton: {
    height: 34,
    width: 34,
    borderRadius: 34 / 2,
  },
  svgContainer: {
    alignItems: "center",
    height: height,
    width: width,
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 16,
  },
  svgContainerHidden: {
    width,
    height,
    position: "absolute",
    top: -9999,
    opacity: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
    elevation: 0,
    backgroundColor: "#6552ff",
  },
  footerContainer: {
    flexDirection: "column",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#000",
    minHeight: 80,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 48,
    backgroundColor: "#2C2C2C",
    paddingHorizontal: 6,
    height: 52,
    flex: 1,
  },
  singleTextInput: {
    flex: 1,
    color: "#E7E7E7",
    fontSize: 15,
    fontFamily: "Inter-Medium",
    lineHeight: 19.5,
    fontWeight: "500",
    overflow: "hidden",
    textAlign: "justify",
    borderRadius: 20,
    paddingLeft: 10,
    textAlignVertical: "center",
  },
  rightIconContainer: {
    height: 52,
    width: 80,
    borderRadius: 27,
    backgroundColor: "#6552ff",
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonStyle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.32,
  },
  iconImage: {
    width: 24,
    height: 24,
    backgroundColor: "transparent",
  },
  bottomSheetContainer: {
    paddingTop: 24,
    paddingHorizontal: 16,
    backgroundColor: "#000",
    flex: 1
  },
  bottomSheetTextInput: {
    width: "100%",
    textAlignVertical: "center",
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  textInput1: {
    width: "100%",
    color: '#FFF',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    textAlignVertical: "center",
  },
  commentContainer: {
    width: "100%",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  imagePickerContainer: {
    alignItems: "center",
    height: height,
    width: width,
    overflow: "hidden",
    justifyContent: "center",
    backgroundColor: "#FFFFFF3C",
    borderRadius: 16,
  },
  uploadButtonContainer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadErrorMessage: {
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 16,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 16,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: undefined,
    letterSpacing: -0.32,
    textAlign: "center",
  },
  bottomMessage: {
    color: "#FFFFFFB2",
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 12,
    letterSpacing: -0.24,
    textAlign: "center",
    padding: 12,
    paddingHorizontal: 24,
  },
  uploadButtonShow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  uploadIcon: {
    width: 16,
    height: 16,
  },
  uploadText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  toastContainer: {
    backgroundColor: "#000",
    padding: 12,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },
  errorToastStyle: {
    borderColor: "#EC1818",
    backgroundColor: "#EC1818",
  },
  toastText1: { color: "#fff", fontWeight: "bold" },
  toastText2: { color: "#fff", opacity: 0.85 },
  spacer8: { width: 8 },
  activityIndicator: { paddingHorizontal: 4 },
  backdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: Z_INDEX - 1,
    height: SCREEN_HEIGHT,
  },
  lottie: { width: 60, height: 60 },
  ruttlIcon: { width: 24, height: 24 },
  mainContainer: { zIndex: 999 },
  modalInnerContainer: {
    flex: 1,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: "hidden",
    padding: 16,
    backgroundColor: "#1F1F1F",
  },
  undoIcon: {
    height: 25,
    width: 25,
  },
  editColorIcon: { height: 14, width: 14 },
  scrollViewContent: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    overflow: "hidden",
  },
  scrollView: { flex: 1, backgroundColor: "#1F1F1F", borderRadius: 20 },
  videoView: { height: "100%", width: "100%" },
  emptyImage: { height: 70, width: 102 },
  uploadPlusIcon: { height: 24, width: 24 },
  activityIndicatorCenter: { alignSelf: "center" },
  errorContainer: { width: "100%" },

  backdropSheet: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1F1F1F",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  gradientCircle: {
    width: 33,
    height: 33,
    borderRadius: 16.5,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  gradientCircleText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  checkBox: {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 4.571,
    justifyContent: "center",
    alignItems: "center",
    borderColor: "#45386C",
    borderWidth: 1,
  },
  checkBoxImage: {
    width: 32,
    height: 32,
  },
  assigneeRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    paddingVertical: 8,
  },
  assigneeName: {
    color: "#FFF",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    flex: 1,
    textTransform: 'capitalize'
  },
  modalContentContainer: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  dragHandle: {
    width: 42,
    height: 4,
    backgroundColor: "#FFFFFF",
    opacity: 0.1,
    alignSelf: "center",
    borderRadius: 2,
    marginBottom: 36,
  },
  modalTitle: {
    color: "#FFFFFF",
    textAlign: "center",
    fontFamily: "Inter",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 24,
  },
  searchField: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    borderRadius: 44,
    borderWidth: 1,
    borderColor: "rgba(234, 234, 234, 0.20)",
    marginHorizontal: 24,
    marginBottom: 24,
  },
  searchInput: {
    color: "#FFF",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  searchIcon: {
    width: 24,
    height: 24,
  },
  assigneeListContainer: {
    maxHeight: 250,
    marginHorizontal: 24,
    marginBottom: 24,
  },
  assigneeListContent: {
    paddingBottom: 12,
  },
  noAssigneeText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
  },
  continueButton: {
    height: 45,
    borderRadius: 100,
    backgroundColor: "#6552FF",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 24,
  },
  continueButtonText: {
    color: "#FFF",
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: "500",
  },
  calendarStyle: {
    marginHorizontal: 24,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: "#1F1F1F"
  },
  continueButtonMargin: {
    marginTop: 24,
  },
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  priorityItemText: {
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: "500",
    color: "#FFF",
  },
  checkIcon: {
    width: 20,
    height: 20,
  },
  bottomActionBar: {
    flexDirection: "row",
    padding: 16,
    columnGap: 8,
    backgroundColor: '#1F1F1F',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
  },

  actionButton: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 48) / 3,
  },

  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(234,234,234,0.2)',
    borderRadius: 48,
    columnGap: 6,
  },

  actionButtonText: {
    color: '#FFF',
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: -0.24,
    textTransform: 'capitalize',
    flex: 1,
    flexWrap: 'nowrap'
  },

  actionButtonIconBg: {
    height: 20,
    width: 20,
    borderRadius: 10,
  },

  actionButtonIcon: {
    height: 20,
    width: 20,
  },
  inputScreenHeader: {
    flexDirection: "row",
    marginBottom: 60,
    justifyContent: "space-between",
  },
  backIcon: {
    height: 28,
    width: 28,
  },
  closeIcon: {
    height: 18,
    width: 18,
  },
  inputScreenTitle: {
    fontSize: 28,
    color: "#FFFFFF",
    fontFamily: "Inter",
    lineHeight: 28,
    fontWeight: "700",
  },
  inputScreenDescription: {
    textAlignVertical: "top",
    textAlign: "auto",
    borderBottomColor: "#EAEAEA33",
    borderBottomWidth: 1,
  },

  previewCloseButton: {
    marginRight: "auto",
    padding: 2
  },
  previewCloseIcon: {
    height: 16,
    width: 16,
  },
  previewUndoContainer: {
    columnGap: 14,
    flexDirection: "row",
  },
  colorPickerButton: {
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#fff",
  },
  colorOption: {
    marginLeft: 8,
  },
  openSheetButton: {
    height: 42,
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6552FF",
    borderRadius: 22,
  },
  commentErrorText: {
    marginLeft: 12,
  },
  centeredModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#1F1F1F',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
});

BugTracking.propTypes = {
  projectID: PropTypes.string.isRequired,
  token: PropTypes.string.isRequired,
};

export default BugTracking;