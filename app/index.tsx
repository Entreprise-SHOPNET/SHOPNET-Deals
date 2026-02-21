

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useRouter } from 'expo-router';
import messaging from '@react-native-firebase/messaging';

export default function SplashScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    initializeFCM();
    startAnimation();
  }, []);

  const startAnimation = () => {
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

    setTimeout(() => {
      router.push('/discover');
    }, 1800);
  };

  const initializeFCM = async () => {
    try {
      console.log('📱 Android Version:', Platform.Version);

      // Android 13+ (API 33+) requires runtime permission
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );

        console.log('🔔 Notification permission:', granted);
      }

      // Request Firebase permission (iOS mainly, safe on Android)
      await messaging().requestPermission();

      // Get FCM Token
      const token = await messaging().getToken();

      if (token) {
        console.log('🔥 FCM TOKEN:', token);

        const response = await fetch(
          'https://shopnet-backend.onrender.com/api/save-fcm-token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fcmToken: token,
            }),
          }
        );

        const result = await response.text();
        console.log('✅ Backend response:', result);
      } else {
        console.log('⚠️ Aucun token reçu');
      }
    } catch (error) {
      console.log('❌ FCM Error:', error);
    }
  };

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
