// components/ChatBubble.jsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';

export default function ChatBubble({ onClick, hasNotification, isPeak = false }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const badgeBounceAnim = useRef(new Animated.Value(1)).current;

  const colors = {
    bg: isPeak ? ['#FF3D00', '#FF6D00'] : ['#3b82f6', '#8b5cf6'],
    shadow: isPeak ? 'rgba(255,61,0,0.45)' : 'rgba(59,130,246,0.45)',
    badge: '#ef4444',
  };

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: false,
      }),
    ]).start();

    // Idle pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Badge bounce
    if (hasNotification) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(badgeBounceAnim, {
            toValue: 1.25,
            duration: 350,
            useNativeDriver: false,
          }),
          Animated.timing(badgeBounceAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [hasNotification]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 1.12,
      friction: 3,
      tension: 100,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: false,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [
            { scale: scaleAnim },
            { scale: pulseAnim },
          ],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onClick}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.bubble,
          {
            backgroundColor: colors.bg[0],
            shadowColor: colors.shadow,
          },
        ]}
      >
        {/* Gradient overlay */}
        <View 
          style={[
            styles.gradientOverlay, 
            { backgroundColor: colors.bg[1] }
          ]} 
        />
        
        {/* Icon */}
        <Text style={styles.icon}>{isPeak ? '👨‍🍳' : '👨‍🍳'}</Text>

        {/* Notification Badge */}
        {hasNotification && (
          <Animated.View
            style={[
              styles.badge,
              {
                transform: [{ scale: badgeBounceAnim }],
              },
            ]}
          >
            <Text style={styles.badgeText}>1</Text>
          </Animated.View>
        )}

        {/* Ripple ring */}
        <Animated.View
          style={[
            styles.ripple,
            {
              opacity: pulseAnim.interpolate({
                inputRange: [1, 1.05],
                outputRange: [0.3, 0],
              }),
              transform: [
                {
                  scale: pulseAnim.interpolate({
                    inputRange: [1, 1.05],
                    outputRange: [1, 1.5],
                  }),
                },
              ],
            },
          ]}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 32,
    right: 32,
    zIndex: 999,
  },
  bubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 10,
    overflow: 'hidden',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.8,
    borderRadius: 30,
    transform: [{ rotate: '135deg' }, { scale: 1.5 }],
  },
  icon: {
    fontSize: 28,
    zIndex: 2,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 22,
    height: 22,
    backgroundColor: '#ef4444',
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    paddingHorizontal: 4,
    zIndex: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  ripple: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
