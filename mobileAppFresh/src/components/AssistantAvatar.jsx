// components/AssistantAvatar.jsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

export default function AssistantAvatar({ onDone, isPeak = false }) {
  const slideAnim = useRef(new Animated.Value(100)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;

  // Dynamic colors based on peak hour
  const colors = {
    skin: '#ffdbb5',
    hair: '#2d3748',
    shirt: isPeak ? '#FF3D00' : '#3b82f6', // Fiery red in peak, blue normal
    shirtHighlight: isPeak ? '#FF6D00' : '#60a5fa',
    border: '#2d3748',
    speechBg: '#ffffff',
    speechText: '#1e293b',
  };

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: false,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false,
      }),
    ]).start();

    // Wave animation
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, {
            toValue: -1,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(waveAnim, {
            toValue: 1,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(waveAnim, {
            toValue: 0,
            duration: 300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
        { iterations: 3 }
      ).start();
    }, 300);

    // Blinking
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(2000),
        Animated.timing(blinkAnim, {
          toValue: 0.1,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
      ])
    );
    blinkLoop.start();

    // Auto close after 3.5 seconds
    const timer = setTimeout(() => {
      blinkLoop.stop();
      onDone?.();
    }, 3500);

    return () => {
      clearTimeout(timer);
      blinkLoop.stop();
    };
  }, [onDone]);

  const waveRotation = waveAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-30deg', '30deg'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <View style={styles.character}>
        {/* Speech Bubble */}
        <View style={styles.speechBubble}>
          <Text style={styles.speechText}>
            {isPeak ? "🔥 Peak hour! I'll help you skip the queue!" : "Hey 👋 Hungry? I'll help you pick!"}
          </Text>
          <View style={styles.speechTail} />
        </View>

        {/* Avatar Body */}
        <View style={styles.body}>
          {/* Hair */}
          <View style={[styles.hairBase, { backgroundColor: colors.hair }]} />
          <View style={[styles.hairStrand1, { backgroundColor: colors.hair }]} />
          <View style={[styles.hairStrand2, { backgroundColor: colors.hair }]} />
          
          {/* Head */}
          <View style={[styles.head, { backgroundColor: colors.skin, borderColor: colors.border }]}>
            <View style={styles.face}>
              <Animated.View style={[styles.eye, styles.eyeLeft, { opacity: blinkAnim, backgroundColor: colors.border }]} />
              <Animated.View style={[styles.eye, styles.eyeRight, { opacity: blinkAnim, backgroundColor: colors.border }]} />
              <View style={[styles.eyeShine, styles.eyeShineLeft]} />
              <View style={[styles.eyeShine, styles.eyeShineRight]} />
              <View style={[styles.smile, { borderBottomColor: colors.border }]} />
              <View style={[styles.cheek, styles.cheekLeft]} />
              <View style={[styles.cheek, styles.cheekRight]} />
            </View>
          </View>

          {/* Torso */}
          <View style={[styles.torso, { backgroundColor: colors.shirt, borderColor: colors.border }]}>
            <View style={[styles.torsoHighlight, { backgroundColor: colors.shirtHighlight }]} />
          </View>

          {/* Left Arm */}
          <View style={[styles.arm, styles.armLeft, { backgroundColor: colors.shirt, borderColor: colors.border }]}>
            <View style={[styles.sleeve, { backgroundColor: colors.shirtHighlight }]} />
            <View style={[styles.hand, { backgroundColor: colors.skin, borderColor: colors.border }]} />
          </View>

          {/* Right Arm - Waving */}
          <Animated.View
            style={[
              styles.arm,
              styles.armRight,
              { 
                backgroundColor: colors.shirt, 
                borderColor: colors.border,
                transform: [{ rotate: waveRotation }] 
              },
            ]}
          >
            <View style={[styles.sleeve, { backgroundColor: colors.shirtHighlight }]} />
            <View style={[styles.hand, { backgroundColor: colors.skin, borderColor: colors.border }]} />
          </Animated.View>

          {/* Collar */}
          <View style={[styles.collar, { borderColor: colors.border }]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    width: 180,
    height: 250,
    zIndex: 9999,
  },
  character: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  speechBubble: {
    position: 'absolute',
    top: -60,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  speechText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
  },
  speechTail: {
    position: 'absolute',
    bottom: -8,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ffffff',
  },
  body: {
    width: 120,
    height: 180,
    position: 'relative',
    alignItems: 'center',
  },
  hairBase: {
    position: 'absolute',
    top: -6,
    width: 86,
    height: 40,
    borderRadius: 43,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    zIndex: 1,
  },
  hairStrand1: {
    position: 'absolute',
    top: -10,
    left: 20,
    width: 20,
    height: 20,
    borderRadius: 10,
    zIndex: 1,
  },
  hairStrand2: {
    position: 'absolute',
    top: -12,
    left: 50,
    width: 16,
    height: 24,
    borderRadius: 8,
    zIndex: 1,
  },
  head: {
    position: 'absolute',
    top: 0,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    zIndex: 2,
    overflow: 'hidden',
  },
  face: {
    position: 'absolute',
    top: 24,
    left: 10,
    right: 10,
    height: 40,
  },
  eye: {
    position: 'absolute',
    top: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  eyeLeft: { left: 8 },
  eyeRight: { right: 8 },
  eyeShine: {
    position: 'absolute',
    top: 2,
    width: 5,
    height: 5,
    backgroundColor: '#ffffff',
    borderRadius: 2.5,
    zIndex: 3,
  },
  eyeShineLeft: { left: 10 },
  eyeShineRight: { right: 14 },
  smile: {
    position: 'absolute',
    top: 28,
    left: '50%',
    marginLeft: -14,
    width: 28,
    height: 14,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cheek: {
    position: 'absolute',
    top: 20,
    width: 12,
    height: 8,
    backgroundColor: '#ffb5b5',
    borderRadius: 6,
    opacity: 0.6,
  },
  cheekLeft: { left: 0 },
  cheekRight: { right: 0 },
  torso: {
    position: 'absolute',
    top: 75,
    width: 90,
    height: 80,
    borderRadius: 12,
    borderWidth: 3,
    overflow: 'hidden',
  },
  torsoHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    opacity: 0.5,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  arm: {
    position: 'absolute',
    top: 85,
    width: 18,
    height: 60,
    borderRadius: 10,
    borderWidth: 3,
    overflow: 'hidden',
  },
  armLeft: { left: 0 },
  armRight: { right: 0 },
  sleeve: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    opacity: 0.5,
  },
  hand: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
  },
  collar: {
    position: 'absolute',
    top: 75,
    width: 40,
    height: 12,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 2,
    zIndex: 3,
  },
});
