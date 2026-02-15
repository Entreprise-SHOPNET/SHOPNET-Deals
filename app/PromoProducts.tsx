

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
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const LOCAL_API = 'https://shopnet-backend.onrender.com/api';
const CACHE_KEY = '@promo_products_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const ITEMS_PER_PAGE = 5;
const INITIAL_LIMIT = 10; // On charge beaucoup de produits pour avoir toutes les promos

const COLORS = {
  background: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1A2C3E',
  textSecondary: '#6B7A8C',
  accent: '#0A68B4',
  accentLight: '#E6F0FA',
  border: '#E8E8E8',
  error: '#F44336',
  success: '#4CAF50',
};

type Product = {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  images: string[];
  isPromotion: boolean;
  is_boosted?: boolean;
  location: string;
  seller: {
    name: string;
    avatar: string | null;
  };
};

export default function PromoProductsScreen() {
  const router = useRouter();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Chargement initial : cache puis réseau
  useEffect(() => {
    const loadData = async () => {
      const cached = await loadCache();
      if (cached) {
        setAllProducts(cached);
        applyPagination(cached, 1);
        setLoading(false);
      }
      await fetchPromoProducts(!cached);
    };
    loadData();
  }, []);

  const loadCache = async (): Promise<Product[] | null> => {
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

  const saveCache = async (data: Product[]) => {
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

  const applyPagination = (products: Product[], pageNum: number) => {
    const start = 0;
    const end = pageNum * ITEMS_PER_PAGE;
    setDisplayedProducts(products.slice(start, end));
    setHasMore(end < products.length);
  };

  const fetchPromoProducts = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      // Utilisation de l'API publique /products avec une grande limite
      const url = `${LOCAL_API}/products?limit=${INITIAL_LIMIT}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        // Filtrer les produits en promotion ou boostés
        const promos = (data.products || [])
          .filter((p: any) => p.isPromotion || p.is_boosted)
          .map((p: any) => ({
            id: p.id.toString(),
            title: p.title || '',
            price: Number(p.price) || 0,
            original_price: p.original_price ? Number(p.original_price) : null,
            images: Array.isArray(p.image_urls) ? p.image_urls : [],
            isPromotion: Boolean(p.isPromotion || p.is_boosted),
            location: p.location || p.seller?.city || '',
            seller: {
              name: p.seller?.name || 'Vendeur',
              avatar: p.seller?.avatar || null,
            },
          }));
        setAllProducts(promos);
        applyPagination(promos, 1);
        saveCache(promos);
      } else {
        setAllProducts([]);
        setDisplayedProducts([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Erreur fetchPromoProducts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    applyPagination(allProducts, nextPage);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPromoProducts(false);
  }, []);

  // Filtrage par recherche
  useEffect(() => {
    if (searchQuery.trim() === '') {
      applyPagination(allProducts, 1);
      setPage(1);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = allProducts.filter((p) =>
        p.title.toLowerCase().includes(query)
      );
      setDisplayedProducts(filtered);
      setHasMore(false);
    }
  }, [searchQuery, allProducts]);

  const formatPrice = (price: any) => {
    const n = Number(price);
    return isNaN(n) ? 'N/A' : n.toFixed(2);
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const discount = item.original_price
      ? Math.round(((item.original_price - item.price) / item.original_price) * 100)
      : 0;
    const imageUrl = item.images?.[0] || null;

    return (
      <TouchableOpacity
        style={[styles.productCard, { borderColor: COLORS.border }]}
        onPress={() => router.push({ pathname: '/ProductDetail', params: { id: item.id } })}
      >
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.productImage} />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: COLORS.border }]}>
              <Ionicons name="cube-outline" size={30} color={COLORS.textSecondary} />
            </View>
          )}
          {discount > 0 && (
            <View style={[styles.discountBadge, { backgroundColor: COLORS.error }]}>
              <Text style={styles.discountText}>-{discount}%</Text>
            </View>
          )}
        </View>

        <View style={styles.productInfo}>
          <Text style={[styles.productTitle, { color: COLORS.text }]} numberOfLines={2}>
            {item.title}
          </Text>

          {/* Prix */}
          <View style={styles.priceRow}>
            {item.original_price ? (
              <>
                <Text style={[styles.promoPrice, { color: COLORS.error }]}>
                  ${formatPrice(item.price)}
                </Text>
                <Text style={[styles.originalPrice, { color: COLORS.textSecondary }]}>
                  ${formatPrice(item.original_price)}
                </Text>
              </>
            ) : (
              <Text style={[styles.price, { color: COLORS.accent }]}>
                ${formatPrice(item.price)}
              </Text>
            )}
          </View>

          {/* Lieu */}
          {item.location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
              <Text style={[styles.locationText, { color: COLORS.textSecondary }]} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
          ) : null}

          {/* Vendeur */}
          <View style={styles.sellerRow}>
            {item.seller.avatar ? (
              <Image source={{ uri: item.seller.avatar }} style={styles.sellerAvatar} />
            ) : (
              <View style={[styles.sellerAvatar, { backgroundColor: COLORS.border }]}>
                <Ionicons name="person" size={10} color={COLORS.textSecondary} />
              </View>
            )}
            <Text style={[styles.sellerName, { color: COLORS.textSecondary }]} numberOfLines={1}>
              {item.seller.name}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
        <Text style={[styles.loadingText, { color: COLORS.textSecondary }]}>Chargement des offres...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: COLORS.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>Meilleures offres</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Barre de recherche */}
      <View style={[styles.searchContainer, { borderColor: COLORS.border }]}>
        <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: COLORS.text }]}
          placeholder="Rechercher une offre..."
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

      {/* Liste des produits en grille 2 colonnes */}
      <FlatList
        data={displayedProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
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
            <Ionicons name="pricetag-outline" size={64} color={COLORS.textSecondary} />
            <Text style={[styles.emptyText, { color: COLORS.text }]}>Aucune offre trouvée</Text>
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
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productCard: {
    width: (width - 36) / 2,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 120,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  discountText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  productInfo: {
    padding: 8,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
  },
  promoPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  originalPrice: {
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 11,
    flex: 1,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  sellerAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerName: {
    fontSize: 10,
    flex: 1,
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