// ─── PublishScreen v2 PREMIUM ─ MarketHub Niger ───────────────────────────────
// Formulaire de publication — design cohérent, épuré, 3 étapes

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, ActivityIndicator, KeyboardAvoidingView,
  Platform, Dimensions, Switch, StatusBar, Modal, Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { getCategories } from '../api/categories';
import { createProduct, updateProduct, imagesToBase64 } from '../api/products';
import AlertModal from '../components/AlertModal';
import { MOBILE_COLORS as P } from '../theme/colors';

const { width } = Dimensions.get('window');

const iconToEmoji = {
  Smartphone:'📱', UtensilsCrossed:'🍔', Home:'🏠', Car:'🚗', Shirt:'👕',
  Wrench:'🔧', Laptop:'💻', Dumbbell:'🏋️', Baby:'👶', PawPrint:'🐾',
  Book:'📚', Palette:'🎨', Briefcase:'💼', Gamepad2:'🎮', HardHat:'⛑️', Package:'📦',
};
const getEmoji = (icon) => iconToEmoji[icon] || '📦';
const CATEGORY_CARD_GAP = 8;
const CATEGORY_CARD_WIDTH = Math.floor((width - 18 * 2 - CATEGORY_CARD_GAP * 3) / 4);

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

// ─── COMPOSANTS RÉUTILISABLES ─────────────────────────────────────────────────

// Variable globale pour stocker le brouillon temporaire pendant l'authentification
let temporaryDraftStore = null;

function Field({ label, error, children, inline = false, labelWidth = 88 }) {
  const { theme } = useAppTheme();

  return (
    <View style={f.field}>
      {inline ? (
        <View style={f.inlineRow}>
          <Text style={[f.label, f.labelInline, { color: theme.text, width: labelWidth }]}>{label}</Text>
          <View style={f.inlineControl}>{children}</View>
        </View>
      ) : (
        <>
          <Text style={[f.label, { color: theme.text }]}>{label}</Text>
          {children}
        </>
      )}
      {error ? <Text style={f.error}>{error}</Text> : null}
    </View>
  );
}

function StepInput({ placeholder, value, onChangeText, keyboardType, multiline, error }) {
  const { theme } = useAppTheme();

  return (
    <TextInput
      style={[
        f.input,
        {
          backgroundColor: theme.inputBg,
          borderColor: error ? P.error : theme.border,
          color: theme.inputText,
        },
        multiline && f.textarea,
      ]}
      placeholder={placeholder}
      placeholderTextColor={theme.inputPlaceholder}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType || 'default'}
      multiline={multiline}
      numberOfLines={multiline ? 5 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  );
}

function ChoiceBtn({ label, emoji, active, onPress, accent = P.terra, activeBg = P.peachSoft }) {
  const { theme } = useAppTheme();

  return (
    <TouchableOpacity
      style={[
        f.choice,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        active && {
          borderColor: accent,
          backgroundColor: activeBg,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {emoji ? <Text style={f.choiceEmoji}>{emoji}</Text> : null}
      <Text style={[f.choiceTxt, { color: theme.textMuted }, active && { color: accent, fontWeight: '800' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

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

  const [form, setForm] = useState({
    type: 'product', title: '', category: '', subcategory: '',
    price: '', description: '', condition: 'used', images: [],
    delivery: false, deliveryCost: '', deliveryAreas: [],
    specifications: {},
    availability: { openingTime: '', closingTime: '', days: [] },
  });

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

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
    setForm({
      type: editItem.type || 'product',
      title: editItem.title || '',
      category: normalizeCategoryValue(editItem.category),
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

  const pickImages = async () => {
    if (form.images.length >= 5) {
      setAlert({
        visible: true,
        type: 'warning',
        title: 'Limite',
        message: 'Maximum 5 images',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true, quality: 0.8,
    });
    if (!r.canceled) {
      const imgs = r.assets.slice(0, 5 - form.images.length).map(a => a.uri);
      set('images', [...form.images, ...imgs]);
    }
  };

  const validate = (s) => {
    const e = {};
    if (s === 1) {
      if (!form.title.trim() || form.title.length < 5) e.title = 'Minimum 5 caractères';
      if (!form.category) e.category = 'Catégorie requise';
    }
    if (s === 2) {
      if (!form.price || isNaN(Number(form.price))) e.price = 'Prix invalide';
      if (form.images.length === 0) e.images = 'Au moins 1 image requise';
      const wc = form.description.trim().split(/\s+/).filter(Boolean).length;
      if (wc > 150) e.description = 'Maximum 150 mots';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => validate(step) && setStep(s => s + 1);
  const prev = () => setStep(s => s - 1);

  const resetPublishState = () => {
    setForm({
      type:'product',
      title:'',
      category:'',
      subcategory:'',
      price:'',
      description:'',
      condition:'used',
      images:[],
      delivery:false,
      deliveryCost:'',
      deliveryAreas:[],
      specifications:{},
      availability:{ openingTime:'', closingTime:'', days:[] },
    });
    setStep(1);
    setOriginalImages([]);
    setDeletedImages([]);
    navigation.setParams?.({ editItem: undefined });
  };

  const doSubmit = async () => {
    try {
      setSubmitting(true);
      const data = {
        title: form.title, description: form.description,
        category: form.category, subcategory: form.subcategory || '',
        type: form.type, price: form.price,
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
          setAlert({
            visible: true,
            type: 'success',
            title: 'Succès 🎉',
            message: isEditing ? 'Annonce mise à jour avec succès' : 'Annonce publiée avec succès',
            buttons: [{
              text: 'OK',
              onPress: () => {
                resetPublishState();
                navigation.navigate('MyListings');
              }
            }],
          });
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
        type: draftForm.type, price: draftForm.price,
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
            resetPublishState();
            navigation.navigate('MyListings');
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
    if (!validate(2)) return;
    
    if (!isAuthenticated) {
      // Sauvegarder le brouillon dans le store global
      temporaryDraftStore = { form: { ...form, editItemId: isEditing ? editItemId : '' }, step };

      navigation.navigate('QuickAuth', {
        pendingAction: { 
          type: 'publish_submit',
          params: { autoSubmit: true }
        },
        returnScreen: 'Publish'
      });
      return;
    }

    // On soumet directement sans demander de confirmation supplémentaire
    doSubmit();
  };

  const selectedCat = categories.find(c => c._id === form.category);
  const wordCount   = form.description.trim().split(/\s+/).filter(Boolean).length;
  const isService   = form.type === 'service';
  const accent = isService ? P.blue : P.terra;
  const accentSoft = isService ? '#DBEAFE' : P.peachSoft;
  const accentDark = isService ? '#1D4ED8' : P.orange700;
  
  const d = {
    headerAccent: { backgroundColor: P.blue },
    progSegActive: { backgroundColor: '#60A5FA' },
    progSegDone: { backgroundColor: P.blue },
    catCardActive: { borderColor: P.blue, backgroundColor: '#DBEAFE' },
    catIconWrapActive: { backgroundColor: '#DBEAFE' },
    catEmojiActive: { transform: [{ scale: 1.02 }] },
    catNameActive: { color: P.blue },
    dotActive: { backgroundColor: P.blue },
    subChipActive: { borderColor: P.blue, backgroundColor: '#DBEAFE' },
    subChipTxtActive: { color: P.blue },
    pricePreview: { color: P.blue },
    imgPrimaryBadge: { backgroundColor: P.blue },
    tagAddBtn: { backgroundColor: P.blue },
    sellerBoxAccent: { backgroundColor: P.blue },
    headerBg: { borderBottomColor: 'rgba(59,130,246,0.2)' },
    btnBack: { borderColor: 'rgba(59,130,246,0.35)', backgroundColor: '#EFF6FF' },
    btnBackTxt: { color: P.blue },
    loaderIconWrap: { backgroundColor: P.blue },
    stepLabelActive: { color: P.blue, fontWeight: '700' },
    emptyIconBg: { backgroundColor: '#DBEAFE' },
  };

  // ── Rendu principal ─────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: theme.screen }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={theme.header}
        style={[s.header, { paddingTop: (insets.top || 0) + 6 }]}
      >
        <View style={[s.headerAccent, { backgroundColor: accent }, isService && d.headerAccent]} />
        <View style={s.headerRow}>
          <View>
            <Text style={[s.headerEye, { color: theme.textMuted }]}>MarketHub Niger</Text>
            <Text style={[s.headerTitle, { color: theme.text }]}>Publier une annonce</Text>
          </View>
          <View style={[s.stepBadge, { backgroundColor: theme.glass, borderColor: theme.border }]}>
            <Text style={[s.stepBadgeTxt, { color: theme.text }]}>{step}/3</Text>
          </View>
        </View>

        {/* Barre de progression */}
        <View style={s.progWrap}>
          {[1,2,3].map(n => (
            <View
              key={n}
              style={[
                s.progSeg,
                { backgroundColor: theme.divider },
                n <= step && [s.progSegActive, { backgroundColor: accentSoft }],
                n < step && [s.progSegDone, { backgroundColor: accent }],
                n <= step && isService && d.progSegActive,
                n < step && isService && d.progSegDone,
              ]}
            />
          ))}
        </View>

        {/* Labels étapes */}
        <View style={s.stepLabels}>
          {['Infos de base','Détails','Résumé'].map((l,i) => (
            <Text
              key={i}
              style={[
                s.stepLabel,
                { color: theme.textSoft },
                i+1 === step && [s.stepLabelActive, { color: accent }],
                i+1 === step && isService && d.stepLabelActive,
              ]}
            >
              {i+1 === step ? '● ' : ''}{l}
            </Text>
          ))}
        </View>

        <LinearGradient
          colors={['transparent', accent, 'transparent']}
          start={{x:0,y:0}} end={{x:1,y:0}}
          style={s.headerGlow}
        />
      </LinearGradient>

      {/* ── SCROLL ─────────────────────────────────────────────────────── */}
      <ScrollView
        style={{flex:1}}
        contentContainerStyle={[s.scroll, { paddingBottom: keyboardVisible ? 20 : 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >

        {/* ══════════ ÉTAPE 1 ══════════════════════════════════════════ */}
        {step === 1 && (
          <View>
            {/* <Text style={[s.sectionTitle, { color: theme.text }]}>Informations de base</Text> */}

            {/* Type */}
            <Field label="Type d'annonce *">
              <View style={f.row}>
                  <ChoiceBtn
                    label="Produit"
                    emoji="📦"
                    active={form.type === 'product'}
                    onPress={() => set('type', 'product')}
                    accent={form.type === 'service' ? P.blue : P.terra}
                    activeBg={form.type === 'service' ? '#DBEAFE' : P.peachSoft}
                  />
                  <ChoiceBtn
                    label="Service"
                    emoji="🛠️"
                    active={form.type === 'service'}
                    onPress={() => set('type', 'service')}
                    accent={form.type === 'service' ? P.blue : P.terra}
                    activeBg={form.type === 'service' ? '#DBEAFE' : P.peachSoft}
                  />
              </View>
            </Field>

            {/* Titre */}
            <Field label="Titre *" error={errors.title} inline labelWidth={72}>
              <StepInput
                placeholder="Ex: iPhone 13 Pro Max 256GB"
                value={form.title}
                onChangeText={t => set('title', t)}
                error={errors.title}
              />
            </Field>

            {/* Catégories */}
            <Field label="Catégorie *" error={errors.category}>
              {loadingCats ? (
                <ActivityIndicator color={isService ? P.blue : P.terra} style={{marginVertical:12}} />
              ) : (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.catCarousel}
                  >
                    {categories.map(cat => (
                      <TouchableOpacity
                        key={cat._id}
                        style={[
                          s.catCard,
                          { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow },
                          form.category===cat._id && [s.catCardActive, { borderColor: accent, backgroundColor: accentSoft }],
                          form.category===cat._id && isService && d.catCardActive,
                        ]}
                        onPress={() => set('category', cat._id)}
                        activeOpacity={0.8}
                      >
                        <View style={[s.catIconWrap, { backgroundColor: theme.surfaceAlt }, form.category===cat._id && isService && d.catIconWrapActive, form.category===cat._id && !isService && s.catIconWrapActive]}>
                          <Text style={[s.catEmoji, form.category===cat._id && isService && d.catEmojiActive]}>{getEmoji(cat.icon)}</Text>
                        </View>
                        <Text style={[s.catName, { color: theme.text }, form.category===cat._id && [s.catNameActive, { color: accent }], form.category===cat._id && isService && d.catNameActive]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
            </Field>

            {/* Sous-catégories */}
            {selectedCat?.subcategories?.length > 0 && (
              <Field label={`Type de ${selectedCat.name.toLowerCase()}`}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
                  {selectedCat.subcategories.map(sub => (
                    <TouchableOpacity
                      key={sub._id}
                      style={[s.subChip, { backgroundColor: theme.surface, borderColor: theme.border }, form.subcategory===sub.slug && [s.subChipActive, { borderColor: accent, backgroundColor: accentSoft }], form.subcategory===sub.slug && isService && d.subChipActive]}
                      onPress={() => set('subcategory', sub.slug)}
                      activeOpacity={0.8}
                    >
                      <Text style={{fontSize:16}}>{getEmoji(sub.icon)}</Text>
                      <Text style={[s.subChipTxt, { color: theme.textMuted }, form.subcategory===sub.slug && [s.subChipTxtActive, { color: accent }], form.subcategory===sub.slug && isService && d.subChipTxtActive]}>
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Field>
            )}
          </View>
        )}

        {/* ══════════ ÉTAPE 2 ══════════════════════════════════════════ */}
        {step === 2 && (
          <View>
            {/* <Text style={[s.sectionTitle, { color: theme.text }]}>Détails de l'annonce</Text> */}

            {/* Prix */}
            <Field label="Prix *" error={errors.price} inline labelWidth={72}>
              <View style={s.priceWrap}>
                <StepInput
                  placeholder="850000"
                  value={form.price}
                  onChangeText={t => set('price', t.replace(/\D/g,''))}
                  keyboardType="numeric"
                  error={errors.price}
                />
                {form.price ? (
                  <Text style={[s.pricePreview, { color: accent }]}>{parseInt(form.price).toLocaleString('fr-FR')} FCFA</Text>
                ) : null}
              </View>
            </Field>

            {/* Description */}
            <Field label={`Description (${wordCount}/150 mots)`} error={errors.description}>
              <StepInput
                placeholder="Décrivez votre produit ou service..."
                value={form.description}
                onChangeText={t => {
                  const wc = t.trim().split(/\s+/).filter(Boolean).length;
                  if (wc <= 150) set('description', t);
                }}
                multiline
                error={errors.description}
              />
            </Field>

            {/* Condition (produit) */}
            {form.type === 'product' && (
              <Field label="État du produit *">
                <View style={f.row}>
                  <ChoiceBtn label="Occasion"  active={form.condition==='used'} onPress={() => set('condition','used')} />
                  <ChoiceBtn label="Neuf"      active={form.condition==='new'}  onPress={() => set('condition','new')} />
                </View>
              </Field>
            )}

            {/* Images */}
            <Field label={`Photos (${form.images.length}/5) *`} error={errors.images}>
              <View style={s.imgGrid}>
                {form.images.map((uri, i) => (
                  <View key={i} style={s.imgThumb}>
                    <Image source={{uri}} style={s.imgThumbImg} />
                    <TouchableOpacity
                      style={s.imgRemove}
                      onPress={() => handleRemoveImage(i)}
                    >
                      <Text style={s.imgRemoveTxt}>✕</Text>
                    </TouchableOpacity>
                    {i===0 && <View style={[s.imgPrimaryBadge, isService && d.imgPrimaryBadge]}><Text style={s.imgPrimaryTxt}>Principale</Text></View>}
                  </View>
                ))}
                {form.images.length < 5 && (
                  <TouchableOpacity style={s.imgAdd} onPress={pickImages} activeOpacity={0.8}>
                    <Text style={s.imgAddIcon}>+</Text>
                    <Text style={s.imgAddTxt}>Ajouter</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Field>

            {/* Livraison (produit) */}
            {form.type === 'product' && (
              <>
                <View style={[s.switchCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={{flex:1}}>
                    <Text style={[s.switchLabel, { color: theme.text }]}>🚚 Livraison disponible</Text>
                    <Text style={[s.switchSub, { color: theme.textMuted }]}>Proposez-vous la livraison ?</Text>
                  </View>
                  <Switch
                    value={form.delivery}
                    onValueChange={v => set('delivery', v)}
                    trackColor={{false:theme.divider, true:accentSoft}}
                    thumbColor={form.delivery ? accent : theme.surface}
                  />
                </View>

                {form.delivery && (
                  <>
                    <Field label="Coût de livraison (FCFA)">
                      <StepInput
                        placeholder="Ex: 5000"
                        value={form.deliveryCost}
                        onChangeText={t => set('deliveryCost', t.replace(/\D/g,''))}
                        keyboardType="numeric"
                      />
                    </Field>
                    <Field label="Zones de livraison">
                      <View style={s.tagInput}>
                        <TextInput
                          style={[f.input, {flex:1, marginBottom:0, backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.inputText}]}
                          placeholder="Ex: Niamey, Maradi…"
                          placeholderTextColor={theme.inputPlaceholder}
                          value={delArea}
                          onChangeText={setDelArea}
                        />
                        <TouchableOpacity
                          style={[s.tagAddBtn, isService && d.tagAddBtn]}
                          onPress={() => {
                            if (delArea.trim() && !form.deliveryAreas.includes(delArea.trim())) {
                              set('deliveryAreas', [...form.deliveryAreas, delArea.trim()]);
                              setDelArea('');
                            }
                          }}
                        >
                          <Text style={s.tagAddBtnTxt}>+</Text>
                        </TouchableOpacity>
                      </View>
                      {form.deliveryAreas.length > 0 && (
                        <View style={s.tags}>
                          {form.deliveryAreas.map((a,i) => (
                            <TouchableOpacity
                              key={i} style={[s.tag, { backgroundColor: accent }]}
                              onPress={() => set('deliveryAreas', form.deliveryAreas.filter((_,j) => j!==i))}
                            >
                              <Text style={s.tagTxt}>{a} ✕</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </Field>
                  </>
                )}

                {/* Spécifications */}
                <Field label="📑 Spécifications (optionnel)">
                  <View style={s.specInputRow}>
                    <TextInput
                      style={[f.input, {flex:1, marginBottom:0, backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.inputText}]}
                      placeholder="Caractéristique"
                      placeholderTextColor={theme.inputPlaceholder}
                      value={specKey}
                      onChangeText={setSpecKey}
                    />
                    <TextInput
                      style={[f.input, {flex:1, marginBottom:0, backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.inputText}]}
                      placeholder="Valeur"
                      placeholderTextColor={theme.inputPlaceholder}
                      value={specVal}
                      onChangeText={setSpecVal}
                    />
                    <TouchableOpacity
                      style={[s.tagAddBtn, isService && d.tagAddBtn]}
                      onPress={() => {
                        if (specKey.trim() && specVal.trim()) {
                          set('specifications', {...form.specifications, [specKey.trim()]: specVal.trim()});
                          setSpecKey(''); setSpecVal('');
                        }
                      }}
                    >
                      <Text style={s.tagAddBtnTxt}>+</Text>
                    </TouchableOpacity>
                  </View>
                  {Object.keys(form.specifications).length > 0 && (
                    <View style={[s.specsList, { backgroundColor: theme.surfaceAlt }]}> 
                      {Object.entries(form.specifications).map(([k,v]) => (
                        <TouchableOpacity
                          key={k} style={[s.specItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
                          onPress={() => { const ns={...form.specifications}; delete ns[k]; set('specifications',ns); }}
                        >
                          <Text style={[s.specK, { color: theme.text }]}>{k}:</Text>
                          <Text style={[s.specV, { color: theme.text }]}> {v}</Text>
                          <Text style={s.specDel}> ✕</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </Field>
              </>
            )}

            {/* Horaires (service) */}
            {form.type === 'service' && (
              <Field label="🕒 Horaires de disponibilité">
                <View style={s.timeRow}>
                  <View style={{flex:1, marginRight:8}}>
                    <Text style={[s.timeLabel, { color: theme.textMuted }]}>Ouverture</Text>
                    <StepInput
                      placeholder="8h00"
                      value={form.availability.openingTime}
                      onChangeText={t => set('availability',{...form.availability, openingTime:t})}
                    />
                  </View>
                  <View style={{flex:1}}>
                    <Text style={[s.timeLabel, { color: theme.textMuted }]}>Fermeture</Text>
                    <StepInput
                      placeholder="18h00"
                      value={form.availability.closingTime}
                      onChangeText={t => set('availability',{...form.availability, closingTime:t})}
                    />
                  </View>
                </View>
              </Field>
            )}
          </View>
        )}

        {/* ══════════ ÉTAPE 3 — RÉSUMÉ ════════════════════════════════ */}
        {step === 3 && (
          <View>
            <Text style={[s.sectionTitle, { color: theme.text }]}>Résumé de votre annonce</Text>

            {/* Preview image principale */}
            {form.images.length > 0 && (
              <View style={s.previewImgWrap}>
                <Image source={{uri:form.images[0]}} style={s.previewImg} resizeMode="cover" />
                <LinearGradient colors={['transparent','rgba(17,24,39,0.6)']} style={StyleSheet.absoluteFill} />
                <View style={s.previewBadge}>
                  <Text style={s.previewBadgeTxt}>
                    {form.type==='product' ? '📦 Produit' : '🛠 Service'}
                  </Text>
                </View>
                <View style={s.previewPrice}>
                  <Text style={[s.previewPriceTxt, isService && d.pricePreview]}>{parseInt(form.price).toLocaleString('fr-FR')} FCFA</Text>
                </View>
              </View>
            )}

            {/* Infos résumé */}
            {[
              { label:'Titre', value: form.title },
              { label:'Catégorie', value: selectedCat?.name + (form.subcategory ? ` · ${form.subcategory}` : '') },
              { label:'Prix', value: `${parseInt(form.price).toLocaleString('fr-FR')} FCFA`, accent: true },
              form.type==='product' && { label:'État', value: form.condition==='new' ? '✨ Neuf' : '🔄 Occasion' },
              form.description && { label:'Description', value: form.description },
              form.type==='product' && form.delivery && { label:'🚚 Livraison', value: form.deliveryCost ? `${parseInt(form.deliveryCost).toLocaleString('fr-FR')} FCFA` : 'Incluse' },
              form.type==='service' && form.availability.openingTime && { label:'🕒 Horaires', value: `${form.availability.openingTime} — ${form.availability.closingTime}` },
            ].filter(Boolean).map((row, i) => (
              <View key={i} style={[s.summaryRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[s.summaryLabel, { color: theme.textMuted }]}>{row.label}</Text>
                <Text style={[s.summaryVal, { color: theme.text }, row.accent && {color:accent, fontWeight:'900', fontSize:17}]}>
                  {row.value}
                </Text>
              </View>
            ))}

            {/* Photos miniatures */}
            {form.images.length > 1 && (
              <View style={[s.summaryRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[s.summaryLabel, { color: theme.textMuted }]}>Photos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:6}}>
                  {form.images.map((uri,i) => (
                    <Image key={i} source={{uri}} style={s.summaryThumb} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Vendeur info */}
            <View style={[s.sellerBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}> 
              <View style={[s.sellerBoxAccent, isService && d.sellerBoxAccent]} />
              <Text style={[s.sellerBoxTitle, { color: theme.text }]}>Vos coordonnées</Text>
              {isAuthenticated && user ? (
                <>
                  <Text style={[s.sellerBoxItem, { color: theme.textMuted }]}>📍 {user.location || 'Niger'}</Text>
                  <Text style={[s.sellerBoxItem, { color: theme.textMuted }]}>👤 {user.name}</Text>
                  <Text style={[s.sellerBoxItem, { color: theme.textMuted }]}>📞 {user.phone}</Text>
                </>
              ) : (
                <Text style={[s.sellerBoxItem, { color: theme.textMuted }]}>🔒 Vos informations apparaîtront après la connexion</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <View
        style={[
          s.footer,
          { backgroundColor: theme.surface, borderTopColor: theme.border },
          {
            marginBottom: keyboardVisible ? 0 : footerOffset,
            paddingBottom: Math.max(insets.bottom, 12) + 4,
          },
        ]}
      >
        {step > 1 && (
          <TouchableOpacity style={[s.btnBack, { borderColor: accent, backgroundColor: theme.surfaceAlt }, isService && d.btnBack]} onPress={prev} activeOpacity={0.8}>
            <Text style={[s.btnBackTxt, { color: accent }, isService && d.btnBackTxt]}>← Retour</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.btnNext, step===1 && {flex:1}]}
          onPress={step < 3 ? next : submit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[accent, accentDark]}
            start={{x:0,y:0}} end={{x:1,y:0}}
            style={s.btnNextGrad}
          >
            <Text style={s.btnNextTxt}>
              {step < 3 ? 'Suivant →' : isEditing ? '✓ Mettre à jour' : '✓ Publier l\'annonce'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <AlertModal
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onDismiss={() => setAlert({ ...alert, visible: false })}
      />

      {/* ── LOADER FULL SCREEN BLAZING FAST RENDERING ── */}
      <Modal visible={submitting} transparent={true} animationType="fade" statusBarTranslucent>
        <View style={[s.loaderOverlay, { backgroundColor: theme.overlay }]}> 
          <View style={[s.loaderBox, { backgroundColor: theme.surface }]}> 
            <View style={[s.loaderIconWrap, isService && d.loaderIconWrap]}>
              <ActivityIndicator size="large" color={P.white} />
            </View>
            <Text style={[s.loaderTitle, { color: theme.text }]}>{isEditing ? 'Mise a jour en cours...' : 'Creation en cours...'}</Text>
            <Text style={[s.loaderSub, { color: theme.textMuted }]}>
              {isEditing
                ? 'Veuillez patienter pendant la mise a jour de votre annonce'
                : 'Veuillez patienter pendant la publication de votre annonce'}
            </Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── STYLES CHAMPS ────────────────────────────────────────────────────────────
const f = StyleSheet.create({
  field:         { marginBottom: 16 },
  inlineRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inlineControl: { flex: 1 },
  label:         { fontSize: 13, fontWeight: '700', color: P.brown, marginBottom: 8 },
  labelInline:   { marginBottom: 0 },
  error:         { fontSize: 12, color: P.error, marginTop: 4 },
  input:         { backgroundColor: P.white, borderWidth: 1, borderColor: P.dim, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: P.charcoal, marginBottom: 0 },
  inputErr:      { borderColor: P.error },
  textarea:      { minHeight: 110, textAlignVertical: 'top' },
  row:           { flexDirection: 'row', gap: 10 },
  choice:        { flex: 1, backgroundColor: P.white, borderWidth: 1.5, borderColor: P.dim, borderRadius: 12, paddingVertical: 14, alignItems: 'center', gap: 6 },
  choiceActive:  { borderColor: P.terra, backgroundColor: P.peachSoft },
  choiceEmoji:   { fontSize: 26 },
  choiceTxt:     { fontSize: 14, fontWeight: '600', color: P.muted },
  choiceTxtActive:{ color: P.terra, fontWeight: '800' },
});

// ─── STYLES PAGE ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: P.surface },

  // Header
  header:       { paddingHorizontal: 20, paddingBottom: 16, overflow: 'hidden', position: 'relative' },
  headerAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: P.terra },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  headerEye:    { fontSize: 10, fontWeight: '700', color: P.amber, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 },
  headerTitle:  { fontSize: 22, fontWeight: '900', color: P.white, letterSpacing: -0.4 },
  stepBadge:    { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  stepBadgeTxt: { fontSize: 13, fontWeight: '800', color: P.white },
  progWrap:     { flexDirection: 'row', gap: 6, marginBottom: 10 },
  progSeg:      { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  progSegActive:{ backgroundColor: P.amber },
  progSegDone:  { backgroundColor: P.terra },
  stepLabels:   { flexDirection: 'row', justifyContent: 'space-between' },
  stepLabel:    { fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: '500' },
  stepLabelActive:{ color: P.amber, fontWeight: '700' },
  headerGlow:   { height: 1.5, marginTop: 10 },

  // Content
  scroll:       { padding: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: P.charcoal, marginBottom: 20, letterSpacing: -0.3 },

  // Catégories
  catCarousel:   { paddingRight: 18, gap: CATEGORY_CARD_GAP },
  catCard:       { width: CATEGORY_CARD_WIDTH, minHeight: 82, backgroundColor: P.white, borderWidth: 1.5, borderColor: P.dim, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', shadowColor: P.charcoal, shadowOpacity: 0.06, shadowOffset: {width:0,height:3}, shadowRadius: 8, elevation: 2, marginRight: 8 },
  catCardActive: { borderColor: P.terra, backgroundColor: P.peachSoft, borderWidth: 2 },
  catIconWrap:   { width: 30, height: 30, borderRadius: 15, backgroundColor: P.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  catIconWrapActive: { backgroundColor: P.peachSoft },
  catEmoji:      { fontSize: 18 },
  catName:       { fontSize: 9, fontWeight: '800', color: P.charcoal, textAlign: 'center', lineHeight: 11 },
  catNameActive: { color: P.terra },
  catDesc:       { fontSize: 10, color: P.muted, textAlign: 'center', lineHeight: 13 },
  dots:          { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 8, marginBottom: 2 },
  dot:           { width: 5, height: 5, borderRadius: 2.5, backgroundColor: P.dim },
  dotActive:     { width: 14, backgroundColor: P.terra },

  // Sous-catégories
  subChip:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.white, borderWidth: 1.5, borderColor: P.dim, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 14 },
  subChipActive:  { borderColor: P.terra, backgroundColor: P.peachSoft },
  subChipTxt:     { fontSize: 13, fontWeight: '600', color: P.muted },
  subChipTxtActive:{ color: P.terra },

  // Prix
  priceWrap:    { gap: 6 },
  pricePreview: { fontSize: 13, color: P.terra, fontWeight: '700' },

  // Images
  imgGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imgThumb:     { position: 'relative' },
  imgThumbImg:  { width: 96, height: 96, borderRadius: 12, backgroundColor: P.sand },
  imgRemove:    { position: 'absolute', top: 4, right: 4, backgroundColor: P.error, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  imgRemoveTxt: { color: P.white, fontSize: 11, fontWeight: '900' },
  imgPrimaryBadge:{ position: 'absolute', bottom: 4, left: 4, backgroundColor: P.terra, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  imgPrimaryTxt:  { color: P.white, fontSize: 9, fontWeight: '800' },
  imgAdd:       { width: 96, height: 96, borderWidth: 2, borderColor: P.dim, borderStyle: 'dashed', borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: P.white },
  imgAddIcon:   { fontSize: 28, color: P.muted },
  imgAddTxt:    { fontSize: 11, color: P.muted, marginTop: 2 },

  // Switch livraison
  switchCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: P.white, borderRadius: 12, borderWidth: 1, borderColor: P.dim, padding: 14, marginBottom: 12 },
  switchLabel:  { fontSize: 14, fontWeight: '700', color: P.charcoal },
  switchSub:    { fontSize: 12, color: P.muted, marginTop: 2 },

  // Tags
  tagInput:    { flexDirection: 'row', gap: 8, alignItems: 'center' },
  tagAddBtn:   { backgroundColor: P.terra, width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tagAddBtnTxt:{ color: P.white, fontSize: 22, fontWeight: '700' },
  tags:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tag:         { backgroundColor: P.amber, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  tagTxt:      { color: P.white, fontSize: 12, fontWeight: '600' },

  // Specs
  specInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  specsList:    { backgroundColor: P.surface, borderRadius: 10, padding: 10, gap: 6 },
  specItem:     { flexDirection: 'row', alignItems: 'center', backgroundColor: P.white, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: P.dim },
  specK:        { fontSize: 13, fontWeight: '700', color: P.brown },
  specV:        { fontSize: 13, color: P.charcoal, flex: 1 },
  specDel:      { fontSize: 14, color: P.error, fontWeight: '700' },

  // Horaires
  timeRow:   { flexDirection: 'row' },
  timeLabel: { fontSize: 12, color: P.muted, marginBottom: 6 },

  // Résumé
  previewImgWrap:  { height: 180, borderRadius: 16, overflow: 'hidden', marginBottom: 16, position: 'relative', backgroundColor: P.sand },
  previewImg:      { width: '100%', height: '100%' },
  previewBadge:    { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(17,24,39,0.7)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  previewBadgeTxt: { fontSize: 11, fontWeight: '800', color: P.white },
  previewPrice:    { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(17,24,39,0.8)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  previewPriceTxt: { fontSize: 14, fontWeight: '900', color: P.amber },
  summaryRow:      { backgroundColor: P.white, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: P.dim },
  summaryLabel:    { fontSize: 11, color: P.muted, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryVal:      { fontSize: 15, color: P.charcoal, fontWeight: '600', lineHeight: 22 },
  summaryThumb:    { width: 64, height: 64, borderRadius: 10, marginRight: 8, backgroundColor: P.sand },
  sellerBox:       { backgroundColor: P.peachSoft, borderRadius: 14, padding: 16, marginTop: 4, position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(236,90,19,0.18)' },
  sellerBoxAccent: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, backgroundColor: P.terra, borderRadius: 2 },
  sellerBoxTitle:  { fontSize: 13, fontWeight: '800', color: P.charcoal, marginBottom: 10, marginLeft: 10 },
  sellerBoxItem:   { fontSize: 13, color: P.brown, marginBottom: 5, marginLeft: 10 },

  // Footer
  footer:      { backgroundColor: P.white, borderTopWidth: 1, borderTopColor: P.dim, paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', gap: 10 },
  btnBack:     { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(236,90,19,0.4)', backgroundColor: P.peachSoft },
  btnBackTxt:  { fontSize: 15, fontWeight: '700', color: P.terra },
  btnNext:     { flex: 1, borderRadius: 12, overflow: 'hidden', shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: {width:0,height:4}, shadowRadius: 10, elevation: 6 },
  btnNextGrad: { paddingVertical: 15, alignItems: 'center' },
  btnNextTxt:  { fontSize: 15, fontWeight: '800', color: P.white, letterSpacing: 0.2 },

  // Loader Overlay
  loaderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderBox: {
    width: '80%',
    backgroundColor: P.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  loaderIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: P.terra,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: P.charcoal,
    marginBottom: 8,
  },
  loaderSub: {
    fontSize: 14,
    color: P.muted,
    textAlign: 'center',
  },

  // Empty
  emptyWrap:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIconBg:{ width: 80, height: 80, borderRadius: 40, backgroundColor: P.peachSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: P.charcoal, marginBottom: 8 },
  emptyDesc:  { fontSize: 14, color: P.muted, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  emptyBtn:   { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: {width:0,height:4}, shadowRadius: 10, elevation: 6 },
  emptyBtnTxt:{ fontSize: 15, fontWeight: '800', color: P.white },
});