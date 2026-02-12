

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
  Animated,
  Modal,
  SafeAreaView,
  StatusBar,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

// ========== CONSTANTES ==========
const { width } = Dimensions.get('window');
const LOCAL_API = 'https://shopnet-backend.onrender.com/api';
const ITEMS_PER_PAGE = 10;
const INITIAL_LIMIT = 50; // Pour alimenter les sections horizontales

// ========== PALETTE DE COULEURS (Mode sombre / clair) ==========
const LIGHT_THEME = {
  primary: '#00182A',
  background: '#F5F7FA',
  card: '#FFFFFF',
  text: '#1A2C3E',
  textSecondary: '#5A6B7A',
  accent: '#42A5F5',
  accentLight: '#E3F2FD',
  border: '#E0E7EF',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#FF6B6B',
  gold: '#FFD700',
  headerBg: '#FFFFFF',
  statusBar: 'dark-content',
};

const DARK_THEME = {
  primary: '#00182A',
  background: '#0A1420',
  card: '#1E2A3B',
  text: '#FFFFFF',
  textSecondary: '#A0AEC0',
  accent: '#42A5F5',
  accentLight: 'rgba(66, 165, 245, 0.1)',
  border: '#2C3A4A',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#FF6B6B',
  gold: '#FFD700',
  headerBg: '#00182A',
  statusBar: 'light-content',
};

// ========== TYPES ==========
type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  original_price: number | null;
  images: string[];
  likes: number;      // gardé pour le tri "populaire"
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

type FavoriteItem = {
  id: string;
  title: string;
  price: number;
  image: string;
  sellerName: string;
  addedAt: number;
};

// ========== GESTION DES FAVORIS (AsyncStorage) ==========
const FAVORITES_STORAGE_KEY = '@shopnet_favorites';

const getFavorites = async (): Promise<FavoriteItem[]> => {
  try {
    const data = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

const addFavorite = async (product: Product): Promise<void> => {
  try {
    const favorites = await getFavorites();
    if (!favorites.some(fav => fav.id === product.id)) {
      const newFav: FavoriteItem = {
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
  const [isDarkMode, setIsDarkMode] = useState(true);
  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;

  // États produits
  const [allProducts, setAllProducts] = useState<Product[]>([]); // Tous les produits chargés
  const [feedProducts, setFeedProducts] = useState<Product[]>([]); // Produits pour le feed principal (paginés)
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // États UI
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // ========== CHARGEMENT INITIAL ==========
  useEffect(() => {
    startEntranceAnimation();
    loadFavoritesCount();
    fetchInitialProducts();
  }, []);

  // Animation d'entrée
  const startEntranceAnimation = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  };

  // Charger le nombre de favoris
  const loadFavoritesCount = async () => {
    const favs = await getFavorites();
    setFavoritesCount(favs.length);
  };

  // ========== RÉCUPÉRATION DES PRODUITS (PUBLIC) ==========
  const fetchInitialProducts = async () => {
    try {
      setLoading(true);
      // Charger suffisamment de produits pour alimenter les sections horizontales
      const params = new URLSearchParams({ page: '1', limit: INITIAL_LIMIT.toString() });
      const response = await fetch(`${LOCAL_API}/products?${params}`);
      const data = await response.json();

      if (data.success) {
        let products = formatProducts(data.products || []);
        // Vérifier les favoris pour chaque produit
        for (let p of products) {
          p.isLiked = await isFavorite(p.id);
        }
        setAllProducts(products);
        // Pour le feed principal, on prend les 10 premiers (page 1)
        setFeedProducts(products.slice(0, ITEMS_PER_PAGE));
        setPage(1);
        setHasMore(data.totalPages > 1);
      }
    } catch (error) {
      console.error('Erreur chargement initial:', error);
    } finally {
      setLoading(false);
    }
  };

  // Chargement supplémentaire (pagination infinie pour le feed)
  const loadMoreProducts = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const params = new URLSearchParams({ page: nextPage.toString(), limit: ITEMS_PER_PAGE.toString() });
      const response = await fetch(`${LOCAL_API}/products?${params}`);
      const data = await response.json();

      if (data.success) {
        let newProducts = formatProducts(data.products || []);
        for (let p of newProducts) {
          p.isLiked = await isFavorite(p.id);
        }
        setAllProducts(prev => [...prev, ...newProducts]);
        setFeedProducts(prev => [...prev, ...newProducts]);
        setPage(nextPage);
        setHasMore(data.totalPages > nextPage);
      }
    } catch (error) {
      console.error('Erreur chargement supplémentaire:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Rafraîchissement avec mélange
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: INITIAL_LIMIT.toString() });
      const response = await fetch(`${LOCAL_API}/products?${params}`);
      const data = await response.json();
      if (data.success) {
        let products = formatProducts(data.products || []);
        // Mélanger
        products = shuffleArray(products);
        for (let p of products) {
          p.isLiked = await isFavorite(p.id);
        }
        setAllProducts(products);
        setFeedProducts(products.slice(0, ITEMS_PER_PAGE));
        setPage(1);
        setHasMore(data.totalPages > 1);
      }
    } catch (error) {
      console.error('Erreur refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Formater les produits reçus du backend
  const formatProducts = (rawProducts: any[]): Product[] => {
    return rawProducts.map(p => ({
      ...p,
      images: Array.isArray(p.image_urls) ? p.image_urls : [],
      isPromotion: Boolean(p.isPromotion || p.is_boosted),
      is_boosted: Boolean(p.is_boosted),
      location: p.location || p.seller?.city || 'Ville inconnue',
      price: Number(p.price),
      original_price: p.original_price ? Number(p.original_price) : null,
      seller: {
        id: p.seller?.id?.toString() || '',
        name: p.seller?.name || 'Vendeur inconnu',
        avatar: p.seller?.avatar || null,
        city: p.seller?.city || null,
      },
    }));
  };

  // Mélange aléatoire
  const shuffleArray = (array: Product[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // ========== GESTION FAVORIS ==========
  const toggleFavorite = async (product: Product) => {
    const isFav = await isFavorite(product.id);
    if (isFav) {
      await removeFavorite(product.id);
      Alert.alert('❤️ Retiré des favoris');
    } else {
      await addFavorite(product);
      Alert.alert('❤️ Ajouté aux favoris');
    }
    // Mettre à jour l'état local
    setAllProducts(prev =>
      prev.map(p => (p.id === product.id ? { ...p, isLiked: !isFav } : p))
    );
    setFeedProducts(prev =>
      prev.map(p => (p.id === product.id ? { ...p, isLiked: !isFav } : p))
    );
    await loadFavoritesCount();
  };

  // ========== ACTIONS HEADER ==========
  const handleSearch = () => router.push('/(tabs)/SearchScreen');
  const handleFavorites = () => router.push('/(tabs)/FavoritesScreen');
  const handleSort = () => Alert.alert('Tri', 'Fonctionnalité à venir');
  const handleShop = () => Alert.alert('Boutique', 'Boutiques proches à venir');
  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // ========== ACTIONS PRODUIT ==========
  const goToDetail = (product: Product) => {
    router.push({
      pathname: '/(tabs)/ProductDetail',
      params: { product: JSON.stringify(product) },
    });
  };

  const contactWhatsApp = (product: Product) => {
    const phone = product.seller?.phone || '+243896037137';
    const msg = `Bonjour ${product.seller?.name}, je suis intéressé par "${product.title}" sur SHOPNET.`;
    Linking.openURL(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`);
  };

  const contactEmail = (product: Product) => {
    const email = product.seller?.email || 'vendeur@shopnet.com';
    const subject = `Demande: ${product.title}`;
    const body = `Bonjour,\n\nJe suis intéressé par "${product.title}" à ${product.price}€.\n\nCordialement.`;
    Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  // ========== RENDU D'UNE CARTE PRODUIT (standard) ==========
  const renderProductCard = (item: Product, index: number, cardWidth?: number) => {
    const discount = item.original_price
      ? Math.round(((item.original_price - item.price) / item.original_price) * 100)
      : 0;
    const imageUrl = item.images?.length > 0 ? item.images[0] : null;
    const width = cardWidth || (width - 36) / 2;

    return (
      <Animated.View
        key={`${item.id}-${index}`}
        style={[
          styles.productCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            width,
          },
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <TouchableOpacity activeOpacity={0.95} onPress={() => goToDetail(item)}>
          {/* Image */}
          <View style={styles.imageContainer}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: theme.border }]}>
                <Ionicons name="cube-outline" size={30} color={theme.textSecondary} />
              </View>
            )}

            {/* Badges */}
            <View style={styles.badgeContainer}>
              {item.isPromotion && (
                <View style={[styles.badge, { backgroundColor: theme.gold }]}>
                  <Ionicons name="flash" size={10} color={theme.primary} />
                  <Text style={[styles.badgeText, { color: theme.primary }]}>PROMO</Text>
                </View>
              )}
              {item.is_boosted && !item.isPromotion && (
                <View style={[styles.badge, { backgroundColor: theme.success }]}>
                  <Ionicons name="rocket" size={10} color="#fff" />
                  <Text style={[styles.badgeText, { color: '#fff' }]}>BOOSTÉ</Text>
                </View>
              )}
              {discount > 0 && (
                <View style={[styles.discountBadge, { backgroundColor: theme.error }]}>
                  <Text style={styles.discountText}>-{discount}%</Text>
                </View>
              )}
            </View>

            {/* Cœur favori */}
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={(e) => { e.stopPropagation(); toggleFavorite(item); }}
            >
              <Ionicons
                name={item.isLiked ? 'heart' : 'heart-outline'}
                size={18}
                color={item.isLiked ? theme.error : '#fff'}
              />
            </TouchableOpacity>
          </View>

          {/* Infos produit */}
          <View style={styles.cardContent}>
            <Text style={[styles.productTitle, { color: theme.text }]} numberOfLines={2}>
              {item.title}
            </Text>

            {/* Vendeur + ville */}
            <View style={styles.sellerRow}>
              {item.seller?.avatar ? (
                <Image source={{ uri: item.seller.avatar }} style={styles.sellerAvatar} />
              ) : (
                <View style={[styles.sellerAvatar, styles.sellerAvatarPlaceholder, { backgroundColor: theme.border }]}>
                  <Ionicons name="person" size={12} color={theme.textSecondary} />
                </View>
              )}
              <Text style={[styles.sellerName, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.seller?.name}
              </Text>
            </View>

            {/* Prix */}
            <View style={styles.priceRow}>
              {item.original_price ? (
                <View style={styles.priceContainer}>
                  <Text style={[styles.originalPrice, { color: theme.textSecondary }]}>
                    ${item.original_price.toFixed(2)}
                  </Text>
                  <Text style={[styles.promoPrice, { color: theme.gold }]}>
                    ${item.price.toFixed(2)}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.regularPrice, { color: theme.accent }]}>
                  ${item.price.toFixed(2)}
                </Text>
              )}
            </View>

            {/* Localisation */}
            {item.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={10} color={theme.textSecondary} />
                <Text style={[styles.locationText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {item.location}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ========== SECTIONS HORIZONTALES ==========
  const renderHorizontalSection = (title: string, products: Product[], cardWidth: number, seeAllRoute?: string) => {
    if (products.length === 0) return null;
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
          {seeAllRoute && (
            <TouchableOpacity onPress={() => router.push(seeAllRoute)}>
              <Text style={[styles.seeAllText, { color: theme.accent }]}>Voir tout</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScrollContent}
        >
          {products.map((item, idx) => renderProductCard(item, idx, cardWidth))}
        </ScrollView>
      </View>
    );
  };

  // ========== SECTIONS DE SUGGESTIONS (messages cliquables) ==========
  const renderSuggestions = () => {
    const suggestions = [
      { id: '1', icon: 'flash', text: 'Nouveaux produits boostés 🔥', color: theme.gold },
      { id: '2', icon: 'pricetag', text: 'Offres flash -50%', color: theme.error },
      { id: '3', icon: 'star', text: 'Vendeurs vérifiés', color: theme.success },
      { id: '4', icon: 'trending-up', text: 'Tendances du moment', color: theme.accent },
    ];
    return (
      <View style={styles.suggestionsContainer}>
        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 12 }]}>Suggestions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {suggestions.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.suggestionChip, { backgroundColor: theme.accentLight }]}
              onPress={() => Alert.alert('Suggestion', s.text)}
            >
              <Ionicons name={s.icon as any} size={16} color={s.color} />
              <Text style={[styles.suggestionText, { color: theme.text }]}>{s.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // ========== EN-TÊTE FIXE ==========
  const renderFixedHeader = () => (
    <View style={[styles.fixedHeader, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
      <View style={styles.headerLeft}>
        <TouchableOpacity onPress={() => router.push('/(tabs)')}>
          <Ionicons name="cube-outline" size={28} color={theme.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : theme.primary }]}>SHOPNET Deals</Text>
      </View>

      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.iconButton} onPress={handleSearch}>
          <Ionicons name="search-outline" size={22} color={theme.accent} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={handleFavorites}>
          <Ionicons name="heart-outline" size={22} color={theme.accent} />
          {favoritesCount > 0 && (
            <View style={styles.badgeIcon}>
              <Text style={styles.badgeIconText}>{favoritesCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={handleSort}>
          <Ionicons name="options-outline" size={22} color={theme.accent} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={handleShop}>
          <Ionicons name="storefront-outline" size={22} color={theme.accent} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconButton, styles.themeButton]} onPress={toggleTheme}>
          <Ionicons name={isDarkMode ? 'sunny-outline' : 'moon-outline'} size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ========== LISTE PRINCIPALE (AVEC SECTIONS) ==========
  const renderListHeader = () => {
    // Filtrer les produits pour les sections
    const boosted = allProducts.filter(p => p.is_boosted).slice(0, 10);
    const promos = allProducts.filter(p => p.isPromotion).slice(0, 10);
    const popular = [...allProducts].sort((a, b) => b.likes - a.likes).slice(0, 10);

    return (
      <View style={styles.listHeaderContainer}>
        {/* Section Boostés */}
        {renderHorizontalSection('🔥 Produits Boostés', boosted, 160, '/boosted')}

        {/* Section Meilleures offres */}
        {renderHorizontalSection('💰 Meilleures offres', promos, (width - 48) / 3, '/promos')}

        {/* Section Plus populaires */}
        {renderHorizontalSection('📈 Les plus populaires', popular, (width - 32) / 2, '/popular')}

        {/* Suggestions */}
        {renderSuggestions()}

        {/* Séparateur */}
        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {/* Titre du feed */}
        <Text style={[styles.feedTitle, { color: theme.text }]}>Recommandations pour vous</Text>
      </View>
    );
  };

  // ========== MODAL D'ACTIONS ==========
  const renderActionModal = () => (
    <Modal visible={actionModalVisible} transparent animationType="fade" onRequestClose={() => setActionModalVisible(false)}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionModalVisible(false)}>
        <View style={[styles.actionModal, { backgroundColor: theme.card }]}>
          {selectedProduct && (
            <>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Options</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                  {selectedProduct.title}
                </Text>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalAction} onPress={() => { setActionModalVisible(false); goToDetail(selectedProduct); }}>
                  <Ionicons name="eye-outline" size={24} color={theme.accent} />
                  <Text style={[styles.modalActionText, { color: theme.text }]}>Voir détails</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalAction} onPress={() => { setActionModalVisible(false); contactWhatsApp(selectedProduct); }}>
                  <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                  <Text style={[styles.modalActionText, { color: theme.text }]}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalAction} onPress={() => { setActionModalVisible(false); contactEmail(selectedProduct); }}>
                  <Ionicons name="mail-outline" size={24} color={theme.accent} />
                  <Text style={[styles.modalActionText, { color: theme.text }]}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalAction} onPress={() => { setActionModalVisible(false); toggleFavorite(selectedProduct); }}>
                  <Ionicons name={selectedProduct.isLiked ? 'heart' : 'heart-outline'} size={24} color={selectedProduct.isLiked ? theme.error : theme.accent} />
                  <Text style={[styles.modalActionText, { color: theme.text }]}>
                    {selectedProduct.isLiked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setActionModalVisible(false)}>
                <Text style={[styles.modalCancelText, { color: theme.accent }]}>Annuler</Text>
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
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={[styles.loadingMoreText, { color: theme.textSecondary }]}>Chargement...</Text>
        </View>
      );
    }
    if (!hasMore && feedProducts.length > 0) {
      return (
        <View style={styles.noMoreContainer}>
          <Ionicons name="checkmark-circle-outline" size={20} color={theme.success} />
          <Text style={[styles.noMoreText, { color: theme.textSecondary }]}>Fin du catalogue</Text>
        </View>
      );
    }
    return null;
  };

  // ========== ÉTAT DE CHARGEMENT INITIAL ==========
  if (loading && allProducts.length === 0) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={theme.statusBar} backgroundColor={theme.headerBg} />
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Chargement des produits...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.headerBg} />

      {/* HEADER FIXE */}
      {renderFixedHeader()}

      {/* FLATLIST PRINCIPALE */}
      <FlatList
        ref={flatListRef}
        data={feedProducts}
        keyExtractor={(item, index) => `feed-${item.id}-${index}`}
        renderItem={({ item, index }) => renderProductCard(item, index, (width - 36) / 2)}
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
            colors={[theme.accent]}
            tintColor={theme.accent}
          />
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={64} color={theme.textSecondary} />
              <Text style={[styles.emptyStateTitle, { color: theme.text }]}>Aucun produit</Text>
              <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.accent }]} onPress={onRefresh}>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    position: 'relative',
    padding: 4,
  },
  themeButton: {
    marginLeft: 4,
  },
  badgeIcon: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF6B6B',
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
  horizontalScrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  productCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 8,
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
  suggestionsContainer: {
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    marginRight: 12,
    gap: 8,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
  },
  modalCancelText: {
    fontSize: 17,
    fontWeight: '600',
  },
});