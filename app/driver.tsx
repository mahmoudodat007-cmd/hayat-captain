import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { getAuth, signOut } from '@react-native-firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  runTransaction,
} from '@react-native-firebase/firestore';
import { router } from 'expo-router';

type Ride = {
  id: string;
  pickupArea: string;
  destination: string;
  fareEstimate: number;
  status: string;
  driverId?: string;
};

export default function Driver() {
  const [online, setOnline] = useState(false);
  const [rides, setRides] = useState<Ride[]>([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [totalToday, setTotalToday] = useState(0);
  const [approvalStatus, setApprovalStatus] = useState('pending');

  useEffect(() => {
    const user = getAuth().currentUser;

    if (!user) {
      router.replace('/login');
      return;
    }

    const db = getFirestore();

    const unsubscribeDriver = onSnapshot(
      doc(db, 'drivers', user.uid),
      (snapshot) => {
        const data = snapshot.data();
        setApprovalStatus(data?.approvalStatus || 'pending');
        setOnline(data?.online === true);
      }
    );

    const ridesRef = collection(db, 'rideRequests');

    const unsubscribe = onSnapshot(
      query(ridesRef, where('status', '==', 'pending')),
      (snapshot: any) => {
        const list: Ride[] = snapshot.docs.map((item: any) => {
          const data = item.data();

          return {
            id: item.id,
            pickupArea: data.pickupArea || 'غير محدد',
            destination: data.destination || 'غير محدد',
            fareEstimate:
              typeof data.fareEstimate === 'number'
                ? data.fareEstimate
                : 1,
            status: data.status || 'pending',
          };
        });

        setRides(list);
      },
      (error: any) => {
        console.log('rideRequests error:', error);
      }
    );

    return () => {
      unsubscribe();
      unsubscribeDriver();
    };
  }, []);

  const toggleOnline = async () => {
    try {
      const user = getAuth().currentUser;

      if (!user) {
        router.replace('/login');
        return;
      }

      if (approvalStatus !== 'approved') {
        Alert.alert(
          'حياة كابتن',
          approvalStatus === 'blocked'
            ? 'حسابك موقوف. راجع الإدارة.'
            : 'حسابك بانتظار اعتماد الإدارة.'
        );
        return;
      }

      const nextOnline = !online;

      await setDoc(
        doc(getFirestore(), 'drivers', user.uid),
        {
          uid: user.uid,
          email: user.email || '',
          online: nextOnline,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      setOnline(nextOnline);
    } catch (error: any) {
      Alert.alert(
        'حياة كابتن',
        error?.message || 'تعذر تغيير حالة الكابتن'
      );
    }
  };

  const acceptRide = async (ride: Ride) => {
    try {
      const user = getAuth().currentUser;

      if (!user) {
        router.replace('/login');
        return;
      }

      const db = getFirestore();
      const driverRef = doc(db, 'drivers', user.uid);
      const driverSnapshot = await getDoc(driverRef);

      if (!driverSnapshot.exists()) {
        Alert.alert('حياة كابتن', 'أكمل بيانات الكابتن والسيارة أولاً');
        router.push('/account');
        return;
      }

      const driverData = driverSnapshot.data();

      if (
        !driverData?.name ||
        !driverData?.phone ||
        !driverData?.carType ||
        !driverData?.carModel ||
        !driverData?.carColor ||
        !driverData?.plateNumber
      ) {
        Alert.alert(
          'حياة كابتن',
          'يجب إكمال بيانات الكابتن والسيارة قبل قبول الرحلة'
        );
        router.push('/account');
        return;
      }

      const rideRef = doc(db, 'rideRequests', ride.id);

      await runTransaction(db, async (transaction: any) => {
        const snapshot = await transaction.get(rideRef);

        if (!snapshot.exists) {
          throw new Error('الرحلة غير موجودة');
        }

        const data = snapshot.data();

        if (data?.status !== 'pending') {
          throw new Error('هذه الرحلة تم قبولها من كابتن آخر');
        }

        const driverRef = doc(db, 'drivers', user.uid);
        const driverSnapshot = await transaction.get(driverRef);
        const driverData = driverSnapshot.exists()
          ? driverSnapshot.data()
          : {};

        transaction.update(rideRef, {
          status: 'accepted',
          driverId: user.uid,
          driverName: driverData?.name || user.email || 'كابتن حياة',
          driverPhone: driverData?.phone || '',
          carType: driverData?.carType || '',
          carModel: driverData?.carModel || '',
          carColor: driverData?.carColor || '',
          plateNumber: driverData?.plateNumber || '',
          acceptedAt: new Date(),
        });
      });

      Alert.alert(
        'حياة كابتن',
        `تم قبول الرحلة\nالأجرة: ${ride.fareEstimate.toFixed(2)} د.أ`
      );
    } catch (error: any) {
      Alert.alert(
        'حياة كابتن',
        error?.message || 'تعذر قبول الرحلة'
      );
    }
  };

  const logout = async () => {
    await signOut(getAuth());
    router.replace('/login');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>حياة كابتن</Text>

      <Text style={styles.approvalStatus}>
        {approvalStatus === 'approved'
          ? '🟢 الحساب معتمد'
          : approvalStatus === 'blocked'
            ? '🔴 الحساب موقوف'
            : '🟡 بانتظار اعتماد الإدارة'}
      </Text>

      <Text style={styles.status}>
        {online
          ? '🟢 أنت متاح لاستقبال الرحلات'
          : '⚪ أنت غير متاح'}
      </Text>

      <Pressable
        style={[styles.onlineButton, online && styles.offlineButton]}
        onPress={toggleOnline}
      >
        <Text style={styles.buttonText}>
          {online ? 'إيقاف استقبال الرحلات' : 'أنا متاح'}
        </Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚕 الرحلات الجديدة</Text>

        {!online && (
          <Text style={styles.empty}>
            فعّل حالة "أنا متاح" لاستقبال الرحلات
          </Text>
        )}

        {online && rides.length === 0 && (
          <Text style={styles.empty}>
            لا توجد رحلات جديدة حاليًا
          </Text>
        )}

        {online && rides.map((ride) => (
          <View key={ride.id} style={styles.ride}>
            <Text style={styles.rideTitle}>طلب رحلة جديد</Text>

            <Text style={styles.info}>
              📍 الانطلاق: {ride.pickupArea}
            </Text>

            <Text style={styles.info}>
              🎯 الوجهة: {ride.destination}
            </Text>

            <Text style={styles.fare}>
              💰 الأجرة: {ride.fareEstimate.toFixed(2)} د.أ
            </Text>

            {ride.status === 'pending' && (
              <Pressable
                style={styles.acceptButton}
                onPress={() => acceptRide(ride)}
              >
                <Text style={styles.acceptText}>قبول الرحلة</Text>
              </Pressable>
            )}

            {ride.status === 'accepted' && (
              <Pressable
                style={styles.acceptButton}
                onPress={async () => {
                  try {
                    await updateDoc(
                      doc(getFirestore(), 'rideRequests', ride.id),
                      {
                        status: 'started',
                        startedAt: new Date(),
                      }
                    );

                    Alert.alert('حياة كابتن', 'بدأت الرحلة');
                  } catch (error: any) {
                    Alert.alert(
                      'حياة كابتن',
                      error?.message || 'تعذر بدء الرحلة'
                    );
                  }
                }}
              >
                <Text style={styles.acceptText}>بدء الرحلة</Text>
              </Pressable>
            )}

            {ride.status === 'started' && (
              <Pressable
                style={styles.acceptButton}
                onPress={async () => {
                  try {
                    await updateDoc(
                      doc(getFirestore(), 'rideRequests', ride.id),
                      {
                        status: 'completed',
                        completedAt: new Date(),
                      }
                    );

                    Alert.alert('حياة كابتن', 'تم إنهاء الرحلة');
                  } catch (error: any) {
                    Alert.alert(
                      'حياة كابتن',
                      error?.message || 'تعذر إنهاء الرحلة'
                    );
                  }
                }}
              >
                <Text style={styles.acceptText}>إنهاء الرحلة</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 حساب الكابتن</Text>

        <Text style={styles.info}>رحلات اليوم: {completedToday}</Text>
        <Text style={styles.info}>إجمالي الأجرة: {totalToday.toFixed(2)} د.أ</Text>
      </View>

      <Pressable
        style={styles.historyButton}
        onPress={() => router.push('/history')}
      >
        <Text style={styles.historyButtonText}>📋 سجل الرحلات</Text>
      </Pressable>

      <Pressable
        style={styles.accountButton}
        onPress={() => router.push('/account')}
      >
        <Text style={styles.accountButtonText}>👤 حسابي</Text>
      </Pressable>

      <Pressable style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  approvalStatus: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },

  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 35,
    marginBottom: 10,
  },
  status: {
    textAlign: 'center',
    fontSize: 17,
    marginBottom: 18,
  },
  onlineButton: {
    padding: 17,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  offlineButton: {
    backgroundColor: '#555',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },
  section: {
    marginTop: 25,
    padding: 18,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 15,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 15,
  },
  empty: {
    textAlign: 'right',
    color: '#777',
    fontSize: 16,
  },
  ride: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },
  rideTitle: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 12,
  },
  info: {
    fontSize: 16,
    textAlign: 'right',
    marginBottom: 8,
  },
  fare: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'right',
    marginVertical: 8,
  },
  acceptButton: {
    marginTop: 10,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#111',
  },
  acceptText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },
  historyButton: {
    backgroundColor: '#e8f5e9',
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  historyButtonText: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  accountButton: {
    backgroundColor: '#e3f2fd',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  accountButtonText: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  logout: {
    marginTop: 35,
    padding: 15,
  },
  logoutText: {
    textAlign: 'center',
    color: '#b00020',
    fontSize: 16,
  },
});
