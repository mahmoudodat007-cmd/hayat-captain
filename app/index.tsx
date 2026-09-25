import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import { router } from 'expo-router';

export default function Home() {
  useEffect(() => {
    const user = getAuth().currentUser;

    if (user) {
      router.replace('/driver');
    } else {
      router.replace('/login');
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>حياة كابتن</Text>
      <Text style={styles.subtitle}>جاري التحقق من تسجيل الدخول...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
  },
});
