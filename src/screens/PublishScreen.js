// ─── PublishScreen v2 PREMIUM ─ MarketHub Niger ───────────────────────────────
// Formulaire de publication — design cohérent, épuré, 3 étapes

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, ActivityIndicator, KeyboardAvoidingView,
  Platform, Dimensions, Switch, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { getCategories } from '../api/categories';
import { createProduct, imagesToBase64 } from '../api/products';
import AlertModal from '../components/AlertModal';
import { MOBILE_COLORS as P } from '../theme/colors';

const { width } = Dimensions.get('window');

const iconToEmoji = {
  Smartphone:'📱', UtensilsCrossed:'🍔', Home:'🏠', Car:'🚗', Shirt:'👕',
  Wrench:'🔧', Laptop:'💻', Dumbbell:'🏋️', Baby:'👶', PawPrint:'🐾',
  Book:'📚', Palette:'🎨', Briefcase:'💼', Gamepad2:'🎮', HardHat:'⛑️', Package:'📦',
};
const getEmoji = (icon) => iconToEmoji[icon] || '📦';

// ─── COMPOSANTS RÉUTILISABLES ─────────────────────────────────────────────────

function Field({ label, error, children }) {
  return (
    <View style={f.field}>
      <Text style={f.label}>{label}</Text>
      {children}
      {error ? <Text style={f.error}>{error}</Text> : null}
    </View>
  );
}

function StepInput({ placeholder, value, onChangeText, keyboardType, multiline, error }) {
  return (
    <TextInput
      style={[f.input, multiline && f.textarea, error && f.inputErr]}
      placeholder={placeholder}
      placeholderTextColor={P.muted}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType || 'default'}
      multiline={multiline}
      numberOfLines={multiline ? 5 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  );
}

function ChoiceBtn({ label, emoji, active, onPress }) {
  return (
    <TouchableOpacity
      style={[f.choice, active && f.choiceActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {emoji ? <Text style={f.choiceEmoji}>{emoji}</Text> : null}
      <Text style={[f.choiceTxt, active && f.choiceTxtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function PublishScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const footerOffset = Math.max(tabBarHeight - insets.bottom, 0);
  const { user, isAuthenticated } = useAuth();
  const editItem = route?.params?.editItem;

  const [step,       setStep]       = useState(1);
  const [categories, setCategories] = useState([]);
  const [loadingCats,setLoadingCats]= useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [catIdx,     setCatIdx]     = useState(0);
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
    if (!editItem) return;
    setForm({
      type: editItem.type || 'product',
      title: editItem.title || '',
      category: editItem.category?._id || editItem.category || '',
      subcategory: editItem.subcategory || '',
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

  const doSubmit = async () => {
    try {
      setSubmitting(true);
      const imagesB64 = await imagesToBase64(form.images);
      const data = {
        title: form.title, description: form.description,
        category: form.category, subcategory: form.subcategory || '',
        type: form.type, price: form.price,
        location: user.location || 'Niger', quantity: '1',
        images: imagesB64,
            delivery: { available: form.delivery, cost: form.deliveryCost, areas: form.deliveryAreas, estimatedTime: '' },
            availability: form.availability,
            specifications: form.specifications,
            promoted: false, featured: false,
          };
          if (form.type === 'product') data.condition = form.condition;
          await createProduct(data);
          setAlert({
            visible: true,
            type: 'success',
            title: 'Succès 🎉',
            message: 'Annonce publiée avec succès',
            buttons: [{
              text: 'OK',
              onPress: () => {
                setForm({type:'product',title:'',category:'',subcategory:'',price:'',description:'',condition:'used',images:[],delivery:false,deliveryCost:'',deliveryAreas:[],specifications:{},availability:{openingTime:'',closingTime:'',days:[]}});
                setStep(1);
                navigation.navigate('Home');
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

  const submit = async () => {
    if (!validate(2)) return;
    setAlert({
      visible: true,
      type: 'info',
      title: 'Confirmer',
      message: 'Publier cette annonce ?',
      buttons: [
        { text: 'Annuler', onPress: () => {} },
        { text: 'Publier', onPress: doSubmit },
      ],
    });
  };

  const selectedCat = categories.find(c => c._id === form.category);
  const wordCount   = form.description.trim().split(/\s+/).filter(Boolean).length;

  // ── Non connecté ────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LinearGradient colors={['#2d3748','#374151']} style={[s.header,{paddingTop:(insets.top||0)+6}]}>
          <View style={s.headerAccent} />
          <Text style={s.headerTitle}>Publier une annonce</Text>
        </LinearGradient>
        <View style={s.emptyWrap}>
          <View style={s.emptyIconBg}><Text style={{fontSize:36}}>📝</Text></View>
          <Text style={s.emptyTitle}>Connectez-vous</Text>
          <Text style={s.emptyDesc}>Publiez vos annonces gratuitement après connexion</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.85}>
            <LinearGradient colors={[P.orange500,P.orange700]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.emptyBtn}>
              <Text style={s.emptyBtnTxt}>Se connecter →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Rendu principal ─────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#2d3748','#374151']}
        style={[s.header, { paddingTop: (insets.top || 0) + 6 }]}
      >
        <View style={s.headerAccent} />
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerEye}>MarketHub Niger</Text>
            <Text style={s.headerTitle}>Publier une annonce</Text>
          </View>
          <View style={s.stepBadge}>
            <Text style={s.stepBadgeTxt}>{step}/3</Text>
          </View>
        </View>

        {/* Barre de progression */}
        <View style={s.progWrap}>
          {[1,2,3].map(n => (
            <View key={n} style={[s.progSeg, n <= step && s.progSegActive, n < step && s.progSegDone]} />
          ))}
        </View>

        {/* Labels étapes */}
        <View style={s.stepLabels}>
          {['Infos de base','Détails','Résumé'].map((l,i) => (
            <Text key={i} style={[s.stepLabel, i+1 === step && s.stepLabelActive]}>
              {i+1 === step ? '● ' : ''}{l}
            </Text>
          ))}
        </View>

        <LinearGradient
          colors={['transparent',P.terra,'transparent']}
          start={{x:0,y:0}} end={{x:1,y:0}}
          style={s.headerGlow}
        />
      </LinearGradient>

      {/* ── SCROLL ─────────────────────────────────────────────────────── */}
      <ScrollView
        style={{flex:1}}
        contentContainerStyle={[s.scroll,{paddingBottom: 20}]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ══════════ ÉTAPE 1 ══════════════════════════════════════════ */}
        {step === 1 && (
          <View>
            <Text style={s.sectionTitle}>Informations de base</Text>

            {/* Type */}
            <Field label="Type d'annonce *">
              <View style={f.row}>
                <ChoiceBtn label="Produit" emoji="📦" active={form.type==='product'} onPress={() => set('type','product')} />
                <ChoiceBtn label="Service" emoji="🛠️" active={form.type==='service'} onPress={() => set('type','service')} />
              </View>
            </Field>

            {/* Titre */}
            <Field label="Titre *" error={errors.title}>
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
                <ActivityIndicator color={P.terra} style={{marginVertical:12}} />
              ) : (
                <>
                  <ScrollView
                    horizontal pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={e => setCatIdx(Math.round(e.nativeEvent.contentOffset.x / (width-40)))}
                    scrollEventThrottle={16}
                    contentContainerStyle={{paddingRight:20}}
                  >
                    {categories.map(cat => (
                      <TouchableOpacity
                        key={cat._id}
                        style={[s.catCard, form.category===cat._id && s.catCardActive]}
                        onPress={() => set('category', cat._id)}
                        activeOpacity={0.8}
                      >
                        <View style={s.catIconWrap}>
                          <Text style={{fontSize:28}}>{getEmoji(cat.icon)}</Text>
                        </View>
                        <Text style={[s.catName, form.category===cat._id && s.catNameActive]}>
                          {cat.name}
                        </Text>
                        {cat.description ? (
                          <Text style={s.catDesc} numberOfLines={2}>{cat.description}</Text>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {/* Dots */}
                  <View style={s.dots}>
                    {categories.map((_,i) => (
                      <View key={i} style={[s.dot, i===catIdx && s.dotActive]} />
                    ))}
                  </View>
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
                      style={[s.subChip, form.subcategory===sub.slug && s.subChipActive]}
                      onPress={() => set('subcategory', sub.slug)}
                      activeOpacity={0.8}
                    >
                      <Text style={{fontSize:16}}>{getEmoji(sub.icon)}</Text>
                      <Text style={[s.subChipTxt, form.subcategory===sub.slug && s.subChipTxtActive]}>
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
            <Text style={s.sectionTitle}>Détails de l'annonce</Text>

            {/* Prix */}
            <Field label="Prix en FCFA *" error={errors.price}>
              <View style={s.priceWrap}>
                <StepInput
                  placeholder="Ex: 850000"
                  value={form.price}
                  onChangeText={t => set('price', t.replace(/\D/g,''))}
                  keyboardType="numeric"
                  error={errors.price}
                />
                {form.price ? (
                  <Text style={s.pricePreview}>{parseInt(form.price).toLocaleString('fr-FR')} FCFA</Text>
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
                  <ChoiceBtn label="Neuf"      active={form.condition==='new'}  onPress={() => set('condition','new')} />
                  <ChoiceBtn label="Occasion"  active={form.condition==='used'} onPress={() => set('condition','used')} />
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
                      onPress={() => set('images', form.images.filter((_,j) => j!==i))}
                    >
                      <Text style={s.imgRemoveTxt}>✕</Text>
                    </TouchableOpacity>
                    {i===0 && <View style={s.imgPrimaryBadge}><Text style={s.imgPrimaryTxt}>Principale</Text></View>}
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
                <View style={s.switchCard}>
                  <View style={{flex:1}}>
                    <Text style={s.switchLabel}>🚚 Livraison disponible</Text>
                    <Text style={s.switchSub}>Proposez-vous la livraison ?</Text>
                  </View>
                  <Switch
                    value={form.delivery}
                    onValueChange={v => set('delivery', v)}
                    trackColor={{false:P.dim, true:P.amber}}
                    thumbColor={form.delivery ? P.terra : P.white}
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
                          style={[f.input, {flex:1, marginBottom:0}]}
                          placeholder="Ex: Niamey, Maradi…"
                          placeholderTextColor={P.muted}
                          value={delArea}
                          onChangeText={setDelArea}
                        />
                        <TouchableOpacity
                          style={s.tagAddBtn}
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
                              key={i} style={s.tag}
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
                      style={[f.input, {flex:1, marginBottom:0}]}
                      placeholder="Caractéristique"
                      placeholderTextColor={P.muted}
                      value={specKey}
                      onChangeText={setSpecKey}
                    />
                    <TextInput
                      style={[f.input, {flex:1, marginBottom:0}]}
                      placeholder="Valeur"
                      placeholderTextColor={P.muted}
                      value={specVal}
                      onChangeText={setSpecVal}
                    />
                    <TouchableOpacity
                      style={s.tagAddBtn}
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
                    <View style={s.specsList}>
                      {Object.entries(form.specifications).map(([k,v]) => (
                        <TouchableOpacity
                          key={k} style={s.specItem}
                          onPress={() => { const ns={...form.specifications}; delete ns[k]; set('specifications',ns); }}
                        >
                          <Text style={s.specK}>{k}:</Text>
                          <Text style={s.specV}> {v}</Text>
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
                    <Text style={s.timeLabel}>Ouverture</Text>
                    <StepInput
                      placeholder="8h00"
                      value={form.availability.openingTime}
                      onChangeText={t => set('availability',{...form.availability, openingTime:t})}
                    />
                  </View>
                  <View style={{flex:1}}>
                    <Text style={s.timeLabel}>Fermeture</Text>
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
            <Text style={s.sectionTitle}>Résumé de votre annonce</Text>

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
                  <Text style={s.previewPriceTxt}>{parseInt(form.price).toLocaleString('fr-FR')} FCFA</Text>
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
              <View key={i} style={s.summaryRow}>
                <Text style={s.summaryLabel}>{row.label}</Text>
                <Text style={[s.summaryVal, row.accent && {color:P.terra, fontWeight:'900', fontSize:17}]}>
                  {row.value}
                </Text>
              </View>
            ))}

            {/* Photos miniatures */}
            {form.images.length > 1 && (
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Photos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:6}}>
                  {form.images.map((uri,i) => (
                    <Image key={i} source={{uri}} style={s.summaryThumb} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Vendeur info */}
            <View style={s.sellerBox}>
              <View style={s.sellerBoxAccent} />
              <Text style={s.sellerBoxTitle}>Vos coordonnées</Text>
              <Text style={s.sellerBoxItem}>📍 {user.location || 'Niger'}</Text>
              <Text style={s.sellerBoxItem}>👤 {user.name}</Text>
              <Text style={s.sellerBoxItem}>📞 {user.phone}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        {step > 1 && (
          <TouchableOpacity style={s.btnBack} onPress={prev} activeOpacity={0.8}>
            <Text style={s.btnBackTxt}>← Retour</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.btnNext, step===1 && {flex:1}]}
          onPress={step < 3 ? next : submit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[P.orange500, P.orange700]}
            start={{x:0,y:0}} end={{x:1,y:0}}
            style={s.btnNextGrad}
          >
            {submitting
              ? <ActivityIndicator size="small" color={P.white} />
              : <Text style={s.btnNextTxt}>
                  {step < 3 ? 'Suivant →' : '✓ Publier l\'annonce'}
                </Text>
            }
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
    </KeyboardAvoidingView>
  );
}

// ─── STYLES CHAMPS ────────────────────────────────────────────────────────────
const f = StyleSheet.create({
  field:         { marginBottom: 16 },
  label:         { fontSize: 13, fontWeight: '700', color: P.brown, marginBottom: 8 },
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
  catCard:       { width: width - 76, backgroundColor: P.white, borderWidth: 1.5, borderColor: P.dim, borderRadius: 16, padding: 18, marginRight: 14, alignItems: 'center', shadowColor: P.charcoal, shadowOpacity: 0.06, shadowOffset: {width:0,height:3}, shadowRadius: 8, elevation: 2 },
  catCardActive: { borderColor: P.terra, backgroundColor: P.peachSoft, borderWidth: 2 },
  catIconWrap:   { width: 56, height: 56, borderRadius: 28, backgroundColor: P.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  catName:       { fontSize: 15, fontWeight: '700', color: P.charcoal, textAlign: 'center', marginBottom: 4 },
  catNameActive: { color: P.terra },
  catDesc:       { fontSize: 12, color: P.muted, textAlign: 'center', lineHeight: 17 },
  dots:          { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10, marginBottom: 4 },
  dot:           { width: 6, height: 6, borderRadius: 3, backgroundColor: P.dim },
  dotActive:     { width: 20, backgroundColor: P.terra },

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

  // Empty
  emptyWrap:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIconBg:{ width: 80, height: 80, borderRadius: 40, backgroundColor: P.peachSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: P.charcoal, marginBottom: 8 },
  emptyDesc:  { fontSize: 14, color: P.muted, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  emptyBtn:   { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, shadowColor: P.terra, shadowOpacity: 0.3, shadowOffset: {width:0,height:4}, shadowRadius: 10, elevation: 6 },
  emptyBtnTxt:{ fontSize: 15, fontWeight: '800', color: P.white },
});