import React, { useEffect, useState } from 'react';
import * as Notifications from "expo-notifications";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  Linking,
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
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

async function registerForPushNotificationsAsync(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;
  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

type Ride = {
  id: string;
  pickupArea: string;
  destination: string;
  fareEstimate: number;
  finalFare?: number;
  completedAt?: any;
  status: string;
  driverId?: string;
  riderId?: string;
  riderName?: string;
  riderPhone?: string;
  pickupCoords?: { latitude: number; longitude: number };
};

export default function Driver() {
  const [online, setOnline] = useState(false);
  const [rides, setRides] = useState<Ride[]>([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [totalToday, setTotalToday] = useState(0);
  const [approvalStatus, setApprovalStatus] = useState('pending');
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [requestRadius, setRequestRadius] = useState(1.5);

  const distanceKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const mapRef = React.useRef<MapView>(null);

  useEffect(() => {
    const user = getAuth().currentUser;

    if (!user) {
      router.replace('/login');
      return;
    }

    const db = getFirestore();

    onSnapshot(doc(db, 'drivers', user.uid), (snapshot: any) => {
      const data = snapshot.data();
      if (typeof data?.requestRadius === 'number') {
        setRequestRadius(data.requestRadius);
      }
    });

  registerForPushNotificationsAsync().then(async (token: string | null) => {
    if (!token) return;
    try {
      await setDoc(doc(db, "drivers", user.uid), { pushToken: token }, { merge: true });
    } catch (error) {
      console.log("push token save error:", error);
    }
  });

    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          console.log('location permission denied');
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        setDriverLocation(coords);

        await setDoc(
          doc(db, 'drivers', user.uid),
          {
            location: coords,
            updatedAt: new Date(),
          },
          { merge: true }
        );

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 100,
          },
          async (update) => {
            const nextCoords = {
              latitude: update.coords.latitude,
              longitude: update.coords.longitude,
            };

            setDriverLocation(nextCoords);

            try {
              await setDoc(
                doc(db, 'drivers', user.uid),
                {
                  location: nextCoords,
                  updatedAt: new Date(),
                },
                { merge: true }
              );
            } catch (error) {
              console.log('driver location update error:', error);
            }
          }
        );
      } catch (error) {
        console.log('driver location error:', error);
      }
    })();

    const unsubscribeTodayStats = onSnapshot(
      query(
        collection(db, 'rideRequests'),
        where('driverId', '==', user.uid),
        where('status', '==', 'completed')
      ),
      (snapshot: any) => {
        let count = 0;
        let total = 0;

        const now = new Date();
        const startOfDay = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );

        snapshot.forEach((docSnapshot: any) => {
          const data = docSnapshot.data();

          const completedAt = data.completedAt?.toDate
            ? data.completedAt.toDate()
            : data.completedAt
              ? new Date(data.completedAt)
              : null;

          if (completedAt && completedAt >= startOfDay) {
            count += 1;

            const fare =
              typeof data.finalFare === 'number'
                ? data.finalFare
                : typeof data.fareEstimate === 'number'
                  ? data.fareEstimate
                  : 0;

            total += fare;
          }
        });

        setCompletedToday(count);
        setTotalToday(total);
      },
      (error: any) => {
        console.log('today stats error:', error);
      }
    );

    const unsubscribeDriver = onSnapshot(
      doc(db, 'drivers', user.uid),
      (snapshot) => {
        const data = snapshot.data();
        setApprovalStatus(data?.approvalStatus || 'pending');
        setOnline(data?.online === true);
      }
    );

    const ridesRef = collection(db, 'rideRequests');
    const ridesMap = new Map<string, Ride>();

    const updateRides = () => {
      setRides(Array.from(ridesMap.values()));
    };

    const unsubscribePending = onSnapshot(
      query(ridesRef, where('status', '==', 'pending')),
      (snapshot: any) => {
        snapshot.docChanges().forEach((change: any) => {
          const data = change.doc.data();

          if (change.type === 'removed') {
            ridesMap.delete(change.doc.id);
            return;
          }

          if (data.status !== 'pending') {
            ridesMap.delete(change.doc.id);
            return;
          }

          ridesMap.set(change.doc.id, {
            id: change.doc.id,
            pickupArea: data.pickupArea || 'غير محدد',
            pickupCoords: data.pickup || undefined,
            destination: data.destination || 'غير محدد',
            fareEstimate:
              typeof data.fareEstimate === 'number'
                ? data.fareEstimate
                : 1,
            finalFare:
              typeof data.finalFare === 'number'
                ? data.finalFare
                : undefined,
            completedAt: data.completedAt,
            status: 'pending',
            driverId: data.driverId,
          });
        });

        updateRides();
      },
      (error: any) => {
        console.log('pending rides error:', error);
      }
    );

    const unsubscribeMyRides = onSnapshot(
      query(ridesRef, where('driverId', '==', user.uid)),
      (snapshot: any) => {
        snapshot.docChanges().forEach((change: any) => {
          const data = change.doc.data();

          if (change.type === 'removed') {
            ridesMap.delete(change.doc.id);
            return;
          }

          const status = data.status || 'pending';

          if (!['accepted', 'arriving', 'started'].includes(status)) {
            ridesMap.delete(change.doc.id);
            return;
          }

          ridesMap.set(change.doc.id, {
            id: change.doc.id,
            pickupArea: data.pickupArea || 'غير محدد',
            pickupCoords: data.pickup || undefined,
            destination: data.destination || 'غير محدد',
            fareEstimate:
              typeof data.fareEstimate === 'number'
                ? data.fareEstimate
                : 1,
            finalFare:
              typeof data.finalFare === 'number'
                ? data.finalFare
                : undefined,
            completedAt: data.completedAt,
            status,
            driverId: data.driverId,
          });
        });

        updateRides();
      },
      (error: any) => {
        console.log('my rides error:', error);
      }
    );

    return () => {
      unsubscribeDriver();
      unsubscribeTodayStats();
      unsubscribePending();
      unsubscribeMyRides();
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

        if (!snapshot.exists()) {
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

      <View style={styles.mapBox}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          showsUserLocation={!!driverLocation}
          initialRegion={{
            latitude: driverLocation?.latitude ?? 32.5556,
            longitude: driverLocation?.longitude ?? 35.8500,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }}
        >
          {driverLocation && (
            <Marker
              coordinate={driverLocation}
              title="📍 موقعي"
            />
          )}

          {rides
            .filter((ride) =>
              ['accepted', 'arriving', 'started'].includes(ride.status)
            )
            .map((ride) =>
              ride.pickupCoords ? (
                <Marker
                  key={ride.id}
                  coordinate={ride.pickupCoords}
                  title="👤 موقع العميل"
                />
              ) : null
            )}
        </MapView>

        {rides
          .filter((ride) =>
            ['accepted', 'arriving', 'started'].includes(ride.status)
          )
          .find((ride) => ride.pickupCoords) && (
            <Pressable
              style={styles.customerMapButton}
              onPress={() => {
                const ride = rides
                  .filter((ride) =>
                    ['accepted', 'arriving', 'started'].includes(ride.status)
                  )
                  .find((ride) => ride.pickupCoords);

                if (ride?.pickupCoords) {
                  mapRef.current?.animateToRegion({
                    ...ride.pickupCoords,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }, 800);
                }
              }}
            >
              <Text style={styles.buttonText}>📍 التوجه للعميل</Text>
            </Pressable>
          )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 نطاق استقبال الطلبات</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[1, 1.5, 2, 3, 5].map((radius) => (
            <Pressable
              key={radius}
              onPress={async () => {
                setRequestRadius(radius);
                const currentUser = getAuth().currentUser;
                if (!currentUser) return;

                try {
                  await setDoc(
                    doc(getFirestore(), 'drivers', currentUser.uid),
                    { requestRadius: radius },
                    { merge: true }
                  );
                } catch (error) {
                  console.log('request radius save error:', error);
                }
              }}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: requestRadius === radius ? '#111' : '#eee',
              }}
            >
              <Text style={{
                color: requestRadius === radius ? '#fff' : '#111',
                fontWeight: '700',
              }}>
                {radius} كم
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚕 الرحلات الجديدة</Text>

        {!online && (
          <Text style={styles.empty}>
            فعّل حالة "أنا متاح" لاستقبال الرحلات الجديدة
          </Text>
        )}

        {online &&
          rides
            .filter((ride) => {
              if (ride.status !== 'pending') return false;
              if (!driverLocation || !ride.pickupCoords) return false;

              const distance = distanceKm(
                driverLocation.latitude,
                driverLocation.longitude,
                ride.pickupCoords.latitude,
                ride.pickupCoords.longitude
              );

              return distance <= requestRadius;
            }).length === 0 && (
            <Text style={styles.empty}>
              لا توجد رحلات جديدة ضمن النطاق المحدد
            </Text>
          )}

        {online &&
          rides
            .filter((ride) => {
              if (ride.status !== 'pending') return false;
              if (!driverLocation || !ride.pickupCoords) return true;

              const distance = distanceKm(
                driverLocation.latitude,
                driverLocation.longitude,
                ride.pickupCoords.latitude,
                ride.pickupCoords.longitude
              );

              return distance <= requestRadius;
            })
            .sort((a, b) => {
              if (!driverLocation) return 0;

              const da = a.pickupCoords
                ? distanceKm(
                    driverLocation.latitude,
                    driverLocation.longitude,
                    a.pickupCoords.latitude,
                    a.pickupCoords.longitude
                  )
                : Number.MAX_SAFE_INTEGER;

              const db = b.pickupCoords
                ? distanceKm(
                    driverLocation.latitude,
                    driverLocation.longitude,
                    b.pickupCoords.latitude,
                    b.pickupCoords.longitude
                  )
                : Number.MAX_SAFE_INTEGER;

              return da - db;
            })
            .slice(0, 4)
            .map((ride) => (
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

                <Pressable
                  style={styles.acceptButton}
                  onPress={() => acceptRide(ride)}
                >
                  <Text style={styles.acceptText}>قبول الرحلة</Text>
                </Pressable>
              </View>
            ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚗 الرحلة الحالية</Text>

        {rides.filter((ride) =>
          ['accepted', 'arriving', 'started'].includes(ride.status)
        ).length === 0 && (
          <Text style={styles.empty}>
            لا توجد رحلة قيد التنفيذ حاليًا
          </Text>
        )}

        {rides
          .filter((ride) =>
            ['accepted', 'arriving', 'started'].includes(ride.status)
          )
          .map((ride) => (
            <View key={ride.id} style={styles.ride}>
              <Text style={styles.rideTitle}>رحلة قيد التنفيذ</Text>

              <Text style={styles.info}>
                📍 الانطلاق: {ride.pickupArea}
              </Text>

              <Text style={styles.info}>
                🎯 الوجهة: {ride.destination}
              </Text>

              <Text style={styles.fare}>
                💰 الأجرة: {ride.fareEstimate.toFixed(2)} د.أ
              </Text>

              {(ride.status === 'accepted' || ride.status === 'arriving') && (
                <Pressable
                  style={styles.cancelButton}
                  onPress={() =>
                    Alert.alert(
                      'إلغاء الرحلة',
                      'هل أنت متأكد من إلغاء الرحلة؟',
                      [
                        { text: 'لا', style: 'cancel' },
                        {
                          text: 'نعم، إلغاء',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await updateDoc(
                                doc(getFirestore(), 'rideRequests', ride.id),
                                {
                                  status: 'pending',
                                  driverId: null,
                                  driverName: null,
                                  driverPhone: null,
                                  carType: null,
                                  carModel: null,
                                  carColor: null,
                                  plateNumber: null,
                                  cancelledBy: 'driver',
                                  cancelledAt: new Date(),
                                }
                              );

                              Alert.alert('حياة كابتن', 'تم إلغاء الرحلة وإعادتها للطلبات المتاحة');
                            } catch (error: any) {
                              Alert.alert(
                                'حياة كابتن',
                                error?.message || 'تعذر إلغاء الرحلة'
                              );
                            }
                          },
                        },
                      ]
                    )
                  }
                >
                  <Text style={styles.cancelButtonText}>❌ إلغاء الرحلة</Text>
                </Pressable>
              )}

              {ride.riderPhone &&
                (ride.status === 'accepted' ||
                  ride.status === 'arriving' ||
                  ride.status === 'started') && (
                  <Pressable
                    style={styles.callButton}
                    onPress={() =>
                      Linking.openURL(`tel:${ride.riderPhone}`)
                    }
                  >
                    <Text style={styles.callButtonText}>📞 اتصال بالعميل</Text>
                  </Pressable>
                )}

              {(ride.status === 'accepted' ||
                ride.status === 'arriving' ||
                ride.status === 'started') && (
                <Pressable
                  style={styles.chatButton}
                  onPress={() =>
                    router.push({
                      pathname: '/chat',
                      params: { rideId: ride.id },
                    })
                  }
                >
                  <Text style={styles.chatButtonText}>💬 محادثة العميل</Text>
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
                          status: 'arriving',
                          arrivingAt: new Date(),
                        }
                      );

                      Alert.alert('حياة كابتن', 'الكابتن بالطريق');
                    } catch (error: any) {
                      Alert.alert(
                        'حياة كابتن',
                        error?.message || 'تعذر تحديث حالة الرحلة'
                      );
                    }
                  }}
                >
                  <Text style={styles.acceptText}>🚗 أنا بالطريق</Text>
                </Pressable>
              )}

              {ride.status === 'arriving' && (
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
                  <Text style={styles.acceptText}>▶️ بدء الرحلة</Text>
                </Pressable>
              )}

              {ride.status === 'started' && (
                <Pressable
                  style={styles.acceptButton}
                  onPress={async () => {
                    try {
                      const db = getFirestore();
                      const rideRef = doc(db, 'rideRequests', ride.id);

                      await updateDoc(rideRef, {
                        status: 'completed',
                        completedAt: new Date(),
                        finalFare: ride.fareEstimate,
                      });

                      Alert.alert(
                        'حياة كابتن',
                        `تم إنهاء الرحلة\nالأجرة: ${ride.fareEstimate.toFixed(2)} د.أ`
                      );
                    } catch (error: any) {
                      Alert.alert(
                        'حياة كابتن',
                        error?.message || 'تعذر إنهاء الرحلة'
                      );
                    }
                  }}
                >
                  <Text style={styles.acceptText}>🏁 إنهاء الرحلة</Text>
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
  mapBox: {
    height: 300,
    marginTop: 20,
    borderRadius: 15,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  customerMapButton: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    left: 15,
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 12,
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
  cancelButton: {
    backgroundColor: '#ffebee',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#c62828',
    fontSize: 16,
    fontWeight: '700',
  },
  callButton: {
    backgroundColor: '#e8f5e9',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
    alignItems: 'center',
  },
  callButtonText: {
    color: '#2e7d32',
    fontSize: 16,
    fontWeight: '700',
  },
  chatButton: {
    backgroundColor: '#e8f0fe',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
    alignItems: 'center',
  },
  chatButtonText: {
    color: '#1967d2',
    fontSize: 16,
    fontWeight: '700',
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
