

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Dimensions,
  RefreshControl, // 👈 IMPORT MANQUANT AJOUTÉ
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const LOCAL_API = 'https://shopnet-backend.onrender.com/api';
const CACHE_KEY = '@all_shops_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const ITEMS_PER_PAGE = 5;

const COLORS = {
  background: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1A2C3E',
  textSecondary: '#6B7A8C',
  accent: '#0A68B4',
  accentLight: '#E6F0FA',
  border: '#E8E8E8',
  error: '#F44336',
  verified: '#1877F2',
};

type Shop = {
  id: number;
  nom: string;
  logo: string;
  description: string;
  ville: string;
  pays: string;
  latitude: string;
  longitude: string;
  type_boutique: string;
  date_activation: string | null;
  distance: number;
  verified?: boolean;
};

const VerificationBadge = ({ size = 14 }: { size?: number }) => (
  <View style={[styles.verificationBadge, { width: size, height: size }]}>
    <MaterialIcons name="verified" size={size * 0.9} color={COLORS.verified} />
  </View>
);

export default function AllShopsScreen() {
  const router = useRouter();
  const [allShops, setAllShops] = useState<Shop[]>([]); // Toutes les boutiques chargées
  const [displayedShops, setDisplayedShops] = useState<Shop[]>([]); // Boutiques affichées (paginees)
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Chargement initial : cache puis réseau
  useEffect(() => {
    const loadData = async () => {
      // 1. Charger depuis le cache
      const cached = await loadCache();
      if (cached) {
        setAllShops(cached);
        applyPagination(cached, 1);
        setLoading(false);
      }

      // 2. Obtenir la localisation et charger depuis le réseau
      const { status } = await Location.requestForegroundPermissionsAsync();
      let location = null;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        location = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setUserLocation(location);
      } else {
        location = { latitude: -11.664, longitude: 27.479 }; // Lubumbashi par défaut
        setUserLocation(location);
      }

      await fetchShops(location.latitude, location.longitude, !cached); // Si pas de cache, on met loading à true
    };
    loadData();
  }, []);

  const loadCache = async (): Promise<Shop[] | null> => {
    try {
      const cacheStr = await AsyncStorage.getItem(CACHE_KEY);
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        if (Date.now() - cache.timestamp < CACHE_EXPIRY) {
          return cache.data;
        }
      }
    } catch (error) {
      console.error('Erreur chargement cache:', error);
    }
    return null;
  };

  const saveCache = async (data: Shop[]) => {
    try {
      const cacheData = {
        timestamp: Date.now(),
        data,
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Erreur sauvegarde cache:', error);
    }
  };

  const applyPagination = (shops: Shop[], pageNum: number) => {
    const start = 0;
    const end = pageNum * ITEMS_PER_PAGE;
    setDisplayedShops(shops.slice(start, end));
    setHasMore(end < shops.length);
  };

  const fetchShops = async (lat: number, lng: number, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const url = `${LOCAL_API}/boutique/premium/discover/nearby?latitude=${lat}&longitude=${lng}&radius=50`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        const shopsWithVerified = (data.shops || []).map((shop: any) => ({
          ...shop,
          verified: true, // À ajuster selon les données réelles
        }));
        setAllShops(shopsWithVerified);
        applyPagination(shopsWithVerified, 1);
        saveCache(shopsWithVerified);
      } else {
        setAllShops([]);
        setDisplayedShops([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Erreur fetchShops:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    applyPagination(allShops, nextPage);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (userLocation) {
      fetchShops(userLocation.latitude, userLocation.longitude, false);
    } else {
      const defaultLoc = { latitude: -11.664, longitude: 27.479 };
      fetchShops(defaultLoc.latitude, defaultLoc.longitude, false);
    }
  }, [userLocation]);

  // Filtrage par recherche
  useEffect(() => {
    if (searchQuery.trim() === '') {
      applyPagination(allShops, 1);
      setPage(1);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = allShops.filter(
        (shop) =>
          shop.nom.toLowerCase().includes(query) ||
          shop.ville.toLowerCase().includes(query)
      );
      setDisplayedShops(filtered);
      setHasMore(false); // Désactive la pagination pendant la recherche
    }
  }, [searchQuery, allShops]);

  const renderShopItem = ({ item }: { item: Shop }) => (
    <TouchableOpacity
      style={[styles.shopCard, { borderColor: COLORS.border }]}
      onPress={() => router.push(`/ShopDetail?id=${item.id}`)}
    >
      <Image source={{ uri: item.logo }} style={styles.shopLogo} />
      <View style={styles.shopInfo}>
        <View style={styles.shopNameRow}>
          <Text style={[styles.shopName, { color: COLORS.text }]} numberOfLines={1}>
            {item.nom}
          </Text>
          {item.verified && <VerificationBadge size={14} />}
        </View>
        <Text style={[styles.shopCity, { color: COLORS.textSecondary }]} numberOfLines={1}>
          {item.ville}, {item.pays}
        </Text>
        <View style={styles.shopDistanceRow}>
          <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
          <Text style={[styles.shopDistance, { color: COLORS.textSecondary }]}>
            {item.distance.toFixed(1)} km
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.accent} />
        <Text style={[styles.footerText, { color: COLORS.textSecondary }]}>Chargement...</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: COLORS.background }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={[styles.loadingText, { color: COLORS.textSecondary }]}>Chargement des boutiques...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header avec retour et titre */}
      <View style={[styles.header, { borderBottomColor: COLORS.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>Toutes les boutiques</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Barre de recherche */}
      <View style={[styles.searchContainer, { borderColor: COLORS.border }]}>
        <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: COLORS.text }]}
          placeholder="Rechercher une boutique..."
          placeholderTextColor={COLORS.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Liste des boutiques */}
      <FlatList
        data={displayedShops}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderShopItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
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
            <Ionicons name="storefront-outline" size={64} color={COLORS.textSecondary} />
            <Text style={[styles.emptyText, { color: COLORS.text }]}>Aucune boutique trouvée</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    paddingVertical: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: COLORS.card,
  },
  shopLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  shopInfo: {
    flex: 1,
  },
  shopNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '600',
  },
  verificationBadge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopCity: {
    fontSize: 13,
    marginBottom: 4,
  },
  shopDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shopDistance: {
    fontSize: 12,
  },
  footerLoader: {
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
});