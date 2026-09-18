import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { getAuth, signOut } from '@react-native-firebase/auth';
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  getDoc,
} from '@react-native-firebase/firestore';
import { router } from 'expo-router';

export default function Account() {
  const user = getAuth().currentUser;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [carType, setCarType] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carColor, setCarColor] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }

    return onSnapshot(
      doc(getFirestore(), 'drivers', user.uid),
      (snapshot) => {
        const data = snapshot.data();

        if (data) {
          setName(data.name || '');
          setPhone(data.phone || '');
          setCarType(data.carType || '');
          setCarModel(data.carModel || '');
          setCarColor(data.carColor || '');
          setPlateNumber(data.plateNumber || '');
        }
      }
    );
  }, []);

  const saveProfile = async () => {
    if (!user) {
      router.replace('/login');
      return;
    }

    if (
      !name.trim() ||
      !phone.trim() ||
      !carType.trim() ||
      !carModel.trim() ||
      !carColor.trim() ||
      !plateNumber.trim()
    ) {
      Alert.alert('حياة كابتن', 'يرجى تعبئة جميع البيانات');
      return;
    }

    try {
      setSaving(true);

      const driverRef = doc(getFirestore(), 'drivers', user.uid);
      const existing = await getDoc(driverRef);

      await setDoc(
        driverRef,
        {
          uid: user.uid,
          email: user.email || '',
          name: name.trim(),
          phone: phone.trim(),
          carType: carType.trim(),
          carModel: carModel.trim(),
          carColor: carColor.trim(),
          plateNumber: plateNumber.trim(),
          ...(existing.exists()
            ? {}
            : {
                approvalStatus: 'pending',
                online: false,
              }),
          updatedAt: new Date(),
        },
        { merge: true }
      );

      Alert.alert('حياة كابتن', 'تم حفظ البيانات بنجاح');
    } catch (error: any) {
      Alert.alert('حياة كابتن', error?.message || 'تعذر حفظ البيانات');
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await signOut(getAuth());
    router.replace('/login');
  };

  if (!user) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>حساب الكابتن</Text>

      <Text style={styles.section}>بيانات الكابتن</Text>

      <TextInput
        style={styles.input}
        placeholder="اسم الكابتن"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="رقم الهاتف"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <View style={styles.emailBox}>
        <Text style={styles.label}>البريد الإلكتروني</Text>
        <Text style={styles.email}>{user.email || 'غير متوفر'}</Text>
      </View>

      <Text style={styles.section}>بيانات السيارة</Text>

      <TextInput
        style={styles.input}
        placeholder="نوع السيارة - مثال: تويوتا"
        value={carType}
        onChangeText={setCarType}
      />

      <TextInput
        style={styles.input}
        placeholder="موديل السيارة - مثال: كورولا 2022"
        value={carModel}
        onChangeText={setCarModel}
      />

      <TextInput
        style={styles.input}
        placeholder="لون السيارة"
        value={carColor}
        onChangeText={setCarColor}
      />

      <TextInput
        style={styles.input}
        placeholder="رقم اللوحة"
        value={plateNumber}
        onChangeText={setPlateNumber}
      />

      <Pressable
        style={styles.saveButton}
        onPress={saveProfile}
        disabled={saving}
      >
        <Text style={styles.saveText}>
          {saving ? 'جاري الحفظ...' : 'حفظ بيانات الكابتن والسيارة'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.historyButton}
        onPress={() => router.push('/history')}
      >
        <Text style={styles.buttonText}>📋 سجل الرحلات</Text>
      </Pressable>

      <Pressable style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 30,
    marginBottom: 25,
  },
  section: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  emailBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#2e7d32',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  historyButton: {
    backgroundColor: '#e8f5e9',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  logout: {
    backgroundColor: '#eee',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 17,
    fontWeight: 'bold',
  },
});
