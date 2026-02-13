

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  RefreshControl,
  Dimensions,
  Keyboard,
  Animated,
  ScrollView,
  Modal,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { 
  Ionicons, 
  MaterialIcons 
} from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as Location from 'expo-location';

const { width, height } = Dimensions.get("window");

// ========== API CONFIGURATION ==========
const API_BASE_URL = "https://shopnet-backend.onrender.com/api";

// ========== PALETTE DE COULEURS (FOND BLANC) ==========
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
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  original_price?: number;
  condition: string;
  stock: number;
  location: string;
  created_at: string;
  views_count?: number;
  likes_count?: number;
  shares_count?: number;
  seller_name: string;
  seller_rating: number;
  seller_avatar?: string;
  images: string[] | string;
  relevance_score?: number;
  distance?: number;
  delivery_available?: boolean;
  pickup_available?: boolean;
  views?: number;
  likes?: number;
  shares?: number;
  popularity_score?: number;
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
  distance: number;
  verified?: boolean;
};

type SearchResult = {
  success: boolean;
  data: {
    query: string;
    analysis: any;
    total: number;
    page: number;
    total_pages: number;
    results: Product[];
    suggestions: string[];
    related_searches: string[];
    filters: {
      category?: string;
      price_range: string;
      location?: string;
      condition?: string;
    };
  };
};

type SearchSuggestion = {
  type: 'product' | 'category' | 'history' | 'popular' | 'shop';
  id?: string;
  title: string;
  subtitle?: string;
  image?: string;
  count?: number;
};

type FilterState = {
  category: string;
  minPrice: string;
  maxPrice: string;
  condition: string;
  location: string;
  sortBy: 'relevance' | 'price_asc' | 'price_desc' | 'date' | 'popularity';
  inStock: boolean;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  includeShops: boolean;
};

// ========== COMPOSANT BADGE VÉRIFIÉ ==========
const VerificationBadge = ({ size = 14 }: { size?: number }) => (
  <View style={[styles.verificationBadge, { width: size, height: size }]}>
    <MaterialIcons name="verified" size={size * 0.9} color={COLORS.verified} />
  </View>
);

export default function RechercheAvancee() {
  const router = useRouter();
  
  // Références
  const scrollY = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);
  const flatListRef = useRef<FlatList>(null);

  // États de recherche
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isVoiceSearch, setIsVoiceSearch] = useState(false);

  // Données
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<{term: string, count: number}[]>([]);
  const [popularCategories, setPopularCategories] = useState<{name: string, count: number, icon: string}[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Filtres
  const [filters, setFilters] = useState<FilterState>({
    category: "",
    minPrice: "",
    maxPrice: "",
    condition: "",
    location: "",
    sortBy: 'relevance',
    inStock: true,
    deliveryAvailable: false,
    pickupAvailable: false,
    includeShops: true,
  });

  // UI States
  const [loading, setLoading] = useState(false);
  const [loadingShops, setLoadingShops] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modals
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // ===========================================
  // 🌟 INITIALISATION
  // ===========================================

  useEffect(() => {
    initializeApp();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const initializeApp = async () => {
    try {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();

      await Promise.all([
        loadSearchHistory(),
        loadUserPreferences(),
        fetchTrendingData(),
        getLocation(),
      ]);
    } catch (error) {
      console.error('Erreur initialisation:', error);
    }
  };

  // ===========================================
  // 📍 LOCALISATION
  // ===========================================

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Erreur localisation:', error);
    }
  };

  // ===========================================
  // 💾 STOCKAGE LOCAL
  // ===========================================

  const loadSearchHistory = async () => {
    try {
      const history = await AsyncStorage.getItem("shopnet_search_history_white");
      if (history) {
        setSearchHistory(JSON.parse(history).slice(0, 10));
      }
    } catch (error) {
      console.error("Erreur chargement historique:", error);
    }
  };

  const saveSearchHistory = async (query: string) => {
    if (!query.trim()) return;

    try {
      const updatedHistory = [
        query.trim(),
        ...searchHistory.filter(item => 
          item.toLowerCase() !== query.trim().toLowerCase()
        )
      ].slice(0, 10);

      setSearchHistory(updatedHistory);
      await AsyncStorage.setItem(
        "shopnet_search_history_white",
        JSON.stringify(updatedHistory)
      );
    } catch (error) {
      console.error("Erreur sauvegarde historique:", error);
    }
  };

  const clearSearchHistory = async () => {
    Alert.alert(
      "Effacer l'historique",
      "Êtes-vous sûr de vouloir effacer tout l'historique de recherche ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Effacer",
          style: "destructive",
          onPress: async () => {
            setSearchHistory([]);
            await AsyncStorage.removeItem("shopnet_search_history_white");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        }
      ]
    );
  };

  const loadUserPreferences = async () => {
    try {
      const prefs = await AsyncStorage.getItem("shopnet_search_preferences_white");
      if (prefs) {
        setFilters(JSON.parse(prefs));
      }
    } catch (error) {
      console.error("Erreur chargement préférences:", error);
    }
  };

  const saveUserPreferences = async () => {
    try {
      await AsyncStorage.setItem(
        "shopnet_search_preferences_white",
        JSON.stringify(filters)
      );
    } catch (error) {
      console.error("Erreur sauvegarde préférences:", error);
    }
  };

  // ===========================================
  // 📊 DONNÉES TRENDINGS
  // ===========================================

  const fetchTrendingData = async () => {
    try {
      setTrendingSearches([
        { term: "iPhone 15", count: 1250 },
        { term: "Chaussures running", count: 890 },
        { term: "PC Gamer", count: 750 },
        { term: "Parfum homme", count: 620 },
        { term: "Tablette Samsung", count: 580 },
      ]);

      setPopularCategories([
        { name: "Électronique", count: 1250, icon: "phone-portrait" },
        { name: "Mode", count: 890, icon: "shirt" },
        { name: "Maison", count: 750, icon: "home" },
        { name: "Sport", count: 620, icon: "basketball" },
        { name: "Beauté", count: 580, icon: "sparkles" },
        { name: "Auto", count: 450, icon: "car" },
      ]);
    } catch (error) {
      console.error("Erreur chargement tendances:", error);
    }
  };

  // ===========================================
  // 🔍 RECHERCHE BOUTIQUES PROCHES
  // ===========================================

  const fetchNearbyShops = async (query: string) => {
    if (!filters.includeShops || !userLocation) return;

    try {
      setLoadingShops(true);
      const url = `${API_BASE_URL}/boutique/premium/discover/nearby?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}&radius=15`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        let filteredShops = data.shops || [];
        if (query.trim()) {
          filteredShops = filteredShops.filter((shop: Shop) =>
            shop.nom.toLowerCase().includes(query.toLowerCase())
          );
        }
        setShops(filteredShops.slice(0, 5));
      }
    } catch (error) {
      console.error('Erreur chargement boutiques:', error);
    } finally {
      setLoadingShops(false);
    }
  };

  // ===========================================
  // 🔍 RECHERCHE PRINCIPALE
  // ===========================================

  const handleSearch = async (query: string, reset = true) => {
    if (!query.trim()) return;

    try {
      if (reset) {
        setIsSearching(true);
        setError(null);
        setPage(1);
        setHasMore(true);
        setProducts([]);
        setShops([]);
      } else {
        setLoading(true);
      }

      setShowSuggestions(false);
      Keyboard.dismiss();

      const currentPage = reset ? 1 : page;

      await fetchNearbyShops(query);

      const params = new URLSearchParams();
      params.append('q', query.trim());
      params.append('page', currentPage.toString());
      params.append('limit', '5');
      params.append('sort_by', filters.sortBy);

      if (filters.category) params.append('category', filters.category);
      if (filters.minPrice) params.append('min_price', filters.minPrice);
      if (filters.maxPrice) params.append('max_price', filters.maxPrice);
      if (filters.condition) params.append('condition', filters.condition);
      if (filters.location) params.append('location', filters.location);
      if (filters.inStock) params.append('in_stock', 'true');

      const url = `${API_BASE_URL}/search/search?${params.toString()}`;
      const response = await fetch(url, { timeout: 10000 });
      const data = await response.json();

      if (data.success) {
        const { results, total, page: currentPage, total_pages } = data.data;

        const processedResults = results.map((product: any) => ({
          ...product,
          images: processImages(product.images),
          views: product.views || product.views_count || 0,
          likes: product.likes || product.likes_count || 0,
          shares: product.shares || product.shares_count || 0,
        }));

        if (reset) {
          setProducts(processedResults);
        } else {
          setProducts(prev => [...prev, ...processedResults]);
        }

        setHasMore(currentPage < total_pages);
        setPage(currentPage + 1);

        await saveSearchHistory(query);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      console.error('❌ Erreur recherche:', error);
      
      let errorMessage = "Erreur lors de la recherche";
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        errorMessage = "La recherche a pris trop de temps";
      } else if (error.message?.includes('404')) {
        errorMessage = "Service de recherche indisponible";
      }
      
      setError(errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSearching(false);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const processImages = (images: string | string[] | undefined): string[] => {
    if (!images) return ['https://via.placeholder.com/150'];
    if (Array.isArray(images)) {
      return images.filter(img => img && img.trim() !== '');
    }
    if (typeof images === 'string') {
      return images.split(',').filter(img => img && img.trim() !== '');
    }
    return ['https://via.placeholder.com/150'];
  };

  // ===========================================
  // 🔤 AUTOCOMPLÉTION
  // ===========================================

  const fetchAutocompleteSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSearchSuggestions([]);
      return;
    }

    try {
      const url = `${API_BASE_URL}/search/autocomplete?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, { timeout: 5000 });
      const data = await response.json();

      const suggestions: SearchSuggestion[] = [];

      if (data.suggestions) {
        data.suggestions.forEach((suggestion: string) => {
          suggestions.push({ type: 'popular', title: suggestion });
        });
      }

      if (data.products) {
        data.products.forEach((product: any) => {
          suggestions.push({
            type: 'product',
            id: product.id.toString(),
            title: product.title,
            subtitle: `${formatPrice(product.price)} • ${product.category}`,
            image: product.thumbnail,
          });
        });
      }

      if (data.categories) {
        data.categories.forEach((category: any) => {
          suggestions.push({
            type: 'category',
            id: category.name,
            title: category.name,
            subtitle: `${category.product_count || category.count} produits`,
          });
        });
      }

      if (userLocation && filters.includeShops) {
        const shopsUrl = `${API_BASE_URL}/boutique/premium/discover/nearby?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}&radius=15`;
        const shopsResponse = await fetch(shopsUrl);
        const shopsData = await shopsResponse.json();
        
        if (shopsData.success) {
          const matchingShops = shopsData.shops
            .filter((shop: Shop) => shop.nom.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 3);
          
          matchingShops.forEach((shop: Shop) => {
            suggestions.push({
              type: 'shop',
              id: shop.id.toString(),
              title: shop.nom,
              subtitle: `Boutique • ${shop.distance.toFixed(1)} km`,
              image: shop.logo,
            });
          });
        }
      }

      const matchingHistory = searchHistory.filter(term =>
        term.toLowerCase().includes(query.toLowerCase())
      );
      matchingHistory.forEach(term => {
        suggestions.push({ type: 'history', title: term });
      });

      setSearchSuggestions(suggestions.slice(0, 10));
      setShowSuggestions(true);
    } catch (error) {
      console.error('Erreur autocomplete:', error);
    }
  };

  // ===========================================
  // 🎤 RECHERCHE VOCALE
  // ===========================================

  const startVoiceSearch = () => {
    setShowVoiceModal(true);
    setIsVoiceSearch(true);
    setTimeout(() => {
      const simulatedQuery = "téléphone samsung neuf";
      setSearchQuery(simulatedQuery);
      handleSearch(simulatedQuery, true);
      setShowVoiceModal(false);
      setIsVoiceSearch(false);
    }, 2000);
  };

  // ===========================================
  // 🎯 NAVIGATION
  // ===========================================

  const navigateToProduct = (product: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isMountedRef.current && product && product.id) {
      router.push({
        pathname: "/Auth/Panier/DetailId",
        params: { id: product.id.toString() }
      });
    }
  };

  const navigateToShop = (shopId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/ShopDetail?id=${shopId}`);
  };

  const navigateToCategory = (category: string) => {
    setFilters(prev => ({ ...prev, category }));
    setSearchQuery(category);
    handleSearch(category, true);
  };

  // ===========================================
  // 🎨 FORMATAGE
  // ===========================================

  const formatPrice = (price: any): string => {
    if (price === undefined || price === null) return "0.00";
    const priceNumber = typeof price === 'number' ? price : parseFloat(price);
    if (isNaN(priceNumber)) return "0.00";
    return `$${priceNumber.toFixed(2)}`;
  };

  const formatRating = (rating: any): string => {
    if (rating === undefined || rating === null) return "0.0";
    const ratingNumber = typeof rating === 'number' ? rating : parseFloat(rating);
    if (isNaN(ratingNumber)) return "0.0";
    return ratingNumber.toFixed(1);
  };

  const formatStock = (stock: any): number => {
    if (stock === undefined || stock === null) return 0;
    const stockNumber = typeof stock === 'number' ? stock : parseInt(stock, 10);
    if (isNaN(stockNumber)) return 0;
    return stockNumber;
  };

  // ===========================================
  // 🔄 INFINITE SCROLL
  // ===========================================

  const handleLoadMore = () => {
    if (!loading && hasMore && searchQuery.length > 0) {
      handleSearch(searchQuery, false);
    }
  };

  // ===========================================
  // 🎨 ICÔNES ET COULEURS CATÉGORIES
  // ===========================================

  const getCategoryIcon = (category: string) => {
    const icons: {[key: string]: string} = {
      'Électronique': 'phone-portrait',
      'Mode': 'shirt',
      'Maison': 'home',
      'Sport': 'basketball',
      'Beauté': 'sparkles',
      'Auto': 'car',
      'default': 'cube',
    };
    return icons[category] || icons.default;
  };

  const getCategoryColor = (category: string) => {
    const colors: {[key: string]: string} = {
      'Électronique': '#F44336',
      'Mode': '#5856D6',
      'Maison': '#FF9500',
      'Sport': '#4CAF50',
      'Beauté': '#FF2D55',
      'Auto': '#0A68B4',
      'default': COLORS.accent,
    };
    return colors[category] || colors.default;
  };

  // ===========================================
  // 🎨 RENDU HEADER
  // ===========================================

  const renderHeader = () => (
    <Animated.View style={[styles.header, { 
      backgroundColor: COLORS.headerBg,
      borderBottomColor: COLORS.border,
      borderBottomWidth: 0.5
    }]}>
      <View style={styles.headerContent}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: COLORS.text }]}>
            Recherche
          </Text>
          <TouchableOpacity
            style={styles.analyticsButton}
            onPress={() => setShowAnalytics(true)}
          >
            <Ionicons name="stats-chart" size={22} color={COLORS.accent} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={[styles.searchInputWrapper, { 
            backgroundColor: COLORS.accentLight,
            borderColor: COLORS.border 
          }]}>
            <Ionicons name="search" size={22} color={COLORS.accent} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, { color: COLORS.text }]}
              placeholder="Rechercher des produits ou boutiques..."
              placeholderTextColor={COLORS.textSecondary}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (text.length >= 2) {
                  fetchAutocompleteSuggestions(text);
                } else {
                  setShowSuggestions(false);
                }
              }}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => handleSearch(searchQuery, true)}
              onFocus={() => setShowSuggestions(true)}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setProducts([]);
                  setShops([]);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={22} color={COLORS.error} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={startVoiceSearch}
              style={styles.voiceButton}
              disabled={isVoiceSearch}
            >
              {isVoiceSearch ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : (
                <Ionicons name="mic" size={22} color={COLORS.accent} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  // ===========================================
  // 🎨 RENDU SUGGESTIONS
  // ===========================================

  const renderSuggestions = () => {
    if (!showSuggestions || searchSuggestions.length === 0) return null;

    return (
      <View style={[styles.suggestionsContainer, {
        backgroundColor: COLORS.card,
        borderColor: COLORS.border
      }]}>
        <FlatList
          data={searchSuggestions}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.suggestionItem}
              onPress={() => {
                setSearchQuery(item.title);
                if (item.type === 'shop') {
                  navigateToShop(parseInt(item.id!));
                } else {
                  handleSearch(item.title, true);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.suggestionIcon, { backgroundColor: COLORS.accentLight }]}>
                {item.type === 'history' && <Ionicons name="time" size={18} color={COLORS.textSecondary} />}
                {item.type === 'product' && <Ionicons name="cube" size={18} color={COLORS.accent} />}
                {item.type === 'category' && <MaterialIcons name="category" size={18} color={COLORS.success} />}
                {item.type === 'popular' && <Ionicons name="trending-up" size={18} color={COLORS.warning} />}
                {item.type === 'shop' && <Ionicons name="storefront" size={18} color={COLORS.verified} />}
              </View>
              <View style={styles.suggestionContent}>
                <Text style={[styles.suggestionTitle, { color: COLORS.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.subtitle && (
                  <Text style={[styles.suggestionSubtitle, { color: COLORS.textSecondary }]} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListHeaderComponent={
            <View style={[styles.suggestionsHeader, { borderBottomColor: COLORS.border }]}>
              <Text style={[styles.suggestionsTitle, { color: COLORS.textSecondary }]}>
                Suggestions
              </Text>
              {searchHistory.length > 0 && (
                <TouchableOpacity onPress={clearSearchHistory}>
                  <Text style={[styles.clearHistoryText, { color: COLORS.error }]}>
                    Effacer historique
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      </View>
    );
  };

  // ===========================================
  // 🎨 RENDU BOUTIQUES
  // ===========================================

  const renderShopsSection = () => {
    if (shops.length === 0) return null;

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="storefront" size={20} color={COLORS.accent} />
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              Boutiques
            </Text>
          </View>
          <Text style={[styles.sectionCount, { color: COLORS.textSecondary }]}>
            {shops.length} résultat{shops.length > 1 ? 's' : ''}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shopsScrollContent}>
          {shops.map(shop => (
            <TouchableOpacity
              key={shop.id}
              style={[styles.shopItem, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
              onPress={() => navigateToShop(shop.id)}
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

  // ===========================================
  // 🎨 RENDU HISTORIQUE
  // ===========================================

  const renderSearchHistory = () => {
    if (searchQuery.length > 0 || searchHistory.length === 0) return null;

    return (
      <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="time" size={20} color={COLORS.textSecondary} />
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              Historique récent
            </Text>
          </View>
          <TouchableOpacity onPress={clearSearchHistory}>
            <Text style={[styles.clearAllText, { color: COLORS.error }]}>
              Tout effacer
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {searchHistory.map((term, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.historyChip, { 
                backgroundColor: COLORS.accentLight,
                borderColor: COLORS.border 
              }]}
              onPress={() => {
                setSearchQuery(term);
                handleSearch(term, true);
              }}
            >
              <Ionicons name="search" size={14} color={COLORS.accent} />
              <Text style={[styles.historyText, { color: COLORS.accent }]} numberOfLines={1}>
                {term}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    );
  };

  // ===========================================
  // 🎨 RENDU TENDANCES
  // ===========================================

  const renderTrendingSearches = () => {
    if (searchQuery.length > 0) return null;

    return (
      <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="trending-up" size={20} color={COLORS.accent} />
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              Tendances du jour
            </Text>
          </View>
        </View>
        <View style={[styles.trendingContainer, { 
          backgroundColor: COLORS.card,
          borderColor: COLORS.border 
        }]}>
          {trendingSearches.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.trendingCard}
              onPress={() => {
                setSearchQuery(item.term);
                handleSearch(item.term, true);
              }}
            >
              <View style={styles.trendingContent}>
                <View style={styles.trendingLeft}>
                  <Text style={[styles.trendingRank, { color: COLORS.accent }]}>
                    #{index + 1}
                  </Text>
                  <View style={styles.trendingTextContainer}>
                    <Text style={[styles.trendingTerm, { color: COLORS.text }]} numberOfLines={1}>
                      {item.term}
                    </Text>
                    <Text style={[styles.trendingCount, { color: COLORS.textSecondary }]}>
                      {item.count} recherches
                    </Text>
                  </View>
                </View>
                <Ionicons name="trending-up" size={20} color={COLORS.accent} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    );
  };

  // ===========================================
  // 🎨 RENDU CATÉGORIES POPULAIRES (2 PAR LIGNE - STYLE ORIGINAL)
  // ===========================================

  const renderPopularCategories = () => {
    if (searchQuery.length > 0) return null;

    return (
      <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="apps" size={20} color={COLORS.accent} />
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
              Catégories populaires
            </Text>
          </View>
        </View>
        {/* IMPORTANT: Structure identique à ton code qui fonctionne */}
        <View style={styles.categoriesContainer}>
          {popularCategories.map((category, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.categoryCard, { 
                backgroundColor: COLORS.card,
                borderColor: COLORS.border 
              }]}
              onPress={() => navigateToCategory(category.name)}
            >
              <View style={[styles.categoryIconContainer, { backgroundColor: getCategoryColor(category.name) }]}>
                <Ionicons 
                  name={getCategoryIcon(category.name)} 
                  size={24} 
                  color="#FFF" 
                />
              </View>
              <Text style={[styles.categoryName, { color: COLORS.text }]} numberOfLines={1}>
                {category.name}
              </Text>
              <Text style={[styles.categoryCount, { color: COLORS.textSecondary }]}>
                {category.count} produits
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    );
  };

  // ===========================================
  // 🎨 RENDU FILTRES ACTIFS
  // ===========================================

  const renderActiveFilters = () => {
    const activeFiltersCount = Object.values(filters).filter(
      value => value !== '' && value !== false && value !== 'relevance'
    ).length;

    if (activeFiltersCount === 0) return null;

    return (
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterChip, { 
              backgroundColor: COLORS.card,
              borderColor: COLORS.accent 
            }]}
            onPress={() => setShowFiltersModal(true)}
          >
            <Ionicons name="filter" size={16} color={COLORS.accent} />
            <Text style={[styles.filterChipText, { color: COLORS.accent }]}>
              Filtres ({activeFiltersCount})
            </Text>
          </TouchableOpacity>

          {filters.category && (
            <TouchableOpacity
              style={[styles.activeFilter, { backgroundColor: COLORS.accent }]}
              onPress={() => setFilters({...filters, category: ''})}
            >
              <Text style={styles.activeFilterText}>{filters.category}</Text>
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          )}

          {filters.location && (
            <TouchableOpacity
              style={[styles.activeFilter, { backgroundColor: COLORS.accent }]}
              onPress={() => setFilters({...filters, location: ''})}
            >
              <Text style={styles.activeFilterText}>{filters.location}</Text>
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  };

  // ===========================================
  // 🎨 RENDU PRODUIT
  // ===========================================

  const renderProductItem = ({ item, index }: { item: Product, index: number }) => {
    const price = formatPrice(item.price);
    const originalPrice = item.original_price ? formatPrice(item.original_price) : null;
    const discount = item.original_price && item.original_price > item.price 
      ? Math.round(((item.original_price - item.price) / item.original_price) * 100)
      : 0;
    
    const stock = formatStock(item.stock);
    const sellerRating = formatRating(item.seller_rating);
    const sellerName = item.seller_name || "Vendeur";
    const location = item.location || "Non spécifié";
    
    const images = processImages(item.images);
    const mainImage = images.length > 0 ? images[0] : 'https://via.placeholder.com/150';

    return (
      <TouchableOpacity
        style={[styles.productCard, { 
          backgroundColor: COLORS.card,
          borderColor: COLORS.border 
        }]}
        onPress={() => navigateToProduct(item)}
        activeOpacity={0.9}
      >
        <View style={styles.productImageContainer}>
          <Image
            source={{ uri: mainImage }}
            style={styles.productImage}
            resizeMode="cover"
          />
          
          {discount > 0 && (
            <View style={[styles.discountBadge, { backgroundColor: COLORS.error }]}>
              <Text style={styles.discountText}>-{discount}%</Text>
            </View>
          )}
          
          {item.condition === 'neuf' && (
            <View style={[styles.conditionBadge, { backgroundColor: COLORS.success }]}>
              <Text style={styles.conditionText}>NEUF</Text>
            </View>
          )}

          {item.delivery_available && (
            <View style={[styles.deliveryBadge, { backgroundColor: COLORS.accent }]}>
              <Ionicons name="rocket" size={12} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.productContent}>
          <Text style={[styles.productTitle, { color: COLORS.text }]} numberOfLines={2}>
            {item.title || "Produit sans nom"}
          </Text>
          
          <Text style={[styles.productCategory, { color: COLORS.textSecondary }]} numberOfLines={1}>
            {item.category || "Non catégorisé"}
          </Text>

          <View style={styles.priceContainer}>
            <Text style={[styles.price, { color: COLORS.error }]}>{price}</Text>
            {originalPrice && (
              <Text style={[styles.originalPrice, { color: COLORS.textSecondary }]}>
                {originalPrice}
              </Text>
            )}
          </View>

          <View style={styles.sellerContainer}>
            <Text style={[styles.sellerName, { color: COLORS.textSecondary }]} numberOfLines={1}>
              {sellerName}
            </Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={12} color={COLORS.gold} />
              <Text style={[styles.ratingText, { color: COLORS.gold }]}>
                {sellerRating}
              </Text>
            </View>
          </View>

          <View style={styles.productFooter}>
            <View style={styles.locationContainer}>
              <Ionicons name="location" size={12} color={COLORS.textSecondary} />
              <Text style={[styles.locationText, { color: COLORS.textSecondary }]}>
                {location}
              </Text>
            </View>
            
            {stock > 0 ? (
              <Text style={[styles.inStockText, { color: COLORS.success }]}>En stock</Text>
            ) : (
              <Text style={[styles.outOfStockText, { color: COLORS.error }]}>Rupture</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ===========================================
  // 🎨 RENDU LISTE PRINCIPALE
  // ===========================================

  const renderMainList = () => {
    if (isSearching && products.length === 0 && shops.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={[styles.loadingText, { color: COLORS.accent }]}>
            Recherche en cours...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color={COLORS.error} />
          <Text style={[styles.errorTitle, { color: COLORS.text }]}>Erreur</Text>
          <Text style={[styles.errorMessage, { color: COLORS.textSecondary }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: COLORS.accent }]}
            onPress={() => handleSearch(searchQuery, true)}
          >
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        ref={flatListRef}
        data={products}
        renderItem={renderProductItem}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        numColumns={2}
        columnWrapperStyle={styles.productRow}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            {renderShopsSection()}
            {renderSearchHistory()}
            {renderTrendingSearches()}
            {renderPopularCategories()}
            {renderActiveFilters()}
            
            {searchQuery.length > 0 && (products.length > 0 || shops.length > 0) && (
              <View style={styles.resultsHeader}>
                <Text style={[styles.resultsCount, { color: COLORS.textSecondary }]}>
                  {products.length + shops.length} résultat{(products.length + shops.length) > 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  style={[styles.sortButton, { 
                    backgroundColor: COLORS.card,
                    borderColor: COLORS.border 
                  }]}
                  onPress={() => setShowFiltersModal(true)}
                >
                  <Text style={[styles.sortButtonText, { color: COLORS.accent }]}>
                    Trier: {filters.sortBy}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.accent} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          loading ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={[styles.loadingText, { color: COLORS.accent }]}>
                Chargement...
              </Text>
            </View>
          ) : !hasMore && products.length > 0 ? (
            <View style={styles.endOfResults}>
              <Text style={[styles.endOfResultsText, { color: COLORS.textSecondary }]}>
                Fin des résultats
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          searchQuery.length > 0 && !isSearching && products.length === 0 && shops.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={80} color={COLORS.accent} />
              <Text style={[styles.emptyTitle, { color: COLORS.text }]}>
                Aucun résultat pour "{searchQuery}"
              </Text>
              <Text style={[styles.emptySubtitle, { color: COLORS.textSecondary }]}>
                Essayez d'autres mots-clés ou modifiez vos filtres
              </Text>
            </View>
          ) : null
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => handleSearch(searchQuery, true)}
            colors={[COLORS.accent]}
            tintColor={COLORS.accent}
          />
        }
      />
    );
  };

  // ===========================================
  // 🎯 RENDU PRINCIPAL
  // ===========================================

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {renderHeader()}
      {renderSuggestions()}
      {renderMainList()}

      <Modal
        visible={showVoiceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVoiceModal(false)}
      >
        <BlurView intensity={90} style={styles.modalOverlay}>
          <View style={[styles.voiceModal, { 
            backgroundColor: COLORS.card,
            borderColor: COLORS.border 
          }]}>
            <View style={[styles.voiceAnimation, { backgroundColor: COLORS.accentLight }]}>
              <Ionicons name="mic" size={80} color={COLORS.accent} />
            </View>
            <Text style={[styles.voiceModalTitle, { color: COLORS.text }]}>
              Parlez maintenant...
            </Text>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: COLORS.error }]}
              onPress={() => setShowVoiceModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: COLORS.error }]}>
                Annuler
              </Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
}

// ===========================================
// 🎨 STYLES (FOND BLANC - CATÉGORIES 2 PAR LIGNE)
// ===========================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 120,
    paddingBottom: 20,
    paddingHorizontal: 12,
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 12,
  },
  headerContent: {
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  analyticsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Barre de recherche
  searchContainer: {
    marginBottom: 8,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  voiceButton: {
    padding: 4,
    marginLeft: 4,
  },

  // Suggestions
  suggestionsContainer: {
    position: 'absolute',
    top: 130,
    left: 16,
    right: 16,
    borderRadius: 12,
    maxHeight: 300,
    borderWidth: 1,
    zIndex: 99,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  clearHistoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  suggestionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },

  // Sections
  section: {
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Boutiques
  shopsScrollContent: {
    paddingHorizontal: 12,
    gap: 16,
  },
  shopItem: {
    alignItems: 'center',
    width: 90,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  shopAvatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
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

  // Historique
  historyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 1,
  },
  historyText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    maxWidth: 150,
  },

  // Tendances
  trendingContainer: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  trendingCard: {
    marginBottom: 12,
  },
  trendingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trendingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trendingRank: {
    fontSize: 16,
    fontWeight: '800',
    width: 30,
  },
  trendingTextContainer: {
    flex: 1,
  },
  trendingTerm: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  trendingCount: {
    fontSize: 14,
  },

  // ===== CATÉGORIES - 2 PAR LIGNE (STYLE ORIGINAL) =====
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  categoryCard: {
    width: (width - 48) / 2,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  categoryIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 14,
  },

  // Filtres
  filtersContainer: {
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  activeFilterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 6,
  },

  // Résultats
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },

  // Produits
  productRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productCard: {
    width: (width - 36) / 2,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  productImageContainer: {
    position: 'relative',
    width: '100%',
    height: 150,
  },
  productImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.border,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  discountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  conditionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  conditionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  deliveryBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productContent: {
    padding: 12,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 18,
  },
  productCategory: {
    fontSize: 12,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  sellerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sellerName: {
    flex: 1,
    fontSize: 12,
    marginRight: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '600',
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 11,
    marginLeft: 4,
  },
  inStockText: {
    fontSize: 11,
    fontWeight: '600',
  },
  outOfStockText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // États
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  endOfResults: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  endOfResultsText: {
    fontSize: 14,
  },

  // Modal vocal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceModal: {
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    minWidth: width * 0.8,
  },
  voiceAnimation: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  voiceModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
  },
  cancelButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});