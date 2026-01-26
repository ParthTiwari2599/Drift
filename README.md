# Drift - Anonymous Chat App

Drift: A real-time, high-performance anonymous chat engine. Built with Next.js and Firebase, it features secure peer-to-peer handshake protocols, persistent anonymous profiles, and sub-second latency messaging.

## Features

- **Anonymous Group Chats**: Join topic-based chat rooms.
- **Private Messaging**: Securely connect and chat privately with other users.
- **Real-time Updates**: Live messaging with Firebase Firestore.
- **Presence Tracking**: See who's online in each room in real-time.
- **Cyber-minimalist UI**: Designed for seamless global and private communication.

## Setup

1. **Firebase Configuration**:
   Create a `.env.local` file and add your config:
   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id