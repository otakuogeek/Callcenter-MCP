import React, { useCallback } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { usePortal } from '../context/PortalContext';

export function NotificationsScreen() {
  const { notifications, unreadCount, loading, markNotificationsRead, refreshData } = usePortal();

  useFocusEffect(
    useCallback(() => {
      refreshData().catch(() => {});
    }, [refreshData]),
  );

  const handleMarkRead = async () => {
    try {
      await markNotificationsRead();
      Alert.alert('Listo', 'Notificaciones marcadas como leídas.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron marcar como leídas.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Notificaciones SMS ({unreadCount})</Text>
        <TouchableOpacity style={styles.button} onPress={handleMarkRead}>
          <Text style={styles.buttonText}>Marcar leídas</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator style={{ marginVertical: 8 }} />}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {notifications.length === 0 && <Text style={styles.emptyText}>No hay notificaciones.</Text>}

        {notifications.map((notification) => (
          <View key={notification.id} style={styles.card}>
            <Text style={styles.text}>{notification.message}</Text>
            <Text style={styles.meta}>{notification.sent_at}</Text>
            <Text style={styles.state}>{notification.read_at ? 'Leída' : 'No leída'}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { flex: 1 },
  contentContainer: { padding: 14, paddingBottom: 24 },
  emptyText: { color: '#6b7280' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  text: { fontSize: 14, color: '#111827', marginBottom: 6 },
  meta: { fontSize: 12, color: '#6b7280' },
  state: { fontSize: 12, color: '#2563eb', marginTop: 2, fontWeight: '700' },
});
