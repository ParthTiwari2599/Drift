// import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
// import { storage } from "@/lib/firebase";

// export const uploadChatImage = async (file: File, roomId: string, userId: string) => {
//   const imageRef = ref(
//     storage,
//     `chat_images/${roomId}/${userId}_${Date.now()}_${file.name}`
//   );

//   await uploadBytes(imageRef, file);
//   const url = await getDownloadURL(imageRef);
//   return url;
// };
