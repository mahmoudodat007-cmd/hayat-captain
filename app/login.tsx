import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
} from 'react-native';
import { getAuth, signInWithEmailAndPassword } from '@react-native-firebase/auth';
import { router } from 'expo-router';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!email.trim() || !password) {
      Alert.alert('حياة كابتن', 'أدخل البريد الإلكتروني وكلمة المرور');
      return;
    }

    try {
      setLoading(true);

      await signInWithEmailAndPassword(
        getAuth(),
        email.trim(),
        password
      );

      router.replace('/driver');
    } catch (error: any) {
      Alert.alert(
        'حياة كابتن',
        error?.message || 'فشل تسجيل الدخول'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>حياة كابتن</Text>
      <Text style={styles.subtitle}>تسجيل دخول الكابتن</Text>

      <TextInput
        style={styles.input}
        placeholder="البريد الإلكتروني"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="كلمة المرور"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable style={styles.button} onPress={login} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'جاري الدخول...' : 'دخول'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    textAlign: 'center',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 18,
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    padding: 15,
    marginBottom: 14,
    fontSize: 16,
    textAlign: 'right',
  },
  button: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#111',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
});
