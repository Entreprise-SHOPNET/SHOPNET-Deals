

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const FAVORITES_STORAGE_KEY = '@shopnet_favorites';

const COLORS = {
  background: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1A2C3E',
  textSecondary: '#6B7A8C',
  accent: '#0A68B4',
  accentLight: '#E6F0FA',
  border: '#E8E8E8',
  error: '#F44336',
};

type FavoriteItem = {
  id: string;
  title: string;
  price: number;
  image: string;
  sellerName: string;
  addedAt: number;
};

export default function FavorisScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadFavorites = async () => {
    try {
      const data = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      setFavorites(data ? JSON.parse(data) : []);
    } catch (error) {
      console.error('Erreur chargement favoris:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [])
  );

  const removeFavorite = async (id: string) => {
    try {
      const updated = favorites.filter(item => item.id !== id);
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
      setFavorites(updated);
    } catch (error) {
      console.error('Erreur suppression favori:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFavorites();
    setRefreshing(false);
  };

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  const renderFavoriteItem = ({ item }: { item: FavoriteItem }) => {
    return (
      <TouchableOpacity
        style={[styles.card, { borderColor: COLORS.border }]}
        onPress={() => router.push({ pathname: '/ProductDetail', params: { id: item.id } })}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: item.image || 'https://via.placeholder.com/100' }}
          style={styles.image}
        />
        <View style={styles.info}>
          <Text style={[styles.title, { color: COLORS.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.seller, { color: COLORS.textSecondary }]}>
            {item.sellerName}
          </Text>
          <Text style={[styles.price, { color: COLORS.accent }]}>
            ${formatPrice(item.price)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeFavorite(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="heart" size={24} color={COLORS.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: COLORS.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>Mes favoris</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        renderItem={renderFavoriteItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.accent]}
            tintColor={COLORS.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={64} color={COLORS.textSecondary} />
            <Text style={[styles.emptyText, { color: COLORS.text }]}>Aucun favori pour le moment</Text>
            <TouchableOpacity
              style={[styles.exploreButton, { backgroundColor: COLORS.accent }]}
              onPress={() => router.push('/')}
            >
              <Text style={styles.exploreButtonText}>Explorer les produits</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
  },
  image: {
    width: 80,
    height: 80,
  },
  info: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  seller: {
    fontSize: 12,
    marginBottom: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
  },
  removeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  exploreButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});