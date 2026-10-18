// ─── PublishScreen v3 ─ TakTak ───────────────────────────────────────────────
// Publication en 3 étapes : l'essentiel (photos d'abord, titre, catégorie),
// prix & détails, puis aperçu réel de la carte avec un score de qualité.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Animated,
  TextInput, Image, ActivityIndicator, Platform, Switch, Modal, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareView, KeyboardAwareScrollView, FormKeyboardToolbar } from '../components/Keyboard';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { getCategories } from '../api/categories';
import { createProduct, updateProduct, imagesToBase64 } from '../api/products';
import AlertModal from '../components/AlertModal';
import CategoryIcon from '../components/CategoryIcon';
import { filterCategoriesForType, subcategoryAllows } from '../utils/categoryTypes';
import { MOBILE_COLORS as P } from '../theme/colors';
import { formatPrice } from '../utils/format';

const normalizeCategoryValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value._id || value.id || value.slug || value.name || '';
  return '';
};

const normalizeSubcategoryValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.slug || value._id || value.id || value.name || '';
  return '';
};

const isRemoteImageUrl = (value) => /^https?:\/\//i.test(String(value || ''));

// Formulaire vierge (source unique pour tous les resets)
const createEmptyForm = () => ({
  type: 'product', title: '', category: '', subcategory: '',
  price: '', description: '', condition: 'used', images: [],
  delivery: false, deliveryCost: '', deliveryAreas: [],
  specifications: {},
  availability: { openingTime: '', closingTime: '', days: [] },
});

// Détecte si le formulaire contient une saisie en cours (brouillon non publié)
const hasPublishContent = (form) => Boolean(
  String(form?.title || '').trim() ||
  form?.category ||
  form?.subcategory ||
  form?.price ||
  String(form?.description || '').trim() ||
  (Array.isArray(form?.images) && form.images.length > 0)
);

const buildPublishSummary = (form, categories, editItemId = '') => {
  const selectedCategory = categories.find((cat) => String(cat?._id || '') === String(form.category || ''));
  const firstImage = Array.isArray(form.images) && form.images.length > 0 ? form.images[0] : '';

  return {
    editItemId,
    type: form.type,
    title: form.title,
    price: form.price,
    categoryName: selectedCategory?.name || '',
    subcategory: form.subcategory || '',
    condition: form.type === 'product' ? form.condition : '',
    imagesCount: Array.isArray(form.images) ? form.images.length : 0,
    hasDelivery: Boolean(form.delivery),
    firstImage,
  };
};

// Brouillon conservé pendant l'authentification
let temporaryDraftStore = null;

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function PublishScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { isDark, theme } = useAppTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const footerOffset = Math.max(tabBarHeight - insets.bottom, 0);
  const { user, isAuthenticated } = useAuth();
  const editItem = route?.params?.editItem;
  const editItemId = editItem?._id || editItem?.id || '';
  const isEditing = Boolean(editItemId);

  const scrollRef = useRef(null);
  const [step,       setStep]       = useState(1);
  const [categories, setCategories] = useState([]);
  const [loadingCats,setLoadingCats]= useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [originalImages, setOriginalImages] = useState([]);
  const [deletedImages, setDeletedImages] = useState([]);
  const [specKey,    setSpecKey]    = useState('');
  const [specVal,    setSpecVal]    = useState('');
  const [delArea,    setDelArea]    = useState('');
  const [errors,     setErrors]     = useState({});
  const [alert,      setAlert]      = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [{ text: 'OK', onPress: () => {} }],
  });

  const [form, setForm] = useState(createEmptyForm());
  const [draftBanner, setDraftBanner] = useState(false);

  // Refs de cycle de vie : lecture de valeurs fraîches dans les callbacks de focus
  const formRef = useRef(form);
  const paramsRef = useRef(route?.params || {});
  const draftAcknowledgedRef = useRef(false);

  // Modifier un champ efface son message d'erreur
  const set = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: step, duration: 320, useNativeDriver: false }).start();
  }, [step]);

  // Garder les refs synchronisées avec l'état / les params
  useEffect(() => { formRef.current = form; }, [form]);
  useEffect(() => { paramsRef.current = route?.params || {}; }, [route?.params]);

  useEffect(() => {
    loadCategories();
    ImagePicker.requestMediaLibraryPermissionsAsync();
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!editItem) return;
    const existingImages = Array.isArray(editItem.images) ? editItem.images.filter(isRemoteImageUrl) : [];
    setOriginalImages(existingImages);
    setDeletedImages([]);
    setStep(1);
    setForm({
      type: editItem.type || 'product',
      title: editItem.title || '',
      // L'identifiant d'abord : editItem.category contient le NOM de la catégorie
      category: editItem.categoryId || normalizeCategoryValue(editItem.category) || editItem.categorySlug || '',
      subcategory: normalizeSubcategoryValue(editItem.subcategory),
      price: editItem.price?.toString().replace(/[^\d]/g, '') || '',
      description: editItem.description || '',
      condition: editItem.condition || 'used',
      images: editItem.images || [],
      delivery: editItem.delivery?.available || false,
      deliveryCost: editItem.delivery?.cost?.toString() || '',
      deliveryAreas: editItem.delivery?.areas || [],
      specifications: editItem.specifications || {},
      availability: editItem.availability || { openingTime: '', closingTime: '', days: [] },
    });
  }, [editItem]);

  const handleRemoveImage = (indexToRemove) => {
    const imageToRemove = form.images[indexToRemove];
    if (isEditing && isRemoteImageUrl(imageToRemove)) {
      setDeletedImages((prev) => (prev.includes(imageToRemove) ? prev : [...prev, imageToRemove]));
    }
    set('images', form.images.filter((_, index) => index !== indexToRemove));
  };

  useEffect(() => {
    if (!categories.length || !form.category) return;

    const rawCategory = String(form.category);
    const categoryMatch = categories.find((c) => {
      const id = String(c?._id || '');
      const slug = String(c?.slug || '');
      const name = String(c?.name || '').toLowerCase();
      const rawLower = rawCategory.toLowerCase();
      return rawCategory === id || rawCategory === slug || rawLower === name;
    });

    if (!categoryMatch) return;

    const nextCategoryId = String(categoryMatch._id || '');
    let nextSubcategory = form.subcategory;

    if (form.subcategory && Array.isArray(categoryMatch.subcategories)) {
      const rawSub = String(form.subcategory);
      const rawSubLower = rawSub.toLowerCase();
      const subMatch = categoryMatch.subcategories.find((sub) => {
        const slug = String(sub?.slug || '');
        const id = String(sub?._id || sub?.id || '');
        const name = String(sub?.name || '').toLowerCase();
        return rawSub === slug || rawSub === id || rawSubLower === name;
      });
      if (subMatch?.slug) nextSubcategory = subMatch.slug;
    }

    if (nextCategoryId !== rawCategory || nextSubcategory !== form.subcategory) {
      setForm((prev) => ({
        ...prev,
        category: nextCategoryId,
        subcategory: nextSubcategory,
      }));
    }
  }, [categories, form.category, form.subcategory]);

  useEffect(() => {
    if (isAuthenticated && route?.params?.autoSubmit) {
      navigation.setParams({ autoSubmit: false });
      
      // Restaurer le brouillon s'il existe
      if (temporaryDraftStore) {
        setForm(temporaryDraftStore.form);
        setStep(temporaryDraftStore.step);
        
        // Déclencher le submit avec le brouillon
        setTimeout(() => {
          doSubmitDraft(temporaryDraftStore.form);
          temporaryDraftStore = null;
        }, 500);
      } else {
        submit();
      }
    }
  }, [isAuthenticated, route?.params?.autoSubmit]);

  // Changement produit ⇄ service par l'utilisateur : on retire une catégorie ou
  // sous-catégorie qui ne convient plus au nouveau type. (Jamais au chargement
  // d'une annonce à modifier : sa catégorie doit être conservée.)
  const changeType = (type) => {
    setForm((p) => {
      if (p.type === type) return p;
      const raw = categories.find((c) => String(c._id) === String(p.category));
      if (!raw) return { ...p, type };
      if (!filterCategoriesForType([raw], type).length) return { ...p, type, category: '', subcategory: '' };
      const sub = raw.subcategories?.find((x) => x.slug === p.subcategory);
      if (sub && !subcategoryAllows(sub, raw.slug, type)) return { ...p, type, subcategory: '' };
      return { ...p, type };
    });
  };

  const loadCategories = async () => {
    try {
      const r = await getCategories();
      setCategories(r.data || []);
    } catch {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: 'Impossible de charger les catégories',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    }
    finally { setLoadingCats(false); }
  };

  const pickImages = async (source = 'library') => {
    const remaining = 5 - form.images.length;
    if (remaining <= 0) {
      setAlert({ visible: true, type: 'warning', title: '5 photos maximum', message: 'Retirez une photo pour en ajouter une autre.', buttons: [{ text: 'OK', onPress: () => {} }] });
      return;
    }
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') {
          setAlert({ visible: true, type: 'error', title: 'Appareil photo', message: 'Autorisez l\'accès à l\'appareil photo dans les réglages.', buttons: [{ text: 'OK', onPress: () => {} }] });
          return;
        }
        const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
        if (!r.canceled && r.assets?.[0]) set('images', [...form.images, r.assets[0].uri]);
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      });
      if (!r.canceled) set('images', [...form.images, ...r.assets.slice(0, remaining).map((x) => x.uri)]);
    } catch {
      setAlert({ visible: true, type: 'error', title: 'Photos', message: 'Impossible d\'ajouter la photo.', buttons: [{ text: 'OK', onPress: () => {} }] });
    }
  };

  // La photo touchée devient la couverture (première position)
  const setCover = (index) => {
    Haptics.selectionAsync().catch(() => {});
    const imgs = [...form.images];
    const [picked] = imgs.splice(index, 1);
    set('images', [picked, ...imgs]);
  };

  const validate = (s) => {
    const e = {};
    if (s === 1 || s === 'all') {
      if (form.images.length === 0) e.images = 'Ajoutez au moins une photo';
      if (!form.title.trim() || form.title.trim().length < 5) e.title = 'Le titre doit faire au moins 5 caractères';
      if (!form.category) e.category = 'Choisissez une catégorie';
    }
    if (s === 2 || s === 'all') {
      const wc = form.description.trim().split(/\s+/).filter(Boolean).length;
      if (wc > 150) e.description = 'Maximum 150 mots';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });
  const next = () => {
    if (validate(step)) { Haptics.selectionAsync().catch(() => {}); setStep(s => s + 1); scrollToTop(); }
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  };
  const prev = () => { setStep(s => s - 1); scrollToTop(); };

  const resetPublishState = useCallback(() => {
    setForm(createEmptyForm());
    setStep(1);
    setOriginalImages([]);
    setDeletedImages([]);
    setSpecKey('');
    setSpecVal('');
    setDelArea('');
    setErrors({});
    setDraftBanner(false);
    draftAcknowledgedRef.current = false;
    if (paramsRef.current?.editItem) {
      navigation.setParams?.({ editItem: undefined });
    }
  }, [navigation]);

  const dismissDraftBanner = () => {
    draftAcknowledgedRef.current = true;
    setDraftBanner(false);
  };

  // Repartir d'un formulaire vierge : efface le brouillon en cours
  const discardDraft = () => {
    resetPublishState();
  };

  useFocusEffect(
    useCallback(() => {
      const params = paramsRef.current || {};
      const hasEditItem = Boolean(params.editItem);
      const hasAutoSubmit = Boolean(params.autoSubmit);

      // Nettoyage léger des états transitoires à chaque focus
      setErrors({});
      setSpecKey('');
      setSpecVal('');
      setDelArea('');

      if (hasEditItem) {
        // Intention = MODIFIER : repartir de l'étape 1, l'item est chargé par l'effet dédié
        setStep(1);
        return () => {
          // Quitter une édition non finalisée => on annule (évite les données fantômes)
          resetPublishState();
        };
      }

      if (hasAutoSubmit) {
        // Intention = REPRISE post-authentification : géré par l'effet autoSubmit
        return undefined;
      }

      // Intention = CRÉATION
      setOriginalImages([]);
      setDeletedImages([]);

      if (hasPublishContent(formRef.current) && !draftAcknowledgedRef.current) {
        // Un brouillon non publié subsiste : on l'affiche, on ne l'écrase pas
        setDraftBanner(true);
      } else {
        resetPublishState();
      }

      return undefined;
    }, [navigation, resetPublishState])
  );

  const doSubmit = async () => {
    try {
      setSubmitting(true);
      const data = {
        title: form.title, description: form.description,
        category: form.category, subcategory: form.subcategory || '',
        // Prix facultatif : vide = 0 F
        type: form.type, price: form.price || "0",
        location: user?.location || 'Niger', quantity: '1',
            delivery: { available: form.delivery, cost: form.deliveryCost, areas: form.deliveryAreas, estimatedTime: '' },
            availability: form.availability,
            specifications: form.specifications,
            promoted: false, featured: false,
          };
          if (form.type === 'product') data.condition = form.condition;
          if (isEditing) {
            const newLocalUris = form.images.filter((img) => !isRemoteImageUrl(img));
            const newImagesBase64 = newLocalUris.length ? await imagesToBase64(newLocalUris) : [];
            const removed = deletedImages.filter((url) => originalImages.includes(url));
            data.newImages = newImagesBase64;
            data.deleteImages = removed;
            await updateProduct(editItemId, data);
          } else {
            const imagesB64 = await imagesToBase64(form.images);
            data.images = imagesB64;
            await createProduct(data);
          }
          resetPublishState();
          if (isEditing) {
            navigation.navigate('ProductDetail', { productId: editItemId });
          } else {
            navigation.navigate('MainTabs', {
              screen: 'Profile',
              // initial: false : le profil reste dessous, l'onglet Profil y ramène
              params: { screen: 'MyListingsTab', initial: false },
            });
          }
        } catch (e) {
          setAlert({
            visible: true,
            type: 'error',
            title: 'Erreur',
            message: e.message || "Impossible de publier l'annonce",
            buttons: [{ text: 'OK', onPress: () => {} }],
          });
        } finally { setSubmitting(false); }
  };

  const doSubmitDraft = async (draftForm) => {
    try {
      setSubmitting(true);
      const data = {
        title: draftForm.title, description: draftForm.description,
        category: draftForm.category, subcategory: draftForm.subcategory || '',
        type: draftForm.type, price: draftForm.price || "0",
        location: user?.location || 'Niger', quantity: '1',
        delivery: { available: draftForm.delivery, cost: draftForm.deliveryCost, areas: draftForm.deliveryAreas, estimatedTime: '' },
        availability: draftForm.availability,
        specifications: draftForm.specifications,
        promoted: false, featured: false,
      };
      if (draftForm.type === 'product') data.condition = draftForm.condition;
      if (draftForm.editItemId) {
        const newLocalUris = (draftForm.images || []).filter((img) => !isRemoteImageUrl(img));
        const newImagesBase64 = newLocalUris.length ? await imagesToBase64(newLocalUris) : [];
        data.newImages = newImagesBase64;
        data.deleteImages = deletedImages;
        await updateProduct(draftForm.editItemId, data);
      } else {
        const imagesB64 = await imagesToBase64(draftForm.images);
        data.images = imagesB64;
        await createProduct(data);
      }
      resetPublishState();
      setAlert({
        visible: true,
        type: 'success',
        title: 'Succès 🎉',
        message: draftForm.editItemId
          ? 'Votre annonce a été mise à jour automatiquement après la connexion !'
          : 'Votre annonce a été publiée automatiquement après la connexion !',
        buttons: [{
          text: 'Super !',
          onPress: () => {
            if (draftForm.editItemId) {
              navigation.navigate('ProductDetail', { productId: draftForm.editItemId });
            } else {
              navigation.navigate('MainTabs', {
                screen: 'Profile',
                // initial: false : le profil reste dessous, l'onglet Profil y ramène
              params: { screen: 'MyListingsTab', initial: false },
              });
            }
          }
        }],
      });
    } catch (e) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Erreur lors de la publication',
        message: e.message || "L'annonce n'a pas pu être publiée.",
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
    } finally { setSubmitting(false); }
  };

  const submit = async () => {
    if (!validate('all')) {
      // Une erreur à l'étape 1 (photo, titre, catégorie) : on y retourne
      if (form.images.length === 0 || form.title.trim().length < 5 || !form.category) { setStep(1); scrollToTop(); }
      else { setStep(2); scrollToTop(); }
      return;
    }
    
    if (!isAuthenticated) {
      // Sauvegarder le brouillon dans le store global
      const draftSummary = buildPublishSummary(form, categories, isEditing ? editItemId : '');
      temporaryDraftStore = { form: { ...form, editItemId: isEditing ? editItemId : '' }, step, draftSummary };

      navigation.navigate('QuickAuth', {
        pendingAction: { 
          type: 'publish_submit',
          params: { autoSubmit: true, draftSummary }
        },
        returnScreen: 'Publish',
        returnParams: { autoSubmit: true }
      });
      return;
    }

    // On soumet directement sans demander de confirmation supplémentaire
    doSubmit();
  };

  // Catégories proposées selon le type (produit / service)
  const typeCategories = filterCategoriesForType(categories, form.type);
  const selectedCat = typeCategories.find(c => c._id === form.category) || categories.find(c => c._id === form.category);
  const wordCount   = form.description.trim().split(/\s+/).filter(Boolean).length;
  const isService   = form.type === 'service';
  const accent = isService ? P.blue : P.terra;
  const accentSoft = isService ? '#DBEAFE' : P.peachSoft;
  const accentDark = isService ? '#1D4ED8' : P.orange700;
  
  // ── Rendu principal ─────────────────────────────────────────────────────────
  const st = makeStyles(theme, isDark, accent, accentSoft);
  const STEPS = ['L\'essentiel', 'Prix & détails', 'Aperçu'];
  const priceNum = Number(form.price) || 0;
  const titleLen = form.title.trim().length;

  // Qualité de l'annonce : guide le vendeur vers une annonce qui vend
  const quality = [
    { ok: form.images.length >= 3, label: '3 photos ou plus', hint: 'Les annonces avec 3 photos reçoivent plus de messages' },
    { ok: titleLen >= 15, label: 'Un titre précis', hint: 'Marque, modèle, taille…' },
    { ok: wordCount >= 15, label: 'Une description détaillée', hint: 'Au moins 15 mots' },
    { ok: Boolean(form.subcategory), label: 'Une sous-catégorie', hint: 'Pour être trouvé plus facilement' },
  ];
  const qualityScore = Math.round((quality.filter((q) => q.ok).length / quality.length) * 100);

  const cityChips = NIGER_CITIES.filter((c) => !form.deliveryAreas.includes(c));
  const toggleDay = (day) => {
    const days = form.availability.days || [];
    set('availability', { ...form.availability, days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day] });
  };

  return (
    <KeyboardAwareView style={[st.container]}>
      {/* ── EN-TÊTE ─────────────────────────────────────────────────────── */}
      <View style={[st.header, { paddingTop: (insets.top || 0) + 10 }]}>
        <View style={st.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>{isEditing ? 'Modifier l\'annonce' : 'Nouvelle annonce'}</Text>
            <Text style={st.headerSub}>Étape {step} sur 3 · {STEPS[step - 1]}</Text>
          </View>
          {hasPublishContent(form) && !isEditing ? (
            <Pressable onPress={discardDraft} hitSlop={8} style={st.resetBtn} accessibilityLabel="Recommencer">
              <Ionicons name="refresh" size={16} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <View style={st.progTrack}>
          <Animated.View style={[st.progFill, { width: progress.interpolate({ inputRange: [1, 3], outputRange: ['33%', '100%'] }) }]}>
            <LinearGradient colors={[accent, accentDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      </View>

      <KeyboardAwareScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[st.scroll, { paddingBottom: keyboardVisible ? 20 : 28 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        {draftBanner && (
          <View style={st.draft}>
            <View style={st.draftIcon}><Ionicons name="document-text" size={18} color={accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.draftTitle}>Brouillon retrouvé</Text>
              <Text style={st.draftSub}>Reprenez là où vous vous êtes arrêté.</Text>
            </View>
            <Pressable onPress={discardDraft} hitSlop={6}><Text style={st.draftLink}>Effacer</Text></Pressable>
            <Pressable onPress={dismissDraftBanner} style={st.draftBtn}><Text style={st.draftBtnTxt}>Reprendre</Text></Pressable>
          </View>
        )}

        {/* ══════════ ÉTAPE 1 — L'ESSENTIEL ═══════════════════════════════ */}
        {step === 1 && (
          <View style={st.stack}>
            {/* Produit / Service */}
            <View style={st.segment}>
              {[
                { value: 'product', label: 'Je vends un produit', icon: 'cube' },
                { value: 'service', label: 'Je propose un service', icon: 'construct' },
              ].map((o) => {
                const active = form.type === o.value;
                return (
                  <Pressable key={o.value} onPress={() => { tap(); changeType(o.value); }} style={[st.segItem, active && st.segItemActive]}>
                    <Ionicons name={o.icon} size={17} color={active ? '#fff' : theme.textMuted} />
                    <Text style={[st.segTxt, active && { color: '#fff' }]} numberOfLines={1}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Photos */}
            <Section title="Photos" hint={`${form.images.length}/5 · la première est la couverture`} error={errors.images} st={st}>
              {form.images.length === 0 ? (
                <View style={st.dropzone}>
                  <View style={st.dropIcon}><Ionicons name="images" size={28} color={accent} /></View>
                  <Text style={st.dropTitle}>Ajoutez vos photos</Text>
                  <Text style={st.dropSub}>Des photos nettes et lumineuses vendent jusqu'à 2× plus vite.</Text>
                  <View style={st.dropActions}>
                    <Pressable onPress={() => pickImages('camera')} style={[st.dropBtn, st.dropBtnPrimary]}>
                      <Ionicons name="camera" size={17} color="#fff" />
                      <Text style={[st.dropBtnTxt, { color: '#fff' }]}>Appareil photo</Text>
                    </Pressable>
                    <Pressable onPress={() => pickImages('library')} style={st.dropBtn}>
                      <Ionicons name="images-outline" size={17} color={accent} />
                      <Text style={st.dropBtnTxt}>Galerie</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.thumbs}>
                  {form.images.map((uri, i) => (
                    <Pressable key={`${uri}-${i}`} onPress={() => i > 0 && setCover(i)} style={[st.thumb, i === 0 && st.thumbCover]}>
                      <Image source={{ uri }} style={st.thumbImg} />
                      {i === 0 ? (
                        <View style={st.coverBadge}><Ionicons name="star" size={10} color="#fff" /><Text style={st.coverTxt}>Couverture</Text></View>
                      ) : (
                        <View style={st.makeCover}><Text style={st.makeCoverTxt}>Mettre en 1er</Text></View>
                      )}
                      <Pressable onPress={() => handleRemoveImage(i)} hitSlop={8} style={st.thumbRemove} accessibilityLabel="Retirer la photo">
                        <Ionicons name="close" size={14} color="#fff" />
                      </Pressable>
                    </Pressable>
                  ))}
                  {form.images.length < 5 ? (
                    <View style={st.addCol}>
                      <Pressable onPress={() => pickImages('camera')} style={st.addTile} accessibilityLabel="Prendre une photo">
                        <Ionicons name="camera-outline" size={20} color={accent} />
                      </Pressable>
                      <Pressable onPress={() => pickImages('library')} style={st.addTile} accessibilityLabel="Ajouter depuis la galerie">
                        <Ionicons name="images-outline" size={21} color={accent} />
                      </Pressable>
                    </View>
                  ) : null}
                </ScrollView>
              )}
            </Section>

            {/* Titre */}
            <Section title="Titre" hint={`${titleLen}/80`} error={errors.title} st={st}>
              <Input
                st={st}
                icon="create-outline"
                placeholder={isService ? 'Ex : Réparation de téléphones à domicile' : 'Ex : iPhone 13 Pro 256 Go, très bon état'}
                value={form.title}
                onChangeText={(t) => set('title', t.slice(0, 80))}
                error={errors.title}
              />
            </Section>

            {/* Catégorie */}
            <Section title="Catégorie" error={errors.category} st={st}>
              {loadingCats ? (
                <ActivityIndicator color={accent} style={{ marginVertical: 18 }} />
              ) : (
                <View style={st.catGrid}>
                  {typeCategories.map((cat) => {
                    const active = form.category === cat._id;
                    return (
                      <Pressable
                        key={cat._id}
                        onPress={() => { tap(); setErrors((e) => ({ ...e, category: undefined })); setForm((p) => ({ ...p, category: cat._id, subcategory: p.category === cat._id ? p.subcategory : '' })); }}
                        style={[st.catTile, active && st.catTileActive]}
                      >
                        <CategoryIcon item={cat} size={34} />
                        <Text style={[st.catName, active && { color: accent, fontWeight: '800' }]} numberOfLines={2}>{cat.name}</Text>
                        {active ? <View style={st.catCheck}><Ionicons name="checkmark" size={11} color="#fff" /></View> : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Section>

            {selectedCat?.subcategories?.length > 0 && (
              <Section title={`Précisez : ${selectedCat.name}`} st={st}>
                <View style={st.chipsWrap}>
                  {selectedCat.subcategories.map((sub) => {
                    const active = form.subcategory === sub.slug;
                    return (
                      <Pressable key={sub._id || sub.slug} onPress={() => { tap(); set('subcategory', active ? '' : sub.slug); }} style={[st.chip, active && st.chipActive]}>
                        <CategoryIcon item={sub} parent={selectedCat} size={20} />
                        <Text style={[st.chipTxt, active && { color: accent, fontWeight: '800' }]}>{sub.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Section>
            )}
          </View>
        )}

        {/* ══════════ ÉTAPE 2 — PRIX & DÉTAILS ════════════════════════════ */}
        {step === 2 && (
          <View style={st.stack}>
            {/* Prix */}
            <View style={st.priceCard}>
              <Text style={st.priceLabel}>{isService ? 'Votre tarif' : 'Votre prix'} · facultatif</Text>
              <View style={st.priceRow}>
                <TextInput
                  style={st.priceInput}
                  value={priceNum ? groupThousands(priceNum) : ''}
                  onChangeText={(t) => set('price', t.replace(/\D/g, '').slice(0, 10))}
                  placeholder="0"
                  placeholderTextColor={theme.textSoft}
                  keyboardType="number-pad"
                />
                <Text style={st.priceCurrency}>FCFA</Text>
              </View>
              <Text style={st.priceHint}>
                {!priceNum
                  ? 'Laissez vide pour publier à 0 F.'
                  : isService ? 'Indiquez un prix « à partir de ».' : 'Un prix juste attire plus d\'acheteurs.'}
              </Text>
            </View>

            {/* État */}
            {form.type === 'product' && (
              <Section title="État" st={st}>
                <View style={st.condRow}>
                  {[
                    { value: 'new', label: 'Neuf', icon: 'sparkles' },
                    { value: 'refurbished', label: 'Reconditionné', icon: 'refresh-circle' },
                    { value: 'used', label: 'Occasion', icon: 'repeat' },
                  ].map((o) => {
                    const active = form.condition === o.value;
                    return (
                      <Pressable key={o.value} onPress={() => { tap(); set('condition', o.value); }} style={[st.condItem, active && st.condItemActive]}>
                        <Ionicons name={o.icon} size={20} color={active ? accent : theme.textMuted} />
                        <Text style={[st.condTxt, active && { color: accent, fontWeight: '800' }]}>{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Section>
            )}

            {/* Description */}
            <Section title="Description" hint={`${wordCount}/150 mots`} error={errors.description} st={st}>
              <Input
                st={st}
                multiline
                placeholder={isService
                  ? 'Ce que vous proposez, votre expérience, la zone où vous intervenez…'
                  : 'État, ancienneté, accessoires fournis, raison de la vente…'}
                value={form.description}
                onChangeText={(t) => {
                  const wc = t.trim().split(/\s+/).filter(Boolean).length;
                  if (wc <= 150) set('description', t);
                }}
                error={errors.description}
              />
            </Section>

            {/* Livraison (produit) */}
            {form.type === 'product' && (
              <View style={st.optCard}>
                <View style={st.optHead}>
                  <View style={st.optIcon}><Ionicons name="bicycle" size={18} color={accent} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.optTitle}>Livraison</Text>
                    <Text style={st.optSub}>{form.delivery ? 'Vous livrez vos acheteurs' : 'Proposez-vous la livraison ?'}</Text>
                  </View>
                  <Switch
                    value={form.delivery}
                    onValueChange={(v) => { tap(); set('delivery', v); }}
                    trackColor={{ false: theme.divider, true: accentSoft }}
                    thumbColor={form.delivery ? accent : '#f4f4f5'}
                  />
                </View>
                {form.delivery && (
                  <View style={{ gap: 12, marginTop: 14 }}>
                    <Input
                      st={st}
                      icon="cash-outline"
                      placeholder="Coût de livraison (0 = offerte)"
                      value={form.deliveryCost}
                      onChangeText={(t) => set('deliveryCost', t.replace(/\D/g, ''))}
                      keyboardType="number-pad"
                      suffix="FCFA"
                    />
                    <Text style={st.subLabel}>Zones desservies</Text>
                    {form.deliveryAreas.length > 0 && (
                      <View style={st.chipsWrap}>
                        {form.deliveryAreas.map((a) => (
                          <Pressable key={a} onPress={() => set('deliveryAreas', form.deliveryAreas.filter((x) => x !== a))} style={[st.chip, st.chipActive]}>
                            <Ionicons name="location" size={13} color={accent} />
                            <Text style={[st.chipTxt, { color: accent, fontWeight: '700' }]}>{a}</Text>
                            <Ionicons name="close" size={13} color={accent} />
                          </Pressable>
                        ))}
                      </View>
                    )}
                    <View style={st.chipsWrap}>
                      {cityChips.slice(0, 8).map((c) => (
                        <Pressable key={c} onPress={() => { tap(); set('deliveryAreas', [...form.deliveryAreas, c]); }} style={st.chip}>
                          <Ionicons name="add" size={13} color={theme.textMuted} />
                          <Text style={st.chipTxt}>{c}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <View style={st.inlineAdd}>
                      <View style={{ flex: 1 }}>
                        <Input st={st} placeholder="Autre quartier ou ville" value={delArea} onChangeText={setDelArea} />
                      </View>
                      <Pressable
                        style={st.addBtn}
                        onPress={() => {
                          const v = delArea.trim();
                          if (v && !form.deliveryAreas.includes(v)) { set('deliveryAreas', [...form.deliveryAreas, v]); setDelArea(''); }
                        }}
                      >
                        <Ionicons name="add" size={22} color="#fff" />
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Caractéristiques (produit) */}
            {form.type === 'product' && (
              <View style={st.optCard}>
                <View style={st.optHead}>
                  <View style={st.optIcon}><Ionicons name="list" size={18} color={accent} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.optTitle}>Caractéristiques <Text style={st.optional}>· facultatif</Text></Text>
                    <Text style={st.optSub}>Couleur, taille, capacité, marque…</Text>
                  </View>
                </View>
                {Object.keys(form.specifications).length > 0 && (
                  <View style={st.specList}>
                    {Object.entries(form.specifications).map(([k, v]) => (
                      <View key={k} style={st.specRow}>
                        <Text style={st.specK} numberOfLines={1}>{k}</Text>
                        <Text style={st.specV} numberOfLines={1}>{v}</Text>
                        <Pressable hitSlop={8} onPress={() => { const ns = { ...form.specifications }; delete ns[k]; set('specifications', ns); }}>
                          <Ionicons name="close-circle" size={18} color={theme.iconMuted} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
                <View style={[st.inlineAdd, { marginTop: 12 }]}>
                  <View style={{ flex: 1 }}><Input st={st} placeholder="Ex : Couleur" value={specKey} onChangeText={setSpecKey} /></View>
                  <View style={{ flex: 1 }}><Input st={st} placeholder="Ex : Noir" value={specVal} onChangeText={setSpecVal} /></View>
                  <Pressable
                    style={st.addBtn}
                    onPress={() => {
                      if (specKey.trim() && specVal.trim()) {
                        set('specifications', { ...form.specifications, [specKey.trim()]: specVal.trim() });
                        setSpecKey(''); setSpecVal('');
                      }
                    }}
                  >
                    <Ionicons name="add" size={22} color="#fff" />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Disponibilités (service) */}
            {form.type === 'service' && (
              <View style={st.optCard}>
                <View style={st.optHead}>
                  <View style={st.optIcon}><Ionicons name="time" size={18} color={accent} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.optTitle}>Disponibilités</Text>
                    <Text style={st.optSub}>Jours et horaires où l'on peut vous solliciter</Text>
                  </View>
                </View>
                <View style={st.daysRow}>
                  {DAYS.map((d) => {
                    const active = (form.availability.days || []).includes(d.value);
                    return (
                      <Pressable key={d.value} onPress={() => { tap(); toggleDay(d.value); }} style={[st.dayChip, active && st.dayChipActive]}>
                        <Text style={[st.dayTxt, active && { color: '#fff' }]}>{d.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={[st.inlineAdd, { marginTop: 12 }]}>
                  <View style={{ flex: 1 }}>
                    <Input st={st} icon="sunny-outline" placeholder="Ouvre à 8h" value={form.availability.openingTime}
                      onChangeText={(t) => set('availability', { ...form.availability, openingTime: t })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input st={st} icon="moon-outline" placeholder="Ferme à 18h" value={form.availability.closingTime}
                      onChangeText={(t) => set('availability', { ...form.availability, closingTime: t })} />
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ══════════ ÉTAPE 3 — APERÇU ═════════════════════════════════════ */}
        {step === 3 && (
          <View style={st.stack}>
            <Text style={st.previewKicker}>Votre annonce telle que les acheteurs la verront</Text>

            <View style={st.previewCard}>
              <View style={st.previewImgBox}>
                {form.images[0] ? <Image source={{ uri: form.images[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFill} />
                <View style={[st.previewType, { backgroundColor: isService ? P.blue600 : 'rgba(17,24,39,0.8)' }]}>
                  <Ionicons name={isService ? 'construct' : form.condition === 'new' ? 'sparkles' : 'cube'} size={11} color="#fff" />
                  <Text style={st.previewTypeTxt}>{isService ? 'Service' : CONDITION_LABEL[form.condition] || 'Produit'}</Text>
                </View>
                {form.images.length > 1 ? (
                  <View style={st.previewCount}><Ionicons name="camera" size={11} color="#fff" /><Text style={st.previewTypeTxt}>{form.images.length}</Text></View>
                ) : null}
              </View>
              <View style={st.previewBody}>
                <Text style={[st.previewPrice, { color: accent }]}>{formatPrice(form.price || '0')}</Text>
                <Text style={st.previewTitle} numberOfLines={2}>{form.title}</Text>
                <View style={st.previewMeta}>
                  <CategoryIcon item={selectedCat} size={16} />
                  <Text style={st.previewMetaTxt} numberOfLines={1}>
                    {selectedCat?.name}{form.subcategory ? ` · ${selectedCat?.subcategories?.find((x) => x.slug === form.subcategory)?.name || form.subcategory}` : ''}
                  </Text>
                </View>
                <View style={st.previewMeta}>
                  <Ionicons name="location-outline" size={14} color={theme.textSoft} />
                  <Text style={st.previewMetaTxt}>{user?.location || 'Niger'}</Text>
                  {form.type === 'product' && form.delivery ? (
                    <>
                      <Text style={st.previewMetaTxt}> · </Text>
                      <Ionicons name="bicycle-outline" size={14} color={theme.textSoft} />
                      <Text style={st.previewMetaTxt}>{Number(form.deliveryCost) ? `Livraison ${formatPrice(form.deliveryCost)}` : 'Livraison offerte'}</Text>
                    </>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Qualité de l'annonce */}
            <View style={st.qualityCard}>
              <View style={st.qualityHead}>
                <Text style={st.qualityTitle}>Qualité de l'annonce</Text>
                <Text style={[st.qualityScore, { color: qualityScore >= 75 ? '#16a34a' : qualityScore >= 50 ? '#d97706' : P.error }]}>{qualityScore} %</Text>
              </View>
              <View style={st.qualityTrack}>
                <View style={[st.qualityFill, { width: `${qualityScore}%`, backgroundColor: qualityScore >= 75 ? '#16a34a' : qualityScore >= 50 ? '#f59e0b' : P.error }]} />
              </View>
              {quality.map((q) => (
                <View key={q.label} style={st.qualityRow}>
                  <Ionicons name={q.ok ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={q.ok ? '#16a34a' : theme.iconMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[st.qualityLabel, q.ok && { color: theme.textMuted }]}>{q.label}</Text>
                    {!q.ok ? <Text style={st.qualityHint}>{q.hint}</Text> : null}
                  </View>
                </View>
              ))}
              {qualityScore < 100 ? (
                <Pressable onPress={() => { setStep(1); scrollToTop(); }} style={st.qualityEdit}>
                  <Ionicons name="create-outline" size={15} color={accent} />
                  <Text style={[st.qualityEditTxt, { color: accent }]}>Améliorer mon annonce</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Confidentialité : les échanges passent par la messagerie TakTak */}
            <View style={st.privacy}>
              <Ionicons name="shield-checkmark" size={20} color="#16a34a" />
              <Text style={st.privacyTxt}>
                Les acheteurs vous écrivent dans la messagerie TakTak. Votre numéro de téléphone reste privé.
              </Text>
            </View>
          </View>
        )}
      </KeyboardAwareScrollView>

      {/* ── PIED DE PAGE ─────────────────────────────────────────────────── */}
      <View style={[st.footer, { marginBottom: footerOffset, paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        {step > 1 && (
          <Pressable style={st.backBtn} onPress={prev} accessibilityLabel="Étape précédente">
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </Pressable>
        )}
        <Pressable style={({ pressed }) => [st.nextBtn, pressed && { opacity: 0.9 }]} onPress={step < 3 ? next : submit} disabled={submitting}>
          <LinearGradient colors={[accent, accentDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.nextGrad}>
            <Text style={st.nextTxt}>
              {step === 1 ? 'Continuer' : step === 2 ? 'Voir l\'aperçu' : isEditing ? 'Enregistrer les modifications' : 'Publier l\'annonce'}
            </Text>
            <Ionicons name={step < 3 ? 'arrow-forward' : 'rocket'} size={18} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>

      <AlertModal
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onDismiss={() => setAlert({ ...alert, visible: false })}
      />

      {/* Volontairement non fermable pendant l'envoi de l'annonce (retour Android ignoré) */}
      <Modal visible={submitting} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
        <View style={st.loaderOverlay}>
          <View style={st.loaderBox}>
            <LinearGradient colors={[accent, accentDark]} style={st.loaderIcon}>
              <ActivityIndicator size="large" color="#fff" />
            </LinearGradient>
            <Text style={st.loaderTitle}>{isEditing ? 'Mise à jour en cours…' : 'Publication en cours…'}</Text>
            <Text style={st.loaderSub}>Envoi de vos photos, quelques secondes…</Text>
          </View>
        </View>
      </Modal>
      {/* Barre ‹ › OK collée au clavier (le bouton du bas reste en place) */}
      <FormKeyboardToolbar />
    </KeyboardAwareView>
  );
}

// ─── Constantes & composants ─────────────────────────────────────────────────
const NIGER_CITIES = ['Niamey', 'Zinder', 'Maradi', 'Agadez', 'Tahoua', 'Dosso', 'Diffa', 'Tillabéri', 'Birni-N\'Konni', 'Arlit'];
const DAYS = [
  { value: 'lundi', label: 'Lun' }, { value: 'mardi', label: 'Mar' }, { value: 'mercredi', label: 'Mer' },
  { value: 'jeudi', label: 'Jeu' }, { value: 'vendredi', label: 'Ven' }, { value: 'samedi', label: 'Sam' },
  { value: 'dimanche', label: 'Dim' },
];
const CONDITION_LABEL = { new: 'Neuf', refurbished: 'Reconditionné', used: 'Occasion' };
const groupThousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const tap = () => Haptics.selectionAsync().catch(() => {});

function Section({ title, hint, error, children, st }) {
  return (
    <View style={st.section}>
      <View style={st.sectionHead}>
        <Text style={st.sectionTitle}>{title}</Text>
        {hint ? <Text style={st.sectionHint}>{hint}</Text> : null}
      </View>
      {children}
      {error ? (
        <View style={st.errorRow}>
          <Ionicons name="alert-circle" size={14} color={P.error} />
          <Text style={st.error}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Input({ st, icon, suffix, multiline, error, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[st.inputBox, multiline && st.inputBoxMulti, focused && st.inputBoxFocus, error && { borderColor: P.error }]}>
      {icon ? <Ionicons name={icon} size={17} color={focused ? st.accentColor.color : st.iconMuted.color} style={multiline ? { marginTop: 2 } : null} /> : null}
      <TextInput
        {...props}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={st.placeholder.color}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[st.input, multiline && st.inputMulti]}
      />
      {suffix ? <Text style={st.inputSuffix}>{suffix}</Text> : null}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styleCache = new Map();
function makeStyles(theme, isDark, accent, accentSoft) {
  const key = `${isDark}-${accent}-${theme.screen}`;
  if (styleCache.has(key)) return styleCache.get(key);
  const surface = isDark ? theme.surface : '#ffffff';
  const field = isDark ? theme.surfaceAlt : '#f4f5f8';
  const softAccent = isDark ? (accent === P.terra ? 'rgba(236,90,19,0.16)' : 'rgba(59,130,246,0.18)') : accentSoft;
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.screen },
    accentColor: { color: accent },
    iconMuted: { color: theme.iconMuted },
    placeholder: { color: theme.textSoft },

    header: { paddingHorizontal: 18, paddingBottom: 12, backgroundColor: theme.screen },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    headerTitle: { fontSize: 26, fontWeight: '900', color: theme.text, letterSpacing: -0.6 },
    headerSub: { fontSize: 13, fontWeight: '600', color: theme.textMuted, marginTop: 2 },
    resetBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: surface, borderWidth: 1, borderColor: theme.border },
    progTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e8eaef' },
    progFill: { height: '100%', borderRadius: 3, overflow: 'hidden' },

    scroll: { paddingHorizontal: 18, paddingTop: 6 },
    stack: { gap: 22 },

    draft: {
      flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, marginBottom: 18,
      backgroundColor: surface, borderWidth: 1, borderColor: theme.border,
    },
    draftIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: softAccent },
    draftTitle: { fontSize: 14, fontWeight: '800', color: theme.text },
    draftSub: { fontSize: 12, color: theme.textMuted },
    draftLink: { fontSize: 13, fontWeight: '700', color: theme.textMuted, marginRight: 4 },
    draftBtn: { paddingHorizontal: 12, height: 32, borderRadius: 16, justifyContent: 'center', backgroundColor: accent },
    draftBtnTxt: { color: '#fff', fontSize: 12.5, fontWeight: '800' },

    segment: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 18, backgroundColor: field },
    segItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 14, paddingHorizontal: 6 },
    segItemActive: { backgroundColor: accent, shadowColor: accent, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
    segTxt: { fontSize: 13, fontWeight: '800', color: theme.textMuted, flexShrink: 1 },

    section: { gap: 10 },
    sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
    sectionHint: { fontSize: 12, fontWeight: '600', color: theme.textSoft },
    subLabel: { fontSize: 13, fontWeight: '700', color: theme.textMuted },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    error: { fontSize: 12.5, fontWeight: '600', color: P.error },

    dropzone: {
      alignItems: 'center', paddingVertical: 24, paddingHorizontal: 18, borderRadius: 20,
      borderWidth: 1.5, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.18)' : accent + '66', backgroundColor: softAccent,
    },
    dropIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: surface, marginBottom: 10 },
    dropTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
    dropSub: { fontSize: 13, color: theme.textMuted, textAlign: 'center', marginTop: 4, maxWidth: 260, lineHeight: 18 },
    dropActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
    dropBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 42, borderRadius: 14, backgroundColor: surface, borderWidth: 1, borderColor: theme.border },
    dropBtnPrimary: { backgroundColor: accent, borderColor: accent },
    dropBtnTxt: { fontSize: 13.5, fontWeight: '800', color: accent },

    thumbs: { gap: 10, paddingRight: 4 },
    thumb: { width: 104, height: 128, borderRadius: 16, overflow: 'hidden', backgroundColor: field },
    thumbCover: { borderWidth: 2.5, borderColor: accent },
    thumbImg: { width: '100%', height: '100%' },
    coverBadge: { position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: accent },
    coverTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
    makeCover: { position: 'absolute', left: 6, right: 6, bottom: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center' },
    makeCoverTxt: { color: '#fff', fontSize: 9.5, fontWeight: '700' },
    thumbRemove: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
    addCol: { gap: 8 },
    addTile: {
      width: 60, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.2)' : accent + '66', backgroundColor: softAccent,
    },

    inputBox: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: 16, backgroundColor: field, borderWidth: 1.5, borderColor: 'transparent' },
    inputBoxMulti: { alignItems: 'flex-start', paddingTop: 13, minHeight: 130 },
    inputBoxFocus: { borderColor: accent, backgroundColor: surface },
    input: { flex: 1, fontSize: 15, color: theme.text, paddingVertical: 13 },
    inputMulti: { minHeight: 110, paddingTop: 0 },
    inputSuffix: { fontSize: 13, fontWeight: '800', color: theme.textSoft },

    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    catTile: {
      width: '23.4%', aspectRatio: 0.88, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4,
      backgroundColor: surface, borderWidth: 1.5, borderColor: theme.border,
    },
    catTileActive: { borderColor: accent, backgroundColor: softAccent },
    catName: { fontSize: 11, fontWeight: '600', color: theme.text, textAlign: 'center', lineHeight: 13 },
    catCheck: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: accent },

    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 38, borderRadius: 19, backgroundColor: surface, borderWidth: 1.5, borderColor: theme.border },
    chipActive: { borderColor: accent, backgroundColor: softAccent },
    chipTxt: { fontSize: 13, fontWeight: '600', color: theme.textMuted },

    priceCard: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16, borderRadius: 22, backgroundColor: surface, borderWidth: 1.5, borderColor: theme.border },
    priceLabel: { fontSize: 13, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
    priceInput: { fontSize: 40, fontWeight: '900', color: accent, minWidth: 60, textAlign: 'center', paddingVertical: 2, letterSpacing: -1 },
    priceCurrency: { fontSize: 18, fontWeight: '800', color: theme.textSoft },
    priceHint: { fontSize: 12.5, color: theme.textSoft, marginTop: 6 },

    condRow: { flexDirection: 'row', gap: 8 },
    condItem: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 16, backgroundColor: surface, borderWidth: 1.5, borderColor: theme.border },
    condItemActive: { borderColor: accent, backgroundColor: softAccent },
    condTxt: { fontSize: 12.5, fontWeight: '600', color: theme.textMuted },

    optCard: { padding: 14, borderRadius: 20, backgroundColor: surface, borderWidth: 1, borderColor: theme.border },
    optHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    optIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: softAccent },
    optTitle: { fontSize: 15, fontWeight: '800', color: theme.text },
    optional: { fontSize: 12, fontWeight: '600', color: theme.textSoft },
    optSub: { fontSize: 12.5, color: theme.textMuted, marginTop: 1 },
    inlineAdd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    addBtn: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: accent },
    specList: { marginTop: 12, gap: 6 },
    specRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: field },
    specK: { width: '38%', fontSize: 13, fontWeight: '700', color: theme.textMuted },
    specV: { flex: 1, fontSize: 13.5, fontWeight: '600', color: theme.text },
    daysRow: { flexDirection: 'row', gap: 5, marginTop: 12 },
    dayChip: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: field },
    dayChipActive: { backgroundColor: accent },
    dayTxt: { fontSize: 12.5, fontWeight: '800', color: theme.textMuted },

    previewKicker: { fontSize: 13, fontWeight: '700', color: theme.textMuted },
    previewCard: {
      borderRadius: 22, overflow: 'hidden', backgroundColor: surface, borderWidth: 1, borderColor: theme.border,
      shadowColor: '#0f172a', shadowOpacity: isDark ? 0 : 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: isDark ? 0 : 4,
    },
    previewImgBox: { height: 230, backgroundColor: field },
    previewType: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
    previewCount: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)' },
    previewTypeTxt: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
    previewBody: { padding: 14, gap: 5 },
    previewPrice: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    previewTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
    previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    previewMetaTxt: { fontSize: 12.5, color: theme.textSoft },

    qualityCard: { padding: 16, borderRadius: 20, backgroundColor: surface, borderWidth: 1, borderColor: theme.border, gap: 10 },
    qualityHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    qualityTitle: { fontSize: 15, fontWeight: '800', color: theme.text },
    qualityScore: { fontSize: 16, fontWeight: '900' },
    qualityTrack: { height: 6, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#eef0f4', overflow: 'hidden' },
    qualityFill: { height: '100%', borderRadius: 3 },
    qualityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    qualityLabel: { fontSize: 14, fontWeight: '700', color: theme.text },
    qualityHint: { fontSize: 12, color: theme.textSoft, marginTop: 1 },
    qualityEdit: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 2 },
    qualityEditTxt: { fontSize: 13.5, fontWeight: '800' },

    privacy: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: isDark ? 'rgba(34,197,94,0.10)' : '#f0fdf4' },
    privacyTxt: { flex: 1, fontSize: 13, lineHeight: 19, color: theme.textMuted, fontWeight: '600' },

    footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 12, backgroundColor: theme.screen, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    backBtn: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: surface, borderWidth: 1, borderColor: theme.border },
    nextBtn: { flex: 1, borderRadius: 18, overflow: 'hidden', shadowColor: accent, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
    nextGrad: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    nextTxt: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },

    loaderOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    loaderBox: { width: 270, alignItems: 'center', padding: 24, borderRadius: 24, backgroundColor: surface },
    loaderIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    loaderTitle: { fontSize: 17, fontWeight: '900', color: theme.text },
    loaderSub: { fontSize: 13, color: theme.textMuted, marginTop: 4, textAlign: 'center' },
  });
  styleCache.set(key, styles);
  return styles;
}
