import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePortal } from '../context/PortalContext';
import { LoginScreen } from '../screens/LoginScreen';
import { AppointmentsScreen } from '../screens/AppointmentsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ScheduleScreen } from '../screens/ScheduleScreen';

const RootStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function MainTabs() {
  const { unreadCount } = usePortal();

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'ellipse-outline';

          if (route.name === 'Citas') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Notificaciones') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Agendar') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Citas" component={AppointmentsScreen} options={{ title: 'Mis Citas' }} />
      <Tabs.Screen
        name="Notificaciones"
        component={NotificationsScreen}
        options={{
          title: 'Notificaciones',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tabs.Screen name="Agendar" component={ScheduleScreen} options={{ title: 'Agendar Cita' }} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated, bootstrapping } = usePortal();

  if (bootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <RootStack.Screen name="Login" component={LoginScreen} />
        ) : (
          <RootStack.Screen name="MainTabs" component={MainTabs} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
