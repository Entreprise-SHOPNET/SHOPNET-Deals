import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Dimensions,
  Modal,
  SafeAreaView,
  StatusBar,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

// ========== CONSTANTES ==========
const { width } = Dimensions.get('window');
const LOCAL_API = 'https://shopnet-backend.onrender.com/api';
const ITEMS_PER_PAGE = 10;
const INITIAL_LIMIT = 50;
const CACHE_KEY = '@shopnet_discover_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// ========== PALETTE DE COULEURS ==========
const COLORS = {
  background: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1A2C3E',
  textSecondary: '#6B7A8C',
  accent: '#0A68B4',
  accentLight: '#E6F0FA',
  border: '#E8E8E8',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  gold: '#FFC107',
  verified: '#1877F2',
  headerBg: '#FFFFFF',
  statusBar: 'dark-content',
};

// ========== TYPES ==========
type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  original_price: number | null;
  images: string[];
  likes: number;
  shares: number;
  comments: number;
  isLiked: boolean;
  isPromotion: boolean;
  is_boosted?: boolean;
  is_featured?: boolean;
  category: string;
  condition: string;
  stock: number;
  location: string;
  created_at: string;
  seller: {
    id: string;
    name: string;
    avatar: string | null;
    city: string | null;
  };
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
};

type Category = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type CacheData = {
  timestamp: number;
  products: Product[];
  shops: Shop[];
  trending: Product[];
};

// ========== COMPOSANT BADGE VÉRIFIÉ ==========
const VerificationBadge = ({ size = 14 }: { size?: number }) => (
  <View style={[styles.verificationBadge, { width: size, height: size }]}>
    <MaterialIcons name="verified" size={size * 0.9} color={COLORS.verified} />
  </View>
);

// ========== GESTION DES FAVORIS ==========
const FAVORITES_STORAGE_KEY = '@shopnet_favorites';

const getFavorites = async (): Promise<any[]> => {
  try {
    const data = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

const addFavorite = async (product: Product): Promise<void> => {
  try {
    const favorites = await getFavorites();
    if (!favorites.some(fav => fav.id === product.id)) {
      const newFav = {
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.images[0] || '',
        sellerName: product.seller?.name || 'Vendeur',
        addedAt: Date.now(),
      };
      await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([newFav, ...favorites]));
    }
  } catch (error) { console.error('Erreur ajout favori:', error); }
};

const removeFavorite = async (productId: string): Promise<void> => {
  try {
    const favorites = await getFavorites();
    const updated = favorites.filter(fav => fav.id !== productId);
    await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) { console.error('Erreur suppression favori:', error); }
};

const isFavorite = async (productId: string): Promise<boolean> => {
  try {
    const favorites = await getFavorites();
    return favorites.some(fav => fav.id === productId);
  } catch { return false; }
};

// ========== COMPOSANT PRINCIPAL ==========
export default function DiscoverScreen() {
  const router = useRouter();

  // États produits
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [feedProducts, setFeedProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // États sections
  const [shops, setShops] = useState<Shop[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // ========== CATÉGORIES ==========
  const categories: Category[] = [
    { id: '1', name: 'Électronique', icon: 'phone-portrait-outline' },
    { id: '2', name: 'Mode', icon: 'shirt-outline' },
    { id: '3', name: 'Maison', icon: 'home-outline' },
    { id: '4', name: 'Sports', icon: 'basketball-outline' },
    { id: '5', name: 'Auto', icon: 'car-outline' },
    { id: '6', name: 'Livres', icon: 'book-outline' },
    { id: '7', name: 'Santé', icon: 'heart-outline' },
    { id: '8', name: 'Jouets', icon: 'game-controller-outline' },
  ];

  // ========== CHARGEMENT INITIAL AVEC CACHE ==========
  useEffect(() => {
    const loadInitialData = async () => {
      // Charger le cache d'abord
      const cached = await loadCache();
      if (cached) {
        setAllProducts(cached.products);
        setFeedProducts(cached.products.slice(0, ITEMS_PER_PAGE));
        setShops(cached.shops);
        setTrendingProducts(cached.trending);
        setIsCacheLoaded(true);
        setLoading(false);
      }
      // Puis lancer le rafraîchissement réseau
      loadFavoritesCount();
      requestLocationAndFetchData();
    };
    loadInitialData();
  }, []);

  const loadCache = async (): Promise<CacheData | null> => {
    try {
      const cacheStr = await AsyncStorage.getItem(CACHE_KEY);
      if (cacheStr) {
        const cache: CacheData = JSON.parse(cacheStr);
        if (Date.now() - cache.timestamp < CACHE_EXPIRY) {
          return cache;
        }
      }
    } catch (error) {
      console.error('Erreur chargement cache:', error);
    }
    return null;
  };

  const saveCache = async (products: Product[], shops: Shop[], trending: Product[]) => {
    try {
      const cacheData: CacheData = {
        timestamp: Date.now(),
        products,
        shops,
        trending,
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Erreur sauvegarde cache:', error);
    }
  };

  const loadFavoritesCount = async () => {
    const favs = await getFavorites();
    setFavoritesCount(favs.length);
  };

  const requestLocationAndFetchData = async () => {
    // Si on a déjà des données en cache, on ne met pas loading à true
    if (!isCacheLoaded) setLoading(true);
    try {
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
        location = { latitude: -11.664, longitude: 27.479 };
        setUserLocation(location);
      }

      await Promise.all([
        fetchProducts(1, true, true), // force refresh
        fetchNearbyShops(location!.latitude, location!.longitude),
        fetchTrendingProducts(),
      ]);
    } catch (error) {
      console.error('Erreur chargement initial:', error);
    } finally {
      setLoading(false);
    }
  };

  // ========== BOUTIQUES PROCHES ==========
  const fetchNearbyShops = async (lat: number, lng: number, radius = 15) => {
    try {
      const url = `${LOCAL_API}/boutique/premium/discover/nearby?latitude=${lat}&longitude=${lng}&radius=${radius}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setShops(data.shops || []);
      }
    } catch (error) {
      console.error('Erreur fetchNearbyShops:', error);
    }
  };

  // ========== PRODUITS (CORRIGÉ : ÉVITE LES DOUBLONS) ==========
  const fetchProducts = async (pageNum = 1, shouldShuffle = false, forceRefresh = false) => {
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: (pageNum === 1 ? INITIAL_LIMIT : ITEMS_PER_PAGE).toString(),
      });
      
      if (selectedCategory) {
        params.append('category', selectedCategory);
      }

      const response = await fetch(`${LOCAL_API}/products?${params}`);
      const data = await response.json();

      if (data.success) {
        let products = formatProducts(data.products || []);
        for (let p of products) {
          p.isLiked = await isFavorite(p.id);
        }
        if (shouldShuffle) products = shuffleArray(products);

        if (pageNum === 1) {
          setAllProducts(products);
          setFeedProducts(products.slice(0, ITEMS_PER_PAGE));
          saveCache(products, shops, trendingProducts);
        } else {
          // Éviter les doublons en filtrant les produits déjà présents
          setAllProducts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newProducts = products.filter(p => !existingIds.has(p.id));
            return [...prev, ...newProducts];
          });
          setFeedProducts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newProducts = products.filter(p => !existingIds.has(p.id));
            return [...prev, ...newProducts];
          });
        }
        setPage(pageNum);
        setHasMore(pageNum < (data.totalPages || 1));
      }
    } catch (error) {
      console.error('Erreur fetchProducts:', error);
    }
  };

  // ========== PRODUITS TENDANCES ==========
  const fetchTrendingProducts = async () => {
    try {
      const response = await fetch(`${LOCAL_API}/products/analytics`);
      const data = await response.json();
      if (data.success && data.data.trending_products) {
        const trending = data.data.trending_products.map((p: any) => ({
          id: p.id.toString(),
          title: p.title,
          price: parseFloat(p.price),
          original_price: null,
          images: [],
          likes: p.likes || 0,
          shares: 0,
          comments: 0,
          isLiked: false,
          isPromotion: false,
          is_boosted: false,
          category: p.category,
          condition: '',
          stock: 1,
          location: '',
          created_at: '',
          seller: { id: '', name: p.seller_name || 'Vendeur', avatar: null, city: null },
        }));
        setTrendingProducts(trending);
      }
    } catch (error) {
      console.error('Erreur fetchTrending:', error);
    }
  };

  // ========== FORMATAGE PRODUIT ==========
  const formatProducts = (rawProducts: any[]): Product[] => {
    return rawProducts.map(p => ({
      id: p.id.toString(),
      title: p.title || 'Sans titre',
      description: p.description || '',
      price: Number(p.price) || 0,
      original_price: p.original_price ? Number(p.original_price) : null,
      images: Array.isArray(p.image_urls) ? p.image_urls : [],
      likes: p.likes || 0,
      shares: p.shares || 0,
      comments: p.comments || 0,
      isLiked: Boolean(p.isLiked),
      isPromotion: Boolean(p.isPromotion || p.is_boosted),
      is_boosted: Boolean(p.is_boosted),
      is_featured: Boolean(p.is_featured),
      category: p.category || 'Non catégorisé',
      condition: p.condition || 'neuf',
      stock: p.stock || 0,
      location: p.location || p.seller?.city || 'Ville inconnue',
      created_at: p.created_at || '',
      seller: {
        id: p.seller?.id?.toString() || '',
        name: p.seller?.name || 'Vendeur inconnu',
        avatar: p.seller?.avatar || null,
        city: p.seller?.city || null,
      },
    }));
  };

  // ========== MÉLANGE ==========
  const shuffleArray = (array: Product[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // ========== CHARGEMENT SUPPLÉMENTAIRE ==========
  const loadMoreProducts = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      fetchProducts(page + 1, false).finally(() => setLoadingMore(false));
    }
  };

  // ========== RAFRAÎCHISSEMENT ==========
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSelectedCategory(null);
    if (userLocation) {
      await Promise.all([
        fetchProducts(1, true, true),
        fetchNearbyShops(userLocation.latitude, userLocation.longitude),
        fetchTrendingProducts(),
      ]);
    } else {
      await requestLocationAndFetchData();
    }
    setRefreshing(false);
  }, [userLocation]);

  // ========== FILTRAGE PAR CATÉGORIE ==========
  const filterByCategory = async (categoryName: string) => {
    if (selectedCategory === categoryName) {
      setSelectedCategory(null);
      setLoading(true);
      await fetchProducts(1, true);
      setLoading(false);
    } else {
      setSelectedCategory(categoryName);
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: '1',
          limit: INITIAL_LIMIT.toString(),
          category: categoryName,
        });
        const response = await fetch(`${LOCAL_API}/products?${params}`);
        const data = await response.json();
        if (data.success) {
          let products = formatProducts(data.products || []);
          for (let p of products) {
            p.isLiked = await isFavorite(p.id);
          }
          setAllProducts(products);
          setFeedProducts(products.slice(0, ITEMS_PER_PAGE));
          setPage(1);
          setHasMore(data.totalPages > 1);
        }
      } catch (error) {
        console.error('Erreur filtre catégorie:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  // ========== FAVORIS ==========
  const toggleFavorite = async (product: Product) => {
    const isFav = await isFavorite(product.id);
    if (isFav) {
      await removeFavorite(product.id);
    } else {
      await addFavorite(product);
    }
    setAllProducts(prev =>
      prev.map(p => (p.id === product.id ? { ...p, isLiked: !isFav } : p))
    );
    setFeedProducts(prev =>
      prev.map(p => (p.id === product.id ? { ...p, isLiked: !isFav } : p))
    );
    setTrendingProducts(prev =>
      prev.map(p => (p.id === product.id ? { ...p, isLiked: !isFav } : p))
    );
    await loadFavoritesCount();
  };

  // ========== NAVIGATION ==========
  const handleSearch = () => router.push('/search');
  const handleFavorites = () => router.push('/Favoris');
  const handleNearbyShops = () => {
    if (userLocation) {
      router.push({
        pathname: '/AllShops',
        params: {
          latitude: userLocation.latitude.toString(),
          longitude: userLocation.longitude.toString(),
        },
      });
    } else {
      Alert.alert('Localisation', 'Activez la localisation pour voir les boutiques proches.');
    }
  };

  const goToDetail = (product: Product) => {
    router.push({
      pathname: '/ProductDetail',
      params: { product: JSON.stringify(product) },
    });
  };

  // ========== CONTACT ==========
  const contactEmail = (product: Product) => {
    const email = product.seller?.email || 'vendeur@shopnet.com';
    const subject = `Demande: ${product.title}`;
    const body = `Bonjour,\n\nJe suis intéressé par "${product.title}" à ${product.price}€.\n\nCordialement.`;
    Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  // ========== RENDU CARTE PRODUIT ==========
  const renderProductCard = ({ item, index }: { item: Product; index: number }) => {
    const discount = item.original_price
      ? Math.round(((item.original_price - item.price) / item.original_price) * 100)
      : 0;
    const imageUrl = item.images?.length > 0 ? item.images[0] : null;
    const cardWidth = (width - 36) / 2;

    return (
      <View
        style={[
          styles.productCard,
          {
            backgroundColor: COLORS.card,
            borderColor: COLORS.border,
            width: cardWidth,
          },
        ]}
      >
        <TouchableOpacity activeOpacity={0.95} onPress={() => goToDetail(item)}>
          <View style={styles.imageContainer}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: COLORS.border }]}>
                <Ionicons name="cube-outline" size={30} color={COLORS.textSecondary} />
              </View>
            )}

            <View style={styles.badgeContainer}>
              {item.isPromotion && (
                <View style={[styles.badge, { backgroundColor: COLORS.error }]}>
                  <Ionicons name="flash" size={10} color="#fff" />
                  <Text style={styles.badgeText}>PROMO</Text>
                </View>
              )}
              {item.is_boosted && !item.isPromotion && (
                <View style={[styles.badge, { backgroundColor: COLORS.success }]}>
                  <Ionicons name="rocket" size={10} color="#fff" />
                  <Text style={styles.badgeText}>BOOSTÉ</Text>
                </View>
              )}
              {discount > 0 && (
                <View style={[styles.discountBadge, { backgroundColor: COLORS.error }]}>
                  <Text style={styles.discountText}>-{discount}%</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={(e) => { e.stopPropagation(); toggleFavorite(item); }}
            >
              <Ionicons
                name={item.isLiked ? 'heart' : 'heart-outline'}
                size={18}
                color={item.isLiked ? COLORS.error : '#fff'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.cardContent}>
            <Text style={[styles.productTitle, { color: COLORS.text }]} numberOfLines={2}>
              {item.title}
            </Text>

            <View style={styles.sellerRow}>
              {item.seller?.avatar ? (
                <Image source={{ uri: item.seller.avatar }} style={styles.sellerAvatar} />
              ) : (
                <View style={[styles.sellerAvatar, styles.sellerAvatarPlaceholder, { backgroundColor: COLORS.border }]}>
                  <Ionicons name="person" size={12} color={COLORS.textSecondary} />
                </View>
              )}
              <Text style={[styles.sellerName, { color: COLORS.textSecondary }]} numberOfLines={1}>
                {item.seller?.name}
              </Text>
            </View>

            <View style={styles.priceRow}>
              {item.original_price ? (
                <View style={styles.priceContainer}>
                  <Text style={[styles.originalPrice, { color: COLORS.textSecondary }]}>
                    ${item.original_price.toFixed(2)}
                  </Text>
                  <Text style={[styles.promoPrice, { color: COLORS.error }]}>
                    ${item.price.toFixed(2)}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.regularPrice, { color: COLORS.accent }]}>
                  ${item.price.toFixed(2)}
                </Text>
              )}
            </View>

            {item.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={10} color={COLORS.textSecondary} />
                <Text style={[styles.locationText, { color: COLORS.textSecondary }]} numberOfLines={1}>
                  {item.location}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // ========== RENDU CARTE PRODUIT HORIZONTAL ==========
  const renderHorizontalProductCard = (item: Product, index: number, cardWidth: number) => {
    const discount = item.original_price
      ? Math.round(((item.original_price - item.price) / item.original_price) * 100)
      : 0;
    const imageUrl = item.images?.length > 0 ? item.images[0] : null;

    return (
      <View
        key={`${item.id}-${index}`}
        style={[
          styles.productCard,
          {
            backgroundColor: COLORS.card,
            borderColor: COLORS.border,
            width: cardWidth,
            marginRight: 12,
          },
        ]}
      >
        <TouchableOpacity activeOpacity={0.95} onPress={() => goToDetail(item)}>
          <View style={styles.imageContainer}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: COLORS.border }]}>
                <Ionicons name="cube-outline" size={30} color={COLORS.textSecondary} />
              </View>
            )}

            <View style={styles.badgeContainer}>
              {item.isPromotion && (
                <View style={[styles.badge, { backgroundColor: COLORS.error }]}>
                  <Ionicons name="flash" size={10} color="#fff" />
                  <Text style={styles.badgeText}>PROMO</Text>
                </View>
              )}
              {item.is_boosted && !item.isPromotion && (
                <View style={[styles.badge, { backgroundColor: COLORS.success }]}>
                  <Ionicons name="rocket" size={10} color="#fff" />
                  <Text style={styles.badgeText}>BOOSTÉ</Text>
                </View>
              )}
              {discount > 0 && (
                <View style={[styles.discountBadge, { backgroundColor: COLORS.error }]}>
                  <Text style={styles.discountText}>-{discount}%</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={(e) => { e.stopPropagation(); toggleFavorite(item); }}
            >
              <Ionicons
                name={item.isLiked ? 'heart' : 'heart-outline'}
                size={18}
                color={item.isLiked ? COLORS.error : '#fff'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.cardContent}>
            <Text style={[styles.productTitle, { color: COLORS.text }]} numberOfLines={2}>
              {item.title}
            </Text>

            <View style={styles.sellerRow}>
              {item.seller?.avatar ? (
                <Image source={{ uri: item.seller.avatar }} style={styles.sellerAvatar} />
              ) : (
                <View style={[styles.sellerAvatar, styles.sellerAvatarPlaceholder, { backgroundColor: COLORS.border }]}>
                  <Ionicons name="person" size={12} color={COLORS.textSecondary} />
                </View>
              )}
              <Text style={[styles.sellerName, { color: COLORS.textSecondary }]} numberOfLines={1}>
                {item.seller?.name}
              </Text>
            </View>

            <View style={styles.priceRow}>
              {item.original_price ? (
                <View style={styles.priceContainer}>
                  <Text style={[styles.originalPrice, { color: COLORS.textSecondary }]}>
                    ${item.original_price.toFixed(2)}
                  </Text>
                  <Text style={[styles.promoPrice, { color: COLORS.error }]}>
                    ${item.price.toFixed(2)}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.regularPrice, { color: COLORS.accent }]}>
                  ${item.price.toFixed(2)}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // ========== SECTION BOUTIQUES ==========
  const renderShopsSection = () => {
    if (shops.length === 0) return null;
    
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Boutiques premium proches</Text>
          <TouchableOpacity onPress={() => router.push('/AllShops')}>
            <Text style={[styles.seeAllText, { color: COLORS.accent }]}>Voir tout</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shopsScrollContent}>
          {shops.map(shop => (
            <TouchableOpacity
              key={shop.id}
              style={styles.shopItem}
              onPress={() => router.push(`/ShopDetail?id=${shop.id}`)}
            >
              <View style={styles.shopAvatarContainer}>
                <Image source={{ uri: shop.logo }} style={styles.shopAvatar} />
              </View>
              <Text style={[styles.shopName, { color: COLORS.text }]} numberOfLines={1}>
                {shop.nom}
              </Text>
              <View style={styles.shopMetaRow}>
                <VerificationBadge size={12} />
                <Text style={[styles.verifiedText, { color: COLORS.verified }]}>Vérifié</Text>
                <Text style={[styles.dotSeparator, { color: COLORS.textSecondary }]}>•</Text>
                <Text style={[styles.shopDistance, { color: COLORS.textSecondary }]}>
                  {shop.distance.toFixed(1)} km
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // ========== SECTION CATÉGORIES ==========
  const renderCategoriesSection = () => (
    <View style={[styles.categoriesWrapper, { backgroundColor: COLORS.background, borderBottomColor: COLORS.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesScrollContent}
      >
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryItem,
              selectedCategory === cat.name && {
                backgroundColor: COLORS.accentLight,
                borderColor: COLORS.accent,
              },
            ]}
            onPress={() => filterByCategory(cat.name)}
          >
            <Ionicons
              name={cat.icon}
              size={20}
              color={selectedCategory === cat.name ? COLORS.accent : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.categoryText,
                { color: selectedCategory === cat.name ? COLORS.accent : COLORS.textSecondary },
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ========== SECTION PRODUITS BOOSTÉS ==========
  const renderBoostedSection = () => {
    const boosted = allProducts.filter(p => p.is_boosted).slice(0, 10);
    if (boosted.length === 0) return null;
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>🔥 Produits Boostés</Text>
          <TouchableOpacity onPress={() => router.push('/BoostedProducts')}>
            <Text style={[styles.seeAllText, { color: COLORS.accent }]}>Voir tout</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent}>
          {boosted.map((item, idx) => renderHorizontalProductCard(item, idx, 160))}
        </ScrollView>
      </View>
    );
  };

  // ========== SECTION MEILLEURES OFFRES ==========
  const renderPromoSection = () => {
    const promos = allProducts.filter(p => p.isPromotion).slice(0, 6);
    if (promos.length === 0) return null;
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>💰 Meilleures offres</Text>
          <TouchableOpacity onPress={() => router.push('/PromoProducts')}>
            <Text style={[styles.seeAllText, { color: COLORS.accent }]}>Voir tout</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent}>
          {promos.map((item, idx) => renderHorizontalProductCard(item, idx, (width - 48) / 3))}
        </ScrollView>
      </View>
    );
  };

  // ========== SECTION TENDANCES ==========
  const renderTrendingSection = () => {
    if (trendingProducts.length === 0) return null;
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>📈 Les plus recherchés</Text>
          <TouchableOpacity onPress={() => router.push('/TrendingProducts')}>
            <Text style={[styles.seeAllText, { color: COLORS.accent }]}>Voir tout</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent}>
          {trendingProducts.map((item, idx) => renderHorizontalProductCard(item, idx, (width - 32) / 2))}
        </ScrollView>
      </View>
    );
  };

  // ========== HEADER FIXE (SANS TRI) ==========
  const renderFixedHeader = () => (
    <View style={[styles.fixedHeader, { backgroundColor: COLORS.headerBg, borderBottomColor: COLORS.border }]}>
      <View style={styles.headerLeft}>
        <TouchableOpacity onPress={() => router.push('/')}>
          <Ionicons name="cube-outline" size={28} color={COLORS.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>
          SHOPNET <Text style={styles.headerDeals}>Deals</Text>
        </Text>
      </View>

      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.iconButton} onPress={handleSearch}>
          <Ionicons name="search-outline" size={22} color={COLORS.accent} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={handleFavorites}>
          <Ionicons name="heart-outline" size={22} color={COLORS.accent} />
          {favoritesCount > 0 && (
            <View style={styles.badgeIcon}>
              <Text style={styles.badgeIconText}>{favoritesCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={handleNearbyShops}>
          <Ionicons name="storefront-outline" size={22} color={COLORS.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ========== LISTE PRINCIPALE ==========
  const renderListHeader = () => (
    <View style={styles.listHeaderContainer}>
      {renderShopsSection()}
      {renderBoostedSection()}
      {renderPromoSection()}
      {renderTrendingSection()}
      <View style={[styles.divider, { backgroundColor: COLORS.border }]} />
      <Text style={[styles.feedTitle, { color: COLORS.text }]}>
        {selectedCategory ? `Catégorie : ${selectedCategory}` : 'Recommandations pour vous'}
      </Text>
    </View>
  );

  // ========== MODAL D'ACTIONS ==========
  const renderActionModal = () => (
    <Modal visible={actionModalVisible} transparent animationType="fade" onRequestClose={() => setActionModalVisible(false)}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionModalVisible(false)}>
        <View style={[styles.actionModal, { backgroundColor: COLORS.card }]}>
          {selectedProduct && (
            <>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: COLORS.text }]}>Options</Text>
                <Text style={[styles.modalSubtitle, { color: COLORS.textSecondary }]} numberOfLines={1}>
                  {selectedProduct.title}
                </Text>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalAction} onPress={() => { setActionModalVisible(false); goToDetail(selectedProduct); }}>
                  <Ionicons name="eye-outline" size={24} color={COLORS.accent} />
                  <Text style={[styles.modalActionText, { color: COLORS.text }]}>Voir détails</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalAction} onPress={() => { setActionModalVisible(false); contactEmail(selectedProduct); }}>
                  <Ionicons name="mail-outline" size={24} color={COLORS.accent} />
                  <Text style={[styles.modalActionText, { color: COLORS.text }]}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalAction} onPress={() => { setActionModalVisible(false); toggleFavorite(selectedProduct); }}>
                  <Ionicons name={selectedProduct.isLiked ? 'heart' : 'heart-outline'} size={24} color={selectedProduct.isLiked ? COLORS.error : COLORS.accent} />
                  <Text style={[styles.modalActionText, { color: COLORS.text }]}>
                    {selectedProduct.isLiked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setActionModalVisible(false)}>
                <Text style={[styles.modalCancelText, { color: COLORS.accent }]}>Annuler</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ========== FOOTER DE CHARGEMENT ==========
  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={COLORS.accent} />
          <Text style={[styles.loadingMoreText, { color: COLORS.textSecondary }]}>Chargement...</Text>
        </View>
      );
    }
    if (!hasMore && feedProducts.length > 0) {
      return (
        <View style={styles.noMoreContainer}>
          <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
          <Text style={[styles.noMoreText, { color: COLORS.textSecondary }]}>Fin du catalogue</Text>
        </View>
      );
    }
    return null;
  };

  // ========== ÉTAT DE CHARGEMENT ==========
  if (loading && !isCacheLoaded) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: COLORS.background }]}>
        <StatusBar barStyle={COLORS.statusBar as any} backgroundColor={COLORS.headerBg} />
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={[styles.loadingText, { color: COLORS.textSecondary }]}>Chargement des produits...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle={COLORS.statusBar as any} backgroundColor={COLORS.headerBg} />

      {/* HEADER FIXE */}
      {renderFixedHeader()}

      {/* CATÉGORIES STICKY */}
      {renderCategoriesSection()}

      {/* FLATLIST PRINCIPALE */}
      <FlatList
        ref={flatListRef}
        data={feedProducts}
        keyExtractor={(item) => `feed-${item.id}`}
        renderItem={renderProductCard}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.flatListContent}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMoreProducts}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={renderListHeader()}
        ListFooterComponent={renderFooter()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.accent]}
            tintColor={COLORS.accent}
          />
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={64} color={COLORS.textSecondary} />
              <Text style={[styles.emptyStateTitle, { color: COLORS.text }]}>Aucun produit</Text>
              <TouchableOpacity style={[styles.retryButton, { backgroundColor: COLORS.accent }]} onPress={onRefresh}>
                <Ionicons name="refresh-outline" size={20} color="#fff" />
                <Text style={styles.retryButtonText}>Actualiser</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {renderActionModal()}
    </SafeAreaView>
  );
}

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerDeals: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.error,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    position: 'relative',
    padding: 4,
  },
  badgeIcon: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeIconText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  flatListContent: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  listHeaderContainer: {
    paddingTop: 8,
  },
  categoriesWrapper: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  categoriesScrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    gap: 6,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  shopsScrollContent: {
    paddingHorizontal: 12,
    gap: 16,
  },
  shopItem: {
    alignItems: 'center',
    width: 90,
  },
  shopAvatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  shopAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  shopName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  shopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '500',
  },
  dotSeparator: {
    fontSize: 10,
    marginHorizontal: 2,
  },
  shopDistance: {
    fontSize: 10,
  },
  verificationBadge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  horizontalScrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  productCard: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 0.5,
    marginBottom: 12,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 150,
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
  badgeContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'column',
    gap: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  discountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  discountText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 10,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 6,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  sellerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  sellerAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerName: {
    fontSize: 11,
    flex: 1,
  },
  priceRow: {
    marginBottom: 6,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  originalPrice: {
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  promoPrice: {
    fontSize: 15,
    fontWeight: '800',
  },
  regularPrice: {
    fontSize: 15,
    fontWeight: '800',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationText: {
    fontSize: 10,
    flex: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    marginVertical: 16,
    marginHorizontal: 12,
  },
  feedTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  footerLoader: {
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 14,
  },
  noMoreContainer: {
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  noMoreText: {
    fontSize: 12,
    fontStyle: 'italic',
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionModal: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalActions: {
    paddingVertical: 8,
  },
  modalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalActionText: {
    fontSize: 16,
    marginLeft: 12,
  },
  modalCancel: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  modalCancelText: {
    fontSize: 17,
    fontWeight: '600',
  },
});