import React, { useState, useEffect } from 'react';
import ParkMap from './components/ParkMap';
import AdminMap from './components/AdminMap';
import { loginWithGoogle, logout, auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAdminView, setIsAdminView] = useState(false);

  useEffect(() => {
    // Escuchar cambios de estado en la sesión de Firebase
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        setUser(currentUser);
        setToken(idToken);
      } else {
        setUser(null);
        setToken(null);
        setIsAdminView(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const res = await loginWithGoogle();
      setUser(res.user);
      setToken(res.token);
      setIsAdminView(true);
    } catch (err) {
      alert('Error al iniciar sesión con Google');
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setIsAdminView(false);
  };

  return (
    <div className="App">
      {/* Barra superior de navegación/autenticación */}
      <header style={{ padding: '10px', background: '#222', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Mapa Parque de Diversiones</h2>
        <div>
          {user ? (
            <>
              <span style={{ marginRight: '10px' }}>Hola, {user.displayName}</span>
              <button onClick={() => setIsAdminView(!isAdminView)}>
                {isAdminView ? 'Ver Mapa Público' : 'Modo Administrador'}
              </button>
              <button onClick={handleLogout} style={{ marginLeft: '10px' }}>Cerrar Sesión</button>
            </>
          ) : (
            <button onClick={handleLogin}>Iniciar Sesión con Google (Admin)</button>
          )}
        </div>
      </header>

      {/* Renderizado condicional según el modo */}
      <main>
        {isAdminView && token ? (
          <AdminMap token={token} />
        ) : (
          <ParkMap />
        )}
      </main>
    </div>
  );
}

export default App;