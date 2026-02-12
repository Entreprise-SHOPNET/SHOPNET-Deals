

import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

export default function SplashScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Animation logo
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigation vers Discover
    const timer = setTimeout(() => {
      router.push('/discover');
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={styles.logo}>S</Text>
      </Animated.View>

      <Animated.View style={[styles.brandContainer, { opacity: fadeAnim }]}>
        <Text style={styles.brand}>SHOPNET</Text>
        <Text style={styles.subBrand}>Discover</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#324A62',
    justifyContent: 'center',
    alignItems: 'center',
  },

  logoContainer: {
    backgroundColor: '#FFFFFF',
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    elevation: 6,
  },

  logo: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#324A62',
  },

  brandContainer: {
    alignItems: 'center',
  },

  brand: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
    lineHeight: 30,
  },

  subBrand: {
    fontSize: 14,
    color: '#DDE3EA',
    marginTop: 2,
    letterSpacing: 1,
  },
});
