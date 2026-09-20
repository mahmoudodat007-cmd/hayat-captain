import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';

export default function Chat() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!rideId) return;

    const ref = collection(getFirestore(), 'rideRequests', rideId, 'messages');
    return onSnapshot(query(ref, orderBy('createdAt', 'asc')), snapshot => {
      setMessages(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    });
  }, [rideId]);

  const sendMessage = async () => {
    const value = text.trim();
    const user = getAuth().currentUser;
    if (!value || !rideId || !user) return;

    try {
      await addDoc(
        collection(getFirestore(), 'rideRequests', rideId, 'messages'),
        {
          text: value,
          senderId: user.uid,
          senderType: 'driver',
          createdAt: serverTimestamp(),
        }
      );
      setText('');
    } catch (error: any) {
      Alert.alert('حياة كابتن', error?.message || 'تعذر إرسال الرسالة');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>رجوع</Text>
        </Pressable>
        <Text style={styles.title}>💬 محادثة العميل</Text>
      </View>

      <FlatList
        style={styles.list}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const mine = item.senderId === getAuth().currentUser?.uid;
          return (
            <View style={[styles.message, mine ? styles.mine : styles.other]}>
              <Text style={styles.messageText}>{item.text}</Text>
            </View>
          );
        }}
      />

      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="اكتب رسالة..."
          style={styles.input}
        />
        <Pressable style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendText}>إرسال</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 15,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { fontSize: 16, color: '#007aff' },
  title: { fontSize: 20, fontWeight: '700' },
  list: { flex: 1, paddingHorizontal: 12 },
  message: {
    maxWidth: '80%',
    padding: 12,
    marginVertical: 5,
    borderRadius: 12,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: '#d9fdd3' },
  other: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  messageText: { fontSize: 16 },
  inputRow: { flexDirection: 'row', padding: 10, backgroundColor: '#fff' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
  },
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#007aff',
  },
  sendText: { color: '#fff', fontWeight: '700' },
});
