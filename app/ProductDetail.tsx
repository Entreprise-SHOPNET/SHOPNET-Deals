

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Linking,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const LOCAL_API = 'https://shopnet-backend.onrender.com/api';

// ========== COULEURS ==========
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
};

type ProductDetail = {
  id: string;
  title: string;
  description: string;
  price: number;
  original_price: number | null;
  category: string;
  condition: string;
  stock: number;
  location: string;
  created_at: string;
  latitude?: string;
  longitude?: string;
  images: string[];
};

type Seller = {
  id: string;
  nom: string;
  phone: string;
  email: string;
  adresse: string;
  latitude: string;
  longitude: string;
};

type Boutique = {
  id: number;
  nom: string;
  adresse: string;
  ville: string;
  latitude: string;
  longitude: string;
};

type SimilarProduct = {
  id: string;
  title: string;
  price: number;
  image_url?: string;
};

export default function ProductDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [boutique, setBoutique] = useState<Boutique | null>(null);
  const [similarProducts, setSimilarProducts] = useState<SimilarProduct[]>([]);
  const [sameSellerProducts, setSameSellerProducts] = useState<SimilarProduct[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderMessage, setOrderMessage] = useState('');
  const [sendingOrder, setSendingOrder] = useState(false);

  const productId = params.id as string || (params.product ? JSON.parse(params.product as string).id : null);

  useEffect(() => {
    if (productId) {
      fetchProductDetail(productId);
    } else {
      Alert.alert('Erreur', 'ID produit manquant');
      router.back();
    }
  }, [productId]);

  useEffect(() => {
    if (product) {
      checkIfFavorite(product.id);
    }
  }, [product]);

  // ---------- RÉCUPÉRATION DES DONNÉES ----------
  const fetchProductDetail = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${LOCAL_API}/products/discover/product/${id}`);
      const data = await response.json();
      if (data.success) {
        setProduct(data.product);
        setSeller(data.seller);
        setBoutique(data.boutique);
        setSimilarProducts(
          (data.similar_products || []).map((p: any) => ({
            ...p,
            price: parseFloat(p.price) || 0,
          }))
        );
        setSameSellerProducts(
          (data.same_seller_products || []).map((p: any) => ({
            ...p,
            price: parseFloat(p.price) || 0,
          }))
        );
      } else {
        Alert.alert('Erreur', 'Produit introuvable');
        router.back();
      }
    } catch (error) {
      console.error('Erreur fetch product detail:', error);
      Alert.alert('Erreur', 'Impossible de charger le produit');
    } finally {
      setLoading(false);
    }
  };

  // ---------- GESTION FAVORIS ----------
  const checkIfFavorite = async (productId: string) => {
    try {
      const favorites = await AsyncStorage.getItem('@shopnet_favorites');
      if (favorites) {
        const favs = JSON.parse(favorites);
        setIsFavorite(favs.some((f: any) => f.id === productId));
      }
    } catch (error) {
      console.error('Erreur vérification favori:', error);
    }
  };

  const toggleFavorite = async () => {
    if (!product) return;
    try {
      const favorites = await AsyncStorage.getItem('@shopnet_favorites');
      let favs = favorites ? JSON.parse(favorites) : [];

      if (isFavorite) {
        favs = favs.filter((f: any) => f.id !== product.id);
        Alert.alert('❤️ Retiré des favoris');
      } else {
        favs.unshift({
          id: product.id,
          title: product.title,
          price: product.price,
          image: product.images[0] || '',
          sellerName: seller?.nom || 'Vendeur',
          addedAt: Date.now(),
        });
        Alert.alert('❤️ Ajouté aux favoris');
      }

      await AsyncStorage.setItem('@shopnet_favorites', JSON.stringify(favs));
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Erreur toggle favori:', error);
    }
  };

  // ---------- FORMATAGE ----------
  const formatPrice = (price: any) => {
    const n = Number(price);
    return isNaN(n) ? "N/A" : n.toFixed(2);
  };

  const formatPhoneNumber = (phone: string) => {
    let cleaned = phone.trim().replace(/\D/g, "");
    if (cleaned.startsWith("0")) cleaned = "243" + cleaned.substring(1);
    return cleaned;
  };

  // ---------- ACTIONS DE CONTACT ----------
  const openWhatsApp = () => {
    if (!seller || !product) return;
    const rawPhone = seller.phone || "";
    if (!rawPhone) {
      Alert.alert("Info", "Numéro WhatsApp non disponible");
      return;
    }
    const phone = formatPhoneNumber(rawPhone);
    const imageUrl = product.images?.[0] || "";
    const productLink = `https://shopnet.app/product/${product.id}`; // à adapter
    const message = `Bonjour, je suis intéressé par le produit "${product.title}" sur SHOPNET. Prix: $${formatPrice(product.price)}. Lien: ${productLink} ${imageUrl ? `Image: ${imageUrl}` : ''}`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Erreur", "Impossible d'ouvrir WhatsApp")
    );
  };

  const sendEmail = () => {
    if (!seller || !product) return;
    const email = seller.email || '';
    const subject = `Demande d'information : ${product.title}`;
    const imageLink = product.images && product.images[0] ? product.images[0] : '';
    const productLink = `https://shopnet.app/product/${product.id}`;

    const body = `Bonjour ${seller.nom},\n\n` +
      `Je suis intéressé(e) par votre produit :\n` +
      `- ${product.title}\n` +
      `- Prix : $${formatPrice(product.price)}\n` +
      `- Lien : ${productLink}\n` +
      (imageLink ? `- Image : ${imageLink}\n` : '') +
      `\nEst-il toujours disponible ?\n\n` +
      `Cordialement.`;

    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', "Impossible d'ouvrir l'application email");
    });
  };

  const callSeller = () => {
    if (!seller) return;
    const rawPhone = seller.phone || '';
    const phoneDigits = rawPhone.replace(/\D/g, '');
    if (!phoneDigits) {
      Alert.alert('Erreur', 'Numéro de téléphone invalide');
      return;
    }
    Linking.openURL(`tel:${phoneDigits}`).catch(() => {
      Alert.alert('Erreur', "Impossible de lancer l'appel");
    });
  };

  // ---------- COMMANDE SIMULÉE (PUBLIQUE) ----------
  const placeOrder = () => {
    if (!product) return;
    setSendingOrder(true);
    // Simulation d'envoi de commande
    setTimeout(() => {
      setSendingOrder(false);
      setShowOrderModal(false);
      Alert.alert(
        '✅ Commande envoyée',
        `Votre demande pour ${orderQuantity} x ${product.title} a été transmise au vendeur.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setOrderQuantity(1);
              setOrderMessage('');
            },
          },
        ]
      );
    }, 1500);
  };

  if (loading || !product) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: COLORS.background }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={[styles.loadingText, { color: COLORS.textSecondary }]}>
          Chargement du produit...
        </Text>
      </SafeAreaView>
    );
  }

  const discount = product.original_price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header avec bouton recherche */}
      <View style={[styles.header, { borderBottomColor: COLORS.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]} numberOfLines={1}>
          Détail du produit
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => router.push('/search')} style={styles.headerButton}>
            <Ionicons name="search-outline" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleFavorite} style={styles.headerButton}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? COLORS.error : COLORS.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Galerie d'images */}
        <View style={styles.galleryContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / width);
              setSelectedImageIndex(index);
            }}
            scrollEventThrottle={16}
          >
            {product.images && product.images.length > 0 ? (
              product.images.map((img, idx) => (
                <Image
                  key={idx}
                  source={{ uri: img }}
                  style={[styles.galleryImage, { width }]}
                  resizeMode="cover"
                />
              ))
            ) : (
              <View style={[styles.galleryImage, { width, backgroundColor: COLORS.border }]}>
                <Ionicons name="cube-outline" size={60} color={COLORS.textSecondary} />
              </View>
            )}
          </ScrollView>

          {product.images && product.images.length > 1 && (
            <View style={styles.paginationContainer}>
              {product.images.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.paginationDot,
                    {
                      backgroundColor: idx === selectedImageIndex ? COLORS.accent : COLORS.border,
                      width: idx === selectedImageIndex ? 20 : 8,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Informations produit (sans fond ni bordure) */}
        <View style={styles.infoSection}>
          <View style={styles.titleRow}>
            <Text style={[styles.productTitle, { color: COLORS.text }]}>{product.title}</Text>
            {discount > 0 && (
              <View style={[styles.discountBadge, { backgroundColor: COLORS.error }]}>
                <Text style={styles.discountText}>-{discount}%</Text>
              </View>
            )}
          </View>

          {/* Prix */}
          <View style={styles.priceContainer}>
            {product.original_price ? (
              <>
                <Text style={[styles.promoPrice, { color: COLORS.error }]}>
                  ${formatPrice(product.price)}
                </Text>
                <Text style={[styles.originalPrice, { color: COLORS.textSecondary }]}>
                  ${formatPrice(product.original_price)}
                </Text>
              </>
            ) : (
              <Text style={[styles.price, { color: COLORS.accent }]}>
                ${formatPrice(product.price)}
              </Text>
            )}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Description</Text>
            <Text style={[styles.description, { color: COLORS.textSecondary }]}>
              {product.description || "Aucune description fournie."}
            </Text>
          </View>

          {/* Caractéristiques (chips) */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Caractéristiques</Text>
            <View style={styles.featuresGrid}>
              <View style={[styles.featureChip, { backgroundColor: COLORS.accentLight }]}>
                <Ionicons name="cube-outline" size={16} color={COLORS.accent} />
                <Text style={[styles.featureText, { color: COLORS.textSecondary }]}>
                  {product.condition || "État non spécifié"}
                </Text>
              </View>
              <View style={[styles.featureChip, { backgroundColor: COLORS.accentLight }]}>
                <Ionicons name="pricetag-outline" size={16} color={COLORS.accent} />
                <Text style={[styles.featureText, { color: COLORS.textSecondary }]}>
                  {product.category || "Non catégorisé"}
                </Text>
              </View>
              <View style={[styles.featureChip, { backgroundColor: COLORS.accentLight }]}>
                <Ionicons name="location-outline" size={16} color={COLORS.accent} />
                <Text style={[styles.featureText, { color: COLORS.textSecondary }]}>
                  {product.location || "Ville inconnue"}
                </Text>
              </View>
              <View style={[styles.featureChip, { backgroundColor: COLORS.accentLight }]}>
                <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.accent} />
                <Text style={[styles.featureText, { color: COLORS.textSecondary }]}>
                  {product.stock > 0 ? `En stock (${product.stock})` : "Rupture de stock"}
                </Text>
              </View>
            </View>
          </View>

          {/* Informations vendeur / boutique (sans fond, juste texte) */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Vendeur</Text>
            <Text style={[styles.sellerName, { color: COLORS.text }]}>{seller?.nom || 'Vendeur inconnu'}</Text>
            {boutique && (
              <Text style={[styles.boutiqueName, { color: COLORS.accent }]}>
                {boutique.nom} • {boutique.ville}
              </Text>
            )}
            <View style={styles.sellerDetails}>
              {seller?.phone && (
                <View style={styles.sellerDetailItem}>
                  <Ionicons name="call-outline" size={16} color={COLORS.accent} />
                  <Text style={[styles.sellerDetailText, { color: COLORS.textSecondary }]}>{seller.phone}</Text>
                </View>
              )}
              {seller?.email && (
                <View style={styles.sellerDetailItem}>
                  <Ionicons name="mail-outline" size={16} color={COLORS.accent} />
                  <Text style={[styles.sellerDetailText, { color: COLORS.textSecondary }]}>{seller.email}</Text>
                </View>
              )}
              {seller?.adresse && (
                <View style={styles.sellerDetailItem}>
                  <Ionicons name="location-outline" size={16} color={COLORS.accent} />
                  <Text style={[styles.sellerDetailText, { color: COLORS.textSecondary }]} numberOfLines={1}>
                    {seller.adresse}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Boutons d'action : 2 par ligne */}
          <View style={styles.actionButtonsGrid}>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: COLORS.whatsapp }]} onPress={openWhatsApp}>
              <Ionicons name="logo-whatsapp" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, { backgroundColor: COLORS.email }]} onPress={sendEmail}>
              <Ionicons name="mail-outline" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>Email</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, { backgroundColor: COLORS.call }]} onPress={callSeller}>
              <Ionicons name="call-outline" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>Appeler</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, { backgroundColor: COLORS.success }]} onPress={() => setShowOrderModal(true)}>
              <Ionicons name="cart-outline" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>Commander</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Produits similaires - affichés en grille verticale 2 colonnes */}
        {similarProducts.length > 0 && (
          <View style={styles.gridSection}>
            <Text style={[styles.gridTitle, { color: COLORS.text }]}>Produits similaires</Text>
            <View style={styles.gridContainer}>
              {similarProducts.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.gridCard, { borderColor: COLORS.border, backgroundColor: COLORS.background }]}
                  onPress={() => router.push({ pathname: '/ProductDetail', params: { id: item.id } })}
                >
                  <Image
                    source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
                    style={styles.gridImage}
                  />
                  <View style={styles.gridInfo}>
                    <Text style={[styles.gridProductTitle, { color: COLORS.text }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={[styles.gridPrice, { color: COLORS.accent }]}>
                      ${formatPrice(item.price)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Autres produits du vendeur - grille verticale 2 colonnes */}
        {sameSellerProducts.length > 0 && (
          <View style={styles.gridSection}>
            <Text style={[styles.gridTitle, { color: COLORS.text }]}>Autres produits du vendeur</Text>
            <View style={styles.gridContainer}>
              {sameSellerProducts.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.gridCard, { borderColor: COLORS.border, backgroundColor: COLORS.background }]}
                  onPress={() => router.push({ pathname: '/ProductDetail', params: { id: item.id } })}
                >
                  <Image
                    source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
                    style={styles.gridImage}
                  />
                  <View style={styles.gridInfo}>
                    <Text style={[styles.gridProductTitle, { color: COLORS.text }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={[styles.gridPrice, { color: COLORS.accent }]}>
                      ${formatPrice(item.price)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modal de commande (simulation) */}
      <Modal visible={showOrderModal} transparent animationType="slide" onRequestClose={() => setShowOrderModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: COLORS.border }]}>
              <Text style={[styles.modalTitle, { color: COLORS.text }]}>Passer commande</Text>
              <TouchableOpacity onPress={() => setShowOrderModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalBody}>
                <View style={[styles.orderProduct, { backgroundColor: COLORS.accentLight }]}>
                  <Image
                    source={{ uri: product.images[0] || 'https://via.placeholder.com/60' }}
                    style={styles.orderProductImage}
                  />
                  <View style={styles.orderProductInfo}>
                    <Text style={[styles.orderProductTitle, { color: COLORS.text }]} numberOfLines={2}>
                      {product.title}
                    </Text>
                    <Text style={[styles.orderProductPrice, { color: COLORS.accent }]}>
                      ${formatPrice(product.price)}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderField}>
                  <Text style={[styles.orderLabel, { color: COLORS.text }]}>Quantité</Text>
                  <View style={styles.quantitySelector}>
                    <TouchableOpacity
                      style={[styles.quantityButton, { borderColor: COLORS.border }]}
                      onPress={() => setOrderQuantity(Math.max(1, orderQuantity - 1))}
                    >
                      <Ionicons name="remove" size={20} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={[styles.quantityText, { color: COLORS.text }]}>{orderQuantity}</Text>
                    <TouchableOpacity
                      style={[styles.quantityButton, { borderColor: COLORS.border }]}
                      onPress={() => setOrderQuantity(orderQuantity + 1)}
                    >
                      <Ionicons name="add" size={20} color={COLORS.text} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.orderField}>
                  <Text style={[styles.orderLabel, { color: COLORS.text }]}>
                    Message au vendeur (optionnel)
                  </Text>
                  <TextInput
                    style={[
                      styles.orderInput,
                      {
                        backgroundColor: COLORS.background,
                        borderColor: COLORS.border,
                        color: COLORS.text,
                      },
                    ]}
                    placeholder="Ajoutez un message..."
                    placeholderTextColor={COLORS.textSecondary}
                    multiline
                    numberOfLines={3}
                    value={orderMessage}
                    onChangeText={setOrderMessage}
                  />
                </View>

                <View style={styles.orderTotal}>
                  <Text style={[styles.totalLabel, { color: COLORS.text }]}>Total</Text>
                  <Text style={[styles.totalPrice, { color: COLORS.accent }]}>
                    ${(product.price * orderQuantity).toFixed(2)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.confirmButton, { backgroundColor: COLORS.success }]}
                  onPress={placeOrder}
                  disabled={sendingOrder}
                >
                  {sendingOrder ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={22} color="#fff" />
                      <Text style={styles.confirmButtonText}>Confirmer la commande</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ========== STYLES SANS FONDS NI BORDURES INUTILES ==========
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
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  galleryContainer: {
    position: 'relative',
  },
  galleryImage: {
    height: 300,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    gap: 6,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  productTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  discountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  discountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
  },
  promoPrice: {
    fontSize: 24,
    fontWeight: '700',
  },
  originalPrice: {
    fontSize: 16,
    textDecorationLine: 'line-through',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  boutiqueName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  sellerDetails: {
    gap: 8,
    marginTop: 4,
  },
  sellerDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sellerDetailText: {
    fontSize: 13,
  },
  actionButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 10,
  },
  actionButton: {
    width: (width - 42) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Styles pour la grille verticale 2 colonnes
  gridSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  gridTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridCard: {
    width: (width - 44) / 2, // 2 colonnes avec gap
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  gridImage: {
    width: '100%',
    height: 120,
  },
  gridInfo: {
    padding: 8,
  },
  gridProductTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  gridPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
  },
  orderProduct: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  orderProductImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  orderProductInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  orderProductTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  orderProductPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  orderField: {
    marginBottom: 16,
  },
  orderLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'center',
  },
  orderInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: '700',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});