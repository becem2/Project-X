import { useEffect, useState } from "react";
import "./App.css";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "./Config/Firebase";
import LogInSignUp from "./Views/LogIn";
import Dashboard from "./Views/Dashboard";

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoaded(true);
    });

    return unsubscribe;
  }, []);

  const isAuthenticated = Boolean(
    currentUser &&
      (currentUser.emailVerified ||
        currentUser.providerData.some((provider) => provider.providerId !== "password"))
  );

  if (!authLoaded) {
    return null;
  }

  return isAuthenticated ? (
    <Dashboard user={currentUser} onLogout={() => signOut(auth)} />
  ) : (
    <LogInSignUp />
  );
}

export default App;