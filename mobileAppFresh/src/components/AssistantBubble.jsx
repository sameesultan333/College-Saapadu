import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';

// Custom Flame Icon since lucide-react isn't available in RN
const FlameIcon = ({ size = 16, color = '#ef4444' }) => (
  <View style={{ width: size, height: size }}>
    <Text style={{ fontSize: size, color }}>🔥</Text>
  </View>
);

export default function FoodBubble({ isPeakHour, recommended, onSelect }) {
  const scaleAnim = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: false,
    }).start();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>
          {isPeakHour ? '🔥' : '🤖'}
        </Text>
        <Text style={styles.headerText}>
          {isPeakHour ? 'Rush Hour Tip' : 'Food Assistant'}
        </Text>
      </View>

      {/* Message */}
      <Text style={styles.message}>
        {isPeakHour
          ? 'Order fast-moving items to avoid delay.'
          : 'Based on your history, you may like:'}
      </Text>

      {/* Recommendation Button */}
      {recommended && (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={() => onSelect(recommended.id)}
            style={[
              styles.recoButton,
              isPeakHour && styles.recoButtonPeak,
            ]}
          >
            <Text style={styles.recoText} numberOfLines={1}>
              {recommended.name}
            </Text>
            <FlameIcon size={16} color={isPeakHour ? '#fff' : '#ef4444'} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Voice support coming soon</Text>
        <Text style={styles.micEmoji}>🎤</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    maxWidth: 300,
    alignSelf: 'flex-end',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 12,
  },
  recoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#fcd34d',
    marginBottom: 12,
  },
  recoButtonPeak: {
    backgroundColor: '#ef4444',
    borderColor: '#dc2626',
  },
  recoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    flex: 1,
    marginRight: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.6,
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  micEmoji: {
    fontSize: 12,
    marginLeft: 4,
  },
});
