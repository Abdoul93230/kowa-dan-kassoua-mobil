import React, { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { CommonActions } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { navigationRef } from '../navigation/AppNavigator';
import { registerPushToken } from '../api/auth';

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
  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    let cancelled = false;

    const registerToken = async () => {
      if (!isAuthenticated || !user?.id) return;

      if (isExpoGo) {
        console.log('ℹ️ Push distant désactivé dans Expo Go. Utilisez un development build pour tester les notifications push.');
        return;
      }

      try {
        const permissions = await Notifications.getPermissionsAsync();
        let status = permissions.status;

        if (status !== 'granted') {
          const requested = await Notifications.requestPermissionsAsync();
          status = requested.status;
        }

        if (status !== 'granted' || cancelled) return;

        const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId || undefined;
        const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
        const expoPushToken = tokenResponse?.data;

        if (!expoPushToken || cancelled) return;

        await registerPushToken(expoPushToken);
        console.log('✅ Push token enregistré:', expoPushToken.substring(0, 20) + '...');
      } catch (error) {
        console.error('❌ Erreur configuration notifications push:', error);
      }
    };

    registerToken();

    return () => {
      cancelled = true;
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
