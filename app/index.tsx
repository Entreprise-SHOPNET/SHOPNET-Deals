

import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import messaging from '@react-native-firebase/messaging';

export default function SplashScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const initApp = async () => {
      await requestFCMToken();
      startAnimation();
      navigateNext();
    };

    initApp();
  }, []);

  // 🔥 Fonction FCM
  const requestFCMToken = async () => {
    try {
      const authStatus = await messaging().requestPermission();

      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log("❌ Permission notification refusée");
        return;
      }

      const token = await messaging().getToken();
      console.log("🔥 FCM TOKEN:", token);

      // 🔥 Envoi vers ton backend
      await fetch('https://shopnet-backend.onrender.com/api/save-fcm-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 1, // ⚠️ Remplace par l'utilisateur connecté
          fcmToken: token,
        }),
      });

      console.log("✅ Token envoyé au backend");

    } catch (error) {
      console.log("❌ Erreur FCM:", error);
    }
  };

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
  };

  const navigateNext = () => {
    setTimeout(() => {
      router.replace('/discover');
    }, 1800);
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
        <Text style={styles.subBrand}>Deals</Text>
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