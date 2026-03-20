import React, { useRef, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, Animated, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MOBILE_COLORS as P } from '../theme/colors';

export const AlertModal = React.forwardRef(({
  visible = false,
  type = 'info', // 'success', 'error', 'warning', 'info'
  title = '',
  message = '',
  buttons = [{ text: 'OK', onPress: () => {} }],
  onDismiss = () => {},
}, ref) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 70,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.8,
          tension: 70,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

  const getTypeConfig = () => {
    const configs = {
      success: {
        emoji: '✓',
        gradient: ['#10b981', '#059669'],
        textColor: '#10b981',
        buttonColor: '#10b981',
      },
      error: {
        emoji: '✕',
        gradient: ['#ef4444', '#dc2626'],
        textColor: '#ef4444',
        buttonColor: '#ef4444',
      },
      warning: {
        emoji: '⚠',
        gradient: ['#f59e0b', '#d97706'],
        textColor: '#f59e0b',
        buttonColor: '#f59e0b',
      },
      info: {
        emoji: 'ⓘ',
        gradient: ['#3b82f6', '#2563eb'],
        textColor: '#3b82f6',
        buttonColor: '#3b82f6',
      },
    };
    return configs[type] || configs.info;
  };

  const config = getTypeConfig();

  const handleButtonPress = (button) => {
    if (button.onPress) {
      button.onPress();
    }
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <Animated.View
        style={[
          styles.backdrop,
          { opacity: opacityAnim },
        ]}
      >
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={onDismiss}
        />
      </Animated.View>

      <View style={styles.centeredView}>
        <Animated.View
          style={[
            styles.modalView,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Header avec gradient et emoji */}
          <LinearGradient colors={config.gradient} style={styles.headerGradient}>
            <Text style={styles.emoji}>{config.emoji}</Text>
            <Text style={styles.title}>{title}</Text>
          </LinearGradient>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  buttons.length > 1 && index === 0 && styles.buttonLeft,
                  buttons.length > 1 && index === buttons.length - 1 && styles.buttonRight,
                  { borderColor: config.buttonColor },
                ]}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.buttonText,
                    { color: config.buttonColor },
                  ]}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '85%',
    backgroundColor: '#1f2937',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  headerGradient: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#d1d5db',
    textAlign: 'center',
    marginHorizontal: 20,
    marginVertical: 18,
    lineHeight: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    marginBottom: 0,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLeft: {
    borderBottomLeftRadius: 16,
  },
  buttonRight: {
    borderBottomRightRadius: 16,
    borderRightWidth: 0,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default AlertModal;
