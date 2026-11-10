import { Routes, Route } from "react-router-dom";
import AuthLayout from "./components/AuthLayout";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import RoomsPage from "./pages/RoomsPage";
import LobbyPage from "./pages/LobbyPage";
import GamePage from "./pages/GamePage";
import PlayPage from "./pages/PlayPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/rooms" element={<RoomsPage />} />
      </Route>
      <Route path="/lobby/:roomId" element={<LobbyPage />} />
      <Route path="/game/:gameId" element={<GamePage />} />
    </Routes>
  );
}