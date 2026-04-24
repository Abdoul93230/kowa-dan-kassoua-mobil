import React, { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { CommonActions } from '@react-navigation/native';
import { Alert, AppState, Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { navigationRef } from '../navigation/AppNavigator';
import { registerPushToken } from '../api/auth';

const FALLBACK_EAS_PROJECT_ID = 'c85af018-b333-49ac-9f39-8a3623969b2d';
const SHOW_PUSH_VISUAL_DEBUG = true;

const showPushStep = (title, message) => {
  if (!SHOW_PUSH_VISUAL_DEBUG) return;
  Alert.alert(title, String(message || ''));
};

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
          showPushStep('Push debug', 'Expo Go detecte: enregistrement token desactive. Utilise l APK preview/prod.');
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
        showPushStep('Push debug', `Demarrage push pour user ${user.id}`);

        const permissions = await Notifications.getPermissionsAsync();
        let status = permissions.status;

        console.log('📣 Push permission status (current):', status);
        showPushStep('Push permission', `Statut actuel: ${status}`);

        if (status !== 'granted') {
          const requested = await Notifications.requestPermissionsAsync();
          status = requested.status;
          console.log('📣 Push permission status (requested):', status);
          showPushStep('Push permission', `Statut apres demande: ${status}`);
        }

        if (status !== 'granted' || cancelled) {
          console.log('⚠️ Push token non enregistré: permission refusée ou opération annulée.');
          showPushStep('Push stop', 'Permission non accordee ou operation annulee');
          return;
        }

        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ||
          Constants?.easConfig?.projectId ||
          FALLBACK_EAS_PROJECT_ID;

        console.log('📣 Push project config:', { projectId, appOwnership: Constants.appOwnership });
        showPushStep('Push project', `projectId: ${projectId}`);

        const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
        const expoPushToken = tokenResponse?.data;

        if (!expoPushToken || cancelled) {
          console.log('⚠️ Aucun Expo push token généré.');
          showPushStep('Push token', 'Aucun token Expo genere');
          return;
        }

        console.log('📣 Expo push token généré:', expoPushToken.substring(0, 24) + '...');
        showPushStep('Push token genere', expoPushToken);

        let lastError = null;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            await registerPushToken(expoPushToken, user.id);
            console.log('✅ Push token enregistré:', {
              attempt,
              tokenPreview: expoPushToken.substring(0, 20) + '...',
            });
            showPushStep('Push backend', `Token enregistre en base (attempt ${attempt})`);
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
            showPushStep('Push retry', `Echec attempt ${attempt}: ${message || status || 'erreur inconnue'}`);
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
        showPushStep('Push erreur', `${backendStatus || ''} ${backendMessage || error?.message || String(error)}`);
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
        const { conversationId } = response.notification.request.content.data || {};
        if (conversationId && navigationRef.current) {
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
    );

    return () => {
      if (notificationListenerRef.current) {
        notificationListenerRef.current.remove();
      }
    };
  }, [isAuthenticated]);

  return null;
}
