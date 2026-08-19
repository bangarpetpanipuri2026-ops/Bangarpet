const firebaseConfig = {
  apiKey: "AIzaSyAnRBYNUC1Z7CeuYbV7zyMDsVOme0LCPqk",
  authDomain: "chaya-co.firebaseapp.com",
  databaseURL: "https://chaya-co-default-rtdb.firebaseio.com",
  projectId: "chaya-co",
  storageBucket: "chaya-co.firebasestorage.app",
  messagingSenderId: "378388457746",
  appId: "1:378388457746:web:520850fb34170eba0eebcb"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
