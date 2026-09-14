import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  where,
} from '@react-native-firebase/firestore';
import { router } from 'expo-router';

type Ride = {
  id: string;
  pickupArea?: string;
  destination?: string;
  fareEstimate?: number;
  status?: string;
  completedAt?: any;
};

export default function History() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getAuth().currentUser;

    if (!user) {
      router.replace('/login');
      return;
    }

    const ridesQuery = query(
      collection(getFirestore(), 'rideRequests'),
      where('driverId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      ridesQuery,
      (snapshot) => {
        const list: Ride[] = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...(item.data() as Omit<Ride, 'id'>),
          }))
          .filter((ride) => ride.status === 'completed')
          .sort((a, b) => {
            const aTime = a.completedAt?.toDate?.()?.getTime?.() || 0;
            const bTime = b.completedAt?.toDate?.()?.getTime?.() || 0;
            return bTime - aTime;
          });

        setRides(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const renderRide = ({ item }: { item: Ride }) => (
    <View style={styles.card}>
      <Text style={styles.title}>رحلة مكتملة</Text>

      <Text style={styles.row}>
        📍 الانطلاق: {item.pickupArea || 'غير محدد'}
      </Text>

      <Text style={styles.row}>
        🎯 الوجهة: {item.destination || 'غير محددة'}
      </Text>

      <Text style={styles.fare}>
        💰 الأجرة: {item.fareEstimate ?? 0} دينار
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>سجل الرحلات</Text>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : rides.length === 0 ? (
        <Text style={styles.empty}>لا توجد رحلات مكتملة حتى الآن</Text>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          renderItem={renderRide}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  list: {
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  row: {
    fontSize: 16,
    marginBottom: 7,
  },
  fare: {
    fontSize: 17,
    fontWeight: 'bold',
    marginTop: 5,
  },
  empty: {
    textAlign: 'center',
    fontSize: 17,
    marginTop: 50,
  },
});
