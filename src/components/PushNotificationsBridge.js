import React, { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { CommonActions } from '@react-navigation/native';
import { Alert, AppState, Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { navigationRef } from '../navigation/AppNavigator';
import { registerPushToken } from '../api/auth';

const FALLBACK_EAS_PROJECT_ID = 'c85af018-b333-49ac-9f39-8a3623969b2d';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function PushNotificationsBridge() {
  const { isAuthenticated, user } = useAuth();
  const notificationListenerRef = useRef(null);
  const appStateListenerRef = useRef(null);
  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    let cancelled = false;

    const registerToken = async () => {
      if (!isAuthenticated || !user?.id) return;

      try {
        if (isExpoGo) {
          console.log('ℹ️ Expo Go détecté: enregistrement token désactivé pour ne pas polluer la prod. Utilisez un build APK/development build.');
          return;
        }

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        }

        console.log('📣 Push setup start:', {
          userId: user.id,
          appOwnership: Constants.appOwnership,
          isExpoGo,
        });

        const permissions = await Notifications.getPermissionsAsync();
        let status = permissions.status;

        console.log('📣 Push permission status (current):', status);

        if (status !== 'granted') {
          const requested = await Notifications.requestPermissionsAsync();
          status = requested.status;
          console.log('📣 Push permission status (requested):', status);
        }

        if (status !== 'granted' || cancelled) {
          console.log('⚠️ Push token non enregistré: permission refusée ou opération annulée.');
          return;
        }

        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ||
          Constants?.easConfig?.projectId ||
          FALLBACK_EAS_PROJECT_ID;

        console.log('📣 Push project config:', { projectId, appOwnership: Constants.appOwnership });

        const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
        const expoPushToken = tokenResponse?.data;

        if (!expoPushToken || cancelled) {
          console.log('⚠️ Aucun Expo push token généré.');
          return;
        }

        console.log('📣 Expo push token généré:', expoPushToken.substring(0, 24) + '...');

        let lastError = null;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            await registerPushToken(expoPushToken, user.id);
            console.log('✅ Push token enregistré:', {
              attempt,
              tokenPreview: expoPushToken.substring(0, 20) + '...',
            });
            lastError = null;
            break;
          } catch (err) {
            lastError = err;
            const status = err?.response?.status;
            const message = err?.response?.data?.message || err?.message;
            console.log('⚠️ Echec enregistrement push token, nouvelle tentative...', {
              attempt,
              status,
              message,
            });
            if (attempt < 3) {
              await new Promise((resolve) => setTimeout(resolve, 1200));
            }
          }
        }

        if (lastError) {
          throw lastError;
        }
      } catch (error) {
        const backendMessage = error?.response?.data?.message;
        const backendStatus = error?.response?.status;
        console.error('❌ Erreur configuration notifications push:', {
          status: backendStatus,
          message: backendMessage || error?.message || String(error),
        });
      }
    };

    registerToken();

    appStateListenerRef.current = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        registerToken();
      }
    });

    return () => {
      cancelled = true;
      if (appStateListenerRef.current) {
        appStateListenerRef.current.remove();
      }
    };
  }, [isAuthenticated, isExpoGo, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Écouter les notifications reçues en premier plan
    notificationListenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data || {};
        const { conversationId, productId, isReviewEligible, type } = data;

        if (navigationRef.current) {
          // Si c'est une invitation à laisser un avis
          if (isReviewEligible === 'true' || isReviewEligible === true || type === 'review_invitation') {
            if (productId) {
              console.log('📱 Notification avis, navigation vers produit:', productId);
              navigationRef.current.navigate('ProductDetail', {
                productId,
                scrollToReviewForm: true,
              });
              return;
            }
          }

          // Sinon, navigation vers la conversation
          if (conversationId) {
            console.log('📱 Notification tapée, navigation vers conversation:', conversationId);
            navigationRef.current.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [
                  {
                    name: 'MainTabs',
                    state: {
                      index: 3,
                      routes: [
                        { name: 'Home' },
                        { name: 'Favorites' },
                        { name: 'Publish' },
                        {
                          name: 'Messages',
                          state: {
                            index: 1,
                            routes: [
                              { name: 'MessagesList' },
                              { name: 'Conversation', params: { conversationId } },
                            ],
                          },
                        },
                      ],
                    },
                  },
                ],
              })
            );
          }
        }
      }
    );

    return () => {
      if (notificationListenerRef.current) {
        notificationListenerRef.current.remove();
      }
    };
  }, [isAuthenticated]);

  return null;
}
