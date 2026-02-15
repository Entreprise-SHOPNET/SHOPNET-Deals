import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Linking,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');
const LOCAL_API = 'https://shopnet-backend.onrender.com/api/products';

const COLORS = {
  background: '#FFFFFF',
  text: '#1A2C3E',
  textSecondary: '#6B7A8C',
  accent: '#0A68B4',
  accentLight: '#E6F0FA',
  border: '#E8E8E8',
  success: '#4CAF50',
  error: '#F44336',
  whatsapp: '#25D366',
  email: '#0A68B4',
  call: '#34A853',
  gold: '#FFC107',
  verified: '#42A5F5',
};

// Composant Badge de Vérification (style Facebook/Instagram)
const VerificationBadge = ({ size = 16 }: { size?: number }) => (
  <View style={[styles.verificationBadge, { width: size, height: size }]}>
    <MaterialIcons name="verified" size={size * 0.9} color={COLORS.verified} />
  </View>
);

// Composant Toast simple pour les notifications
const Toast = ({ message, visible, onHide }: { message: string; visible: boolean; onHide: () => void }) => {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onHide();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={styles.toastContainer}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

type Boutique = {
  id: number;
  nom: string;
  description: string;
  logo: string;
  ville: string;
  latitude: string;
  longitude: string;
};

type Seller = {
  id: number;
  nom: string;
  email: string;
  phone: string;
  avatar: string | null;
  rating: number;
  verified: boolean;
};

type Product = {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  image: string | null;
  stock: number;
  condition: string;
  likes: number;
  views: number;
  sales: number;
  created_at: string;
};

export default function ShopDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [boutique, setBoutique] = useState<Boutique | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '' });

  // Fonction pour afficher une notification
  const showToast = (message: string) => {
    setToast({ visible: true, message });
  };

  const hideToast = () => {
    setToast({ visible: false, message: '' });
  };

  console.log('ShopDetail reçu id:', id);

  // Demande de localisation
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    })();
  }, []);

  // Calcul de la distance
  useEffect(() => {
    if (userLocation && boutique?.latitude && boutique?.longitude) {
      const dist = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        parseFloat(boutique.latitude),
        parseFloat(boutique.longitude)
      );
      setDistance(dist);
    }
  }, [userLocation, boutique]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Formatage du numéro de téléphone pour WhatsApp (ajout indicatif 243 si nécessaire)
  const formatPhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    // Si le numéro commence par 0, on remplace par 243
    if (cleaned.startsWith('0')) {
      cleaned = '243' + cleaned.substring(1);
    }
    // Si le numéro n'a pas d'indicatif (moins de 10 chiffres), on ajoute 243
    if (cleaned.length <= 9) {
      cleaned = '243' + cleaned;
    }
    return cleaned;
  };

  // Chargement des données
  const fetchShopData = async (pageNum = 1, shouldReset = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      const url = `${LOCAL_API}/discover/shop/${id}?page=${pageNum}`;
      console.log('Fetching:', url);
      const response = await fetch(url);
      const data = await response.json();
      console.log('Réponse:', JSON.stringify(data, null, 2));
      if (data.success) {
        setBoutique(data.boutique);
        setSeller(data.seller);
        setProducts(prev => (shouldReset ? data.products : [...prev, ...data.products]));
        setTotalPages(data.pagination.totalPages);
        setPage(data.pagination.page);
      } else {
        showToast(data.message || 'Impossible de charger la boutique');
      }
    } catch (error) {
      console.error('Erreur fetch shop:', error);
      showToast('Problème de connexion');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchShopData(1, true);
    } else {
      showToast('ID boutique manquant');
      router.back();
    }
  }, [id]);

  const loadMore = () => {
    if (page < totalPages && !loadingMore) {
      setLoadingMore(true);
      fetchShopData(page + 1, false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchShopData(1, true);
  }, []);

  // Actions de contact
  const openWhatsApp = (phone: string, message: string) => {
    if (!phone) {
      showToast('Numéro non disponible');
      return;
    }
    const cleaned = formatPhoneNumber(phone);
    const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => showToast("Impossible d'ouvrir WhatsApp"));
  };

  const callNumber = (phone: string) => {
    if (!phone) {
      showToast('Numéro non disponible');
      return;
    }
    Linking.openURL(`tel:${phone.replace(/\D/g, '')}`).catch(() => showToast("Impossible d'appeler"));
  };

  const sendEmail = (email: string, subject: string, body: string) => {
    if (!email) {
      showToast('Email non disponible');
      return;
    }
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => showToast("Impossible d'ouvrir l'application email"));
  };

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    showToast(isFollowing ? 'Vous ne suivez plus cette boutique' : 'Vous suivez maintenant cette boutique');
  };

  const handleReport = () => {
    showToast('Merci de nous aider à améliorer la plateforme. Votre signalement a été enregistré.');
  };

  const formatPrice = (price: any) => {
    const n = Number(price);
    return isNaN(n) ? 'N/A' : n.toFixed(2);
  };

  // Fonction pour ouvrir WhatsApp depuis un produit (avec détails)
  const openWhatsAppForProduct = (product: Product) => {
    if (!seller) {
      showToast('Vendeur non disponible');
      return;
    }
    const rawPhone = seller.phone || '';
    if (!rawPhone) {
      showToast('Numéro WhatsApp non disponible');
      return;
    }
    const phone = formatPhoneNumber(rawPhone);
    const imageUrl = product.image || '';
    const productLink = `https://shopnet.app/product/${product.id}`;
    const message = `Bonjour, je suis intéressé par le produit "${product.title}" sur SHOPNET. Prix: $${formatPrice(product.price)}. Lien: ${productLink} ${imageUrl ? `Image: ${imageUrl}` : ''}`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => showToast("Impossible d'ouvrir WhatsApp"));
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const discount = item.original_price
      ? Math.round(((item.original_price - item.price) / item.original_price) * 100)
      : 0;

    return (
      <TouchableOpacity
        style={[styles.productCard, { borderColor: COLORS.border }]}
        onPress={() => router.push({ pathname: '/ProductDetail', params: { id: item.id } })}
      >
        <Image
          source={{ uri: item.image || 'https://via.placeholder.com/150' }}
          style={styles.productImage}
        />
        {discount > 0 && (
          <View style={[styles.discountBadge, { backgroundColor: COLORS.error }]}>
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={[styles.productTitle, { color: COLORS.text }]} numberOfLines={2}>
            {item.title}
          </Text>
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
          <View style={styles.metaRow}>
            <Text style={[styles.condition, { color: COLORS.textSecondary }]}>
              {item.condition || 'Neuf'}
            </Text>
            <Text style={[styles.stock, { color: item.stock > 0 ? COLORS.success : COLORS.error }]}>
              {item.stock > 0 ? 'En stock' : 'Rupture'}
            </Text>
          </View>
          <View style={styles.productActions}>
            <TouchableOpacity
              style={[styles.productActionButton, { backgroundColor: COLORS.whatsapp }]}
              onPress={() => openWhatsAppForProduct(item)}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.productActionButton, { backgroundColor: COLORS.call }]}
              onPress={() => callNumber(seller?.phone || '')}
            >
              <Ionicons name="call-outline" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.productActionButton, { backgroundColor: COLORS.accent }]}
              onPress={() => showToast('Fonctionnalité à venir')}
            >
              <Ionicons name="cart-outline" size={16} color="#fff" />
            </TouchableOpacity>
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

  if (loading && !boutique) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: COLORS.background }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={[styles.loadingText, { color: COLORS.textSecondary }]}>Chargement de la boutique...</Text>
      </SafeAreaView>
    );
  }

  if (!boutique) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
          <Text style={[styles.errorText, { color: COLORS.text }]}>Boutique introuvable</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: COLORS.accent }]} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header fixe (retour, titre, partage) */}
      <View style={[styles.header, { borderBottomColor: COLORS.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]} numberOfLines={1}>
          {boutique.nom}
        </Text>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="share-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Section profil boutique fixe */}
      <View style={styles.fixedProfile}>
        <View style={styles.shopHeader}>
          <Image
            source={{ uri: boutique.logo || 'https://via.placeholder.com/80' }}
            style={styles.shopLogo}
          />
          <View style={styles.shopHeaderInfo}>
            <View style={styles.shopNameRow}>
              <Text style={[styles.shopName, { color: COLORS.text }]}>{boutique.nom}</Text>
              {seller?.verified && <VerificationBadge size={18} />}
            </View>
            <View style={styles.shopMetaRow}>
              <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
              <Text style={[styles.shopMetaText, { color: COLORS.textSecondary }]}>
                {boutique.ville}
              </Text>
              {distance !== null && (
                <>
                  <Text style={[styles.dot, { color: COLORS.textSecondary }]}>•</Text>
                  <Ionicons name="navigate-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={[styles.shopMetaText, { color: COLORS.textSecondary }]}>
                    {distance.toFixed(1)} km
                  </Text>
                </>
              )}
            </View>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((star) => {
                const ratingValue = Number(seller?.rating) || 0;
                return (
                  <Ionicons
                    key={star}
                    name={star <= Math.round(ratingValue) ? 'star' : 'star-outline'}
                    size={16}
                    color={COLORS.gold}
                  />
                );
              })}
              <Text style={[styles.ratingText, { color: COLORS.textSecondary }]}>
                ({Number(seller?.rating || 0).toFixed(1)})
              </Text>
            </View>
          </View>
        </View>

        {/* Boutons d'action rapides fixes */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButtonSmall, { backgroundColor: COLORS.whatsapp }]}
            onPress={() =>
              openWhatsApp(
                seller?.phone || '',
                `Bonjour, je suis intéressé par votre boutique "${boutique.nom}" sur SHOPNET.`
              )
            }
          >
            <Ionicons name="logo-whatsapp" size={18} color="#fff" />
            <Text style={styles.actionButtonSmallText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButtonSmall, { backgroundColor: COLORS.call }]}
            onPress={() => callNumber(seller?.phone || '')}
          >
            <Ionicons name="call-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonSmallText}>Appeler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButtonSmall, { backgroundColor: COLORS.email }]}
            onPress={() =>
              sendEmail(
                seller?.email || '',
                `Question concernant votre boutique ${boutique.nom}`,
                `Bonjour,\n\nJe suis intéressé par votre boutique "${boutique.nom}" sur SHOPNET.\n\nCordialement.`
              )
            }
          >
            <Ionicons name="mail-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonSmallText}>Email</Text>
          </TouchableOpacity>
        </View>

        {/* Informations boutique détaillées (cette partie peut défiler ou être fixe ? On laisse dans le header de la FlatList pour défiler) */}
        {/* On va les mettre dans ListHeaderComponent pour qu'elles défilent */}
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderProduct}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <>
            {/* Informations boutique détaillées (défilent) */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: COLORS.text }]}>À propos de la boutique</Text>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Ionicons name="location-outline" size={16} color={COLORS.accent} />
                  <Text style={[styles.infoText, { color: COLORS.textSecondary }]}>
                    {boutique.description || 'Aucune description'}
                  </Text>
                </View>
                {boutique.latitude && boutique.longitude && (
                  <TouchableOpacity
                    style={[styles.infoItem, styles.mapButton]}
                    onPress={() =>
                      Linking.openURL(
                        `https://www.google.com/maps/search/?api=1&query=${boutique.latitude},${boutique.longitude}`
                      )
                    }
                  >
                    <Ionicons name="map-outline" size={16} color={COLORS.accent} />
                    <Text style={[styles.infoText, { color: COLORS.accent, fontWeight: '600' }]}>
                      Voir sur la carte
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Informations vendeur */}
            {seller && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Vendeur</Text>
                <View style={styles.sellerCard}>
                  <View style={styles.sellerRow}>
                    <Ionicons name="person-outline" size={20} color={COLORS.accent} />
                    <Text style={[styles.sellerLabel, { color: COLORS.text }]}>{seller.nom}</Text>
                  </View>
                  {seller.phone && (
                    <TouchableOpacity style={styles.sellerRow} onPress={() => callNumber(seller.phone)}>
                      <Ionicons name="call-outline" size={20} color={COLORS.accent} />
                      <Text style={[styles.sellerValue, { color: COLORS.text }]}>{seller.phone}</Text>
                    </TouchableOpacity>
                  )}
                  {seller.email && (
                    <TouchableOpacity
                      style={styles.sellerRow}
                      onPress={() =>
                        sendEmail(
                          seller.email,
                          `Question pour ${boutique.nom}`,
                          `Bonjour,\n\nJe vous contacte à propos de votre boutique "${boutique.nom}".`
                        )
                      }
                    >
                      <Ionicons name="mail-outline" size={20} color={COLORS.accent} />
                      <Text style={[styles.sellerValue, { color: COLORS.text }]}>{seller.email}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Filtres (simples) */}
            <View style={styles.filterRow}>
              <TouchableOpacity style={[styles.filterChip, { backgroundColor: COLORS.accentLight }]}>
                <Text style={[styles.filterText, { color: COLORS.accent }]}>Tous</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.filterChip, { borderColor: COLORS.border }]}>
                <Text style={[styles.filterText, { color: COLORS.textSecondary }]}>Promotions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.filterChip, { borderColor: COLORS.border }]}>
                <Text style={[styles.filterText, { color: COLORS.textSecondary }]}>Plus récents</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.filterChip, { borderColor: COLORS.border }]}>
                <Text style={[styles.filterText, { color: COLORS.textSecondary }]}>Prix ↑</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.filterChip, { borderColor: COLORS.border }]}>
                <Text style={[styles.filterText, { color: COLORS.textSecondary }]}>Prix ↓</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.productsTitle, { color: COLORS.text }]}>Produits de la boutique</Text>
          </>
        }
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.accent]} tintColor={COLORS.accent} />
        }
      />

      {/* Boutons flottants : Suivre et Signaler */}
      <View style={styles.floatingButtons}>
        <TouchableOpacity style={[styles.floatingButton, { backgroundColor: COLORS.accent }]} onPress={handleFollow}>
          <Ionicons name={isFollowing ? 'heart' : 'heart-outline'} size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.floatingButton, { backgroundColor: COLORS.error }]} onPress={handleReport}>
          <Ionicons name="flag-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Toast pour les notifications */}
      <Toast message={toast.message} visible={toast.visible} onHide={hideToast} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 18, marginVertical: 20 },
  retryButton: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  fixedProfile: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  shopHeader: {
    flexDirection: 'row',
    padding: 16,
  },
  shopLogo: { width: 80, height: 80, borderRadius: 40, marginRight: 16 },
  shopHeaderInfo: { flex: 1, justifyContent: 'center' },
  shopNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  shopName: { fontSize: 20, fontWeight: '700' },
  shopMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  shopMetaText: { fontSize: 13 },
  dot: { fontSize: 13, marginHorizontal: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 13, marginLeft: 6 },
  verificationBadge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  actionButtonSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonSmallText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  listContent: { paddingBottom: 20 },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  infoGrid: { gap: 8 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 14, flex: 1 },
  mapButton: {
    backgroundColor: COLORS.accentLight,
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  sellerCard: { gap: 12 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sellerLabel: { fontSize: 14, fontWeight: '600' },
  sellerValue: { fontSize: 14 },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterText: { fontSize: 12, fontWeight: '500' },
  productsTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  columnWrapper: { justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  productCard: {
    width: (width - 44) / 2,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: COLORS.background,
  },
  productImage: { width: '100%', height: 120 },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  discountText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  productInfo: { padding: 8 },
  productTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  price: { fontSize: 15, fontWeight: '700' },
  promoPrice: { fontSize: 15, fontWeight: '700' },
  originalPrice: { fontSize: 11, textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  condition: { fontSize: 11 },
  stock: { fontSize: 11, fontWeight: '500' },
  productActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    gap: 8,
  },
  productActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: { paddingVertical: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  footerText: { fontSize: 14 },
  floatingButtons: { position: 'absolute', bottom: 20, right: 20, flexDirection: 'column', gap: 12 },
  floatingButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
  },
});