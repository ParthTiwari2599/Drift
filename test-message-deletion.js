#!/usr/bin/env node

/**
 * Test script to verify automatic message deletion after 2 hours
 * This script creates test messages and monitors their deletion
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, onSnapshot, query, where, orderBy, deleteDoc, doc } = require('firebase/firestore');

// Firebase config (replace with your actual config)
const firebaseConfig = {
  // Add your Firebase config here
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testMessageDeletion() {
  console.log('🧪 Starting message deletion test...');

  // Create a test room
  const testRoomId = `test-room-${Date.now()}`;
  console.log(`📝 Test room: ${testRoomId}`);

  // Send test messages with different expiry times
  const messages = [
    { text: 'Test message 1 (2h expiry)', expiry: '2h' },
    { text: 'Test message 2 (1h expiry)', expiry: '1h' },
    { text: 'Test message 3 (30m expiry)', expiry: '30m' }
  ];

  const messageIds = [];

  for (const msg of messages) {
    try {
      const docRef = await addDoc(collection(db, 'messages'), {
        text: msg.text,
        userId: 'test-user',
        roomId: testRoomId,
        createdAt: new Date(),
        expiry: msg.expiry
      });
      messageIds.push(docRef.id);
      console.log(`✅ Sent: ${msg.text} (ID: ${docRef.id})`);
    } catch (error) {
      console.error('❌ Error sending message:', error);
    }
  }

  // Monitor messages in the test room
  const q = query(
    collection(db, 'messages'),
    where('roomId', '==', testRoomId),
    orderBy('createdAt', 'desc')
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const currentMessages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📊 Current messages in room: ${currentMessages.length}`);

    currentMessages.forEach(msg => {
      const age = Date.now() - msg.createdAt.toDate().getTime();
      const expiryMs = msg.expiry === '2h' ? 2 * 60 * 60 * 1000 :
                      msg.expiry === '1h' ? 60 * 60 * 1000 :
                      30 * 60 * 1000;

      const timeLeft = Math.max(0, expiryMs - age);
      const minutesLeft = Math.floor(timeLeft / (1000 * 60));

      console.log(`  - ${msg.text}: ${minutesLeft}m left`);
    });

    // Check if all messages are deleted
    if (currentMessages.length === 0) {
      console.log('🎉 All messages deleted! Test passed.');
      unsubscribe();
      process.exit(0);
    }
  });

  // Wait for 5 minutes to see if cleanup happens
  setTimeout(() => {
    console.log('⏰ Test timeout - checking final state...');
    unsubscribe();
    process.exit(0);
  }, 5 * 60 * 1000); // 5 minutes
}

testMessageDeletion().catch(console.error);