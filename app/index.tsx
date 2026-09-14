import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>حياة كابتن</Text>
      <Text style={styles.subtitle}>تطبيق كابتن حياة</Text>

      <Pressable
        style={styles.button}
        onPress={() => router.push('/login')}
      >
        <Text style={styles.buttonText}>تسجيل دخول الكابتن</Text>
      </Pressable>
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
    marginBottom: 40,
  },
  button: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
});
